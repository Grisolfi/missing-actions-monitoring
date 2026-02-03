import Fastify, { FastifyError } from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { env } from '../utils/env.js';
import authPlugin from '../plugins/auth.js';
import webhookRoutes from './routes/webhooks.js';
import dashboardRoutes from './routes/dashboard.js';
import { worker as bullWorker } from '../services/worker.js';
import { cleanupWorker, scheduleDailyCleanup } from '../services/cleanup.js';
import { prisma } from '../models/prisma.js';
import { queueConnection, redisOptions } from '../services/queue.js';
import { Redis } from 'ioredis';
import { analytics } from '../services/analytics.js';
import cluster from 'node:cluster';
import { availableParallelism } from 'node:os';

const numWorkers = availableParallelism() > 1 ? 2 : 1;

export const server = Fastify({
    logger: {
        level: env.NODE_ENV === 'development' ? 'debug' : 'info',
        redact: ['req.headers["x-hub-signature-256"]', 'payload.repository.secret', 'password', 'token', 'secret'],
        transport: env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true } }
            : undefined,
    },
    trustProxy: true,
    // High-Throughput Socket Optimization
    keepAliveTimeout: 5000,
    maxRequestsPerSocket: 0, // Unlimited requests per socket for high throughput
});

// Initialize Analytics
analytics.init(server.log);

// Security Middleware
await server.register(helmet);
await server.register(cors);

// Auth Plugin
await server.register(authPlugin);

// Register Routes
server.register(webhookRoutes, { prefix: '/webhooks' });
server.register(dashboardRoutes, {
    prefix: '/api/dashboard',
    preHandler: [server.authenticate]
});

// Health Check
server.get('/health', { logLevel: 'warn' }, async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
});

// Global Error Handler
server.setErrorHandler((error: FastifyError, request, reply) => {
    request.log.error({
        err: error,
        requestId: request.id,
        method: request.method,
        url: request.url,
    }, 'Unhandled error occurred');

    const statusCode = error.statusCode || 500;
    const errorResponse = {
        error: statusCode >= 400 && statusCode < 500 ? 'Bad Request' : 'Internal Server Error',
        message: error.message,
        statusCode,
    };
    reply.status(statusCode).send(errorResponse);
});

const start = async () => {
    try {
        const port = env.PORT;
        await server.listen({ port, host: '0.0.0.0' });
        server.log.info(`Worker ${process.pid} listening on port ${port}`);

        // Only primary or specific worker should schedule daily tasks
        if (!cluster.worker || cluster.worker.id === 1) {
            await scheduleDailyCleanup();
        }
    } catch (err) {
        server.log.error(err);
        process.exit(1);
    }
};

const gracefulShutdown = async (signal: string) => {
    server.log.info(`Worker ${process.pid} received ${signal}. Shutting down...`);

    try {
        await server.close();
        await prisma.$disconnect();
        await bullWorker.close();
        await cleanupWorker.close();
        await queueConnection.quit();
        // Redis for rate limit is internal to its registration or managed here if we had a ref
        process.exit(0);
    } catch (err) {
        server.log.error(err, 'Error during graceful shutdown');
        process.exit(1);
    }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

if (cluster.isPrimary && env.NODE_ENV === 'production') {
    console.log(`Primary ${process.pid} is running. Forking ${numWorkers} workers...`);

    // Fork workers.
    for (let i = 0; i < numWorkers; i++) {
        cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
        console.log(`worker ${worker.process.pid} died. code: ${code}, signal: ${signal}. Spawning new worker...`);
        cluster.fork();
    });
} else {
    // Start server in worker or non-production environment
    start();
}
