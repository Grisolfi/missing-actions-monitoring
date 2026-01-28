import { WebhookEventStatus } from '@prisma/client';
import { prisma } from '../models/prisma.js';
import { updateWebhookEventStatus } from '../models/event.js';
import { analytics } from './analytics.js';

// Map of event types to their respective processing functions
const eventHandlers: Record<string, (payload: any) => Promise<void>> = {
    workflow_run: processWorkflowRun,
    workflow_job: processWorkflowJob,
};

export async function processGithubEvent(eventId: string) {
    const event = await prisma.webhookEvent.findUnique({
        where: { id: eventId },
    });

    if (!event) {
        throw new Error(`Event ${eventId} not found`);
    }

    if (event.status !== WebhookEventStatus.PENDING) {
        return;
    }

    try {
        const payload = event.payload as any;
        const handler = eventHandlers[event.eventType];

        if (handler) {
            await handler(payload);
        } else {
            console.warn(`No handler implemented for event type: ${event.eventType}`);
        }

        await updateWebhookEventStatus(eventId, WebhookEventStatus.PROCESSED);
    } catch (error: any) {
        console.error(`Failed to process event ${eventId}:`, error);
        throw error; // Rethrow for BullMQ retry
    }
}

async function processWorkflowRun(payload: any) {
    const run = payload.workflow_run;

    await prisma.$transaction(async (tx) => {
        const startedAt = new Date(run.run_started_at || run.created_at);
        const completedAt = run.updated_at ? new Date(run.updated_at) : null;
        let duration = null;
        let waitTime = null;

        if (run.status === 'completed' && completedAt) {
            duration = Math.floor((completedAt.getTime() - startedAt.getTime()) / 1000);
        }

        // Simplistic wait time: from created_at to run_started_at
        // In many cases they are the same in the payload, but we catch it if separated
        const createdAt = new Date(run.created_at);
        waitTime = Math.floor((startedAt.getTime() - createdAt.getTime()) / 1000);

        await tx.workflowRun.upsert({
            where: { id: BigInt(run.id) },
            update: {
                status: run.status,
                conclusion: run.conclusion,
                completedAt,
                duration,
                waitTime,
            },
            create: {
                id: BigInt(run.id),
                repositoryName: payload.repository.full_name,
                workflowName: run.name,
                status: run.status,
                conclusion: run.conclusion,
                startedAt,
                completedAt,
                duration,
                waitTime,
            },
        });

        analytics.track('workflow_run_processed', {
            run_id: run.id.toString(),
            repo: payload.repository.full_name,
            workflow: run.name,
            status: run.status,
            conclusion: run.conclusion,
            duration,
        });
    });
}

async function processWorkflowJob(payload: any) {
    const job = payload.workflow_job;

    await prisma.$transaction(async (tx) => {
        // Ensure the run exists (usually it should if workflow_run event came first)
        // but GitHub events can arrive out of order
        await tx.workflowRun.upsert({
            where: { id: BigInt(job.run_id) },
            update: {},
            create: {
                id: BigInt(job.run_id),
                repositoryName: payload.repository.full_name,
                workflowName: job.workflow_name || 'Unknown',
                status: 'in_progress', // Temporary status
                startedAt: new Date(job.started_at),
            },
        });

        await tx.workflowJob.upsert({
            where: { id: BigInt(job.id) },
            update: {
                status: job.status,
                conclusion: job.conclusion,
                completedAt: job.completed_at ? new Date(job.completed_at) : null,
            },
            create: {
                id: BigInt(job.id),
                runId: BigInt(job.run_id),
                name: job.name,
                status: job.status,
                conclusion: job.conclusion,
                startedAt: new Date(job.started_at),
                completedAt: job.completed_at ? new Date(job.completed_at) : null,
            },
        });

        if (job.conclusion === 'failure') {
            analytics.track('workflow_job_failed', {
                job_id: job.id.toString(),
                run_id: job.run_id.toString(),
                repo: payload.repository.full_name,
                name: job.name,
            });
        }
    });
}
