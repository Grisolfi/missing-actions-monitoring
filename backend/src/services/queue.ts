import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';



// Shared options for all Redis connections
export const redisOptions = {
    maxRetriesPerRequest: null,
};

// Dedicated connection for the Queue (Non-blocking)
export const queueConnection = new Redis(REDIS_URL, {
    ...redisOptions,
    // Ensure we don't share this instance for blocking operations
});

export const GITHUB_EVENT_QUEUE = 'github-event-processing';

export const eventQueue = new Queue(GITHUB_EVENT_QUEUE, {
    connection: queueConnection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000,
        },
        removeOnComplete: true,
        removeOnFail: false,
    },
});
