import { FastifyInstance } from 'fastify';
import { verifySignature, getWebhookMetadata } from '../../utils/github-webhook.js';
import { createWebhookEvent } from '../../models/event.js';
import { eventQueue } from '../../services/queue.js';
import { WebhookEventStatus, Prisma } from '@prisma/client';
import { Redis } from 'ioredis';
import { redisOptions } from '../../services/queue.js';
import { analytics } from '../../services/analytics.js';
import { githubWebhookSchema } from '../schemas/github-webhooks.js';
import { getGitHubIPs } from '../../services/github-ips.js';
import ipRangeCheck from 'ip-range-check';

// Dedicated redis client for idempotency checks
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', redisOptions);

export default async function githubWebhookRoutes(fastify: FastifyInstance) {
    fastify.post('/github', {
        schema: githubWebhookSchema,
        bodyLimit: 1048576, // 1MB Limit
        preHandler: async (request, reply) => {
            // IP Whitelisting: Automatic bypass in development mode
            if (process.env.NODE_ENV === 'development') {
                return;
            }

            const allowedRanges = await getGitHubIPs();
            const clientIP = request.ip;

            if (allowedRanges.length > 0 && !ipRangeCheck(clientIP, allowedRanges)) {
                fastify.log.warn({ clientIP }, 'Blocked request from unauthorized IP');
                return reply.status(404).send({ error: 'Not Found', message: 'Route not found' });
            }
        }
    }, async (request, reply) => {
        // 1. Validate Signature
        const isValid = await verifySignature(request);
        if (!isValid) {
            fastify.log.warn('Invalid signature for webhook');
            return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid signature' });
        }

        const { deliveryId, eventType } = getWebhookMetadata(request);

        if (!deliveryId) {
            fastify.log.error('Missing x-github-delivery header');
            return reply.status(400).send({ error: 'Bad Request', message: 'Missing delivery ID' });
        }

        // 2. High-Performance Idempotency Check (Redis)
        const cacheKey = `idemp:${deliveryId}`;
        const isNew = await redis.set(cacheKey, '1', 'EX', 86400, 'NX'); // 24h TTL

        if (!isNew) {
            fastify.log.info({ deliveryId }, 'Duplicate webhook delivery (Redis hit) - skipping');
            return reply.status(202).send({
                status: 'skipped',
                message: 'Duplicate event (cached)',
                internalStatus: WebhookEventStatus.SKIPPED_DUPLICATE
            });
        }

        // Analytics: Webhook Received
        analytics.track('webhook_received', {
            delivery_id: deliveryId,
            event_type: eventType,
            repo: (request.body as any)?.repository?.full_name,
        });

        // 3. Persistent Store
        try {
            const prunedPayload = prunePayload(request.body, eventType);
            const event = await createWebhookEvent({
                externalId: deliveryId,
                eventType: eventType,
                payload: prunedPayload,
            });

            // 4. Queue for Processing
            await eventQueue.add(eventType, { eventId: event.id });

            fastify.log.info({ deliveryId, eventId: event.id, payloadSize: JSON.stringify(prunedPayload).length }, 'Webhook received, pruned, and queued');

            // 5. Immediate Acknowledgment
            return reply.status(202).send({
                status: 'accepted',
                deliveryId,
                eventId: event.id
            });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                fastify.log.info({ deliveryId }, 'Duplicate webhook delivery (DB collision) - skipping');
                return reply.status(202).send({
                    status: 'skipped',
                    message: 'Duplicate event',
                    internalStatus: WebhookEventStatus.SKIPPED_DUPLICATE
                });
            }
            throw error;
        }
    });
}

function prunePayload(body: any, eventType: string): any {
    const pruned: any = {
        repository: body.repository ? {
            full_name: body.repository.full_name,
            html_url: body.repository.html_url,
        } : undefined,
        sender: body.sender ? {
            login: body.sender.login,
            avatar_url: body.sender.avatar_url,
        } : undefined,
    };

    if (eventType === 'workflow_run' && body.workflow_run) {
        const run = body.workflow_run;
        pruned.workflow_run = {
            id: run.id,
            name: run.name,
            status: run.status,
            conclusion: run.conclusion,
            display_title: run.display_title,
            head_branch: run.head_branch,
            head_sha: run.head_sha,
            html_url: run.html_url,
            created_at: run.created_at,
            updated_at: run.updated_at,
            run_started_at: run.run_started_at,
        };
    } else if (eventType === 'workflow_job' && body.workflow_job) {
        const job = body.workflow_job;
        pruned.workflow_job = {
            id: job.id,
            run_id: job.run_id,
            workflow_name: job.workflow_name,
            name: job.name,
            status: job.status,
            conclusion: job.conclusion,
            started_at: job.started_at,
            completed_at: job.completed_at,
            html_url: job.html_url,
            steps: job.steps?.map((s: any) => ({
                name: s.name,
                status: s.status,
                conclusion: s.conclusion,
                number: s.number,
            })),
        };
    } else {
        // Fallback for unexpected types - keep as is but log warning
        return body;
    }

    return pruned;
}
