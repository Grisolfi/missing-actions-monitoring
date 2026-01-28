import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { GITHUB_EVENT_QUEUE, redisOptions } from './queue.js';
import { processGithubEvent } from './processor.js';
import { updateWebhookEventStatus } from '../models/event.js';
import { WebhookEventStatus } from '@prisma/client';

export const worker = new Worker(
    GITHUB_EVENT_QUEUE,
    async (job) => {
        const { eventId } = job.data;
        console.log(`Processing job ${job.id} for event ${eventId}`);
        await processGithubEvent(eventId);
    },
    {
        connection: new Redis(process.env.REDIS_URL || 'redis://localhost:6379', redisOptions),
        concurrency: Number(process.env.WORKER_CONCURRENCY) || 5,
    }
);

worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed successfully`);
});

worker.on('failed', async (job, err) => {
    console.error(`Job ${job?.id} failed with error:`, err);

    if (job && job.attemptsMade >= (job.opts.attempts || 3)) {
        const { eventId } = job.data;
        console.log(`Job ${job.id} exhausted all retries. Marking event ${eventId} as FAILED.`);
        await updateWebhookEventStatus(eventId, WebhookEventStatus.FAILED, err.message);
    }
});

console.log('Worker started and listening for jobs...');
