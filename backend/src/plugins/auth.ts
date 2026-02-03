import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { env } from '../utils/env.js';

export default fp(async function authPlugin(fastify: FastifyInstance) {
    fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
        const apiKey = request.headers['x-api-key'];

        if (!apiKey || apiKey !== env.DASHBOARD_API_KEY) {
            reply.status(401).send({
                error: 'Unauthorized',
                message: 'Invalid or missing API Key',
                statusCode: 401
            });
            throw new Error('Unauthorized');
        }
    });
});

declare module 'fastify' {
    export interface FastifyInstance {
        authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    }
}
