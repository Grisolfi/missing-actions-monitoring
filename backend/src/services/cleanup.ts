import { prisma } from '../models/prisma.js';
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { queueConnection, redisOptions } from './queue.js';

const CLEANUP_QUEUE = 'cleanup-tasks';

export const cleanupQueue = new Queue(CLEANUP_QUEUE, { connection: queueConnection });

async function cleanupOldEvents() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    console.log(`Cleaning up events older than ${thirtyDaysAgo.toISOString()}`);

    const { count: eventCount } = await prisma.webhookEvent.deleteMany({
        where: {
            receivedAt: {
                lt: thirtyDaysAgo,
            },
        },
    });

    const { count: runCount } = await prisma.workflowRun.deleteMany({
        where: {
            startedAt: {
                lt: thirtyDaysAgo,
            },
        },
    });

    console.log(`Deleted ${eventCount} old webhook events and ${runCount} old workflow runs.`);
}

export const cleanupWorker = new Worker(
    CLEANUP_QUEUE,
    async (job) => {
        if (job.name === 'cleanup-webhooks') {
            await cleanupOldEvents();
        }
    },
    {
        connection: new Redis(process.env.REDIS_URL || 'redis://localhost:6379', redisOptions)
    }
);

// Schedule daily cleanup
export async function scheduleDailyCleanup() {
    await cleanupQueue.add(
        'cleanup-webhooks',
        {},
        {
            repeat: {
                every: 24 * 60 * 60 * 1000, // 24 hours
            },
        }
    );
}
