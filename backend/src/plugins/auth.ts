import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { env } from '../utils/env.js';
import createError from '@fastify/error';

const UnauthorizedError = createError('FST_UNAUTHORIZED', 'Invalid or missing API Key', 401);

export default fp(async function authPlugin(fastify: FastifyInstance) {
    fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
        const apiKey = request.headers['x-api-key'];

        if (!apiKey || apiKey !== env.DASHBOARD_API_KEY) {
            throw new UnauthorizedError();
        }
    });
});

declare module 'fastify' {
    export interface FastifyInstance {
        authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    }
}
