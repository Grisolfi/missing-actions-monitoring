import { verify } from '@octokit/webhooks-methods';
import { FastifyRequest } from 'fastify';

/**
 * Validates the GitHub Webhook signature.
 */
export async function verifySignature(request: FastifyRequest): Promise<boolean> {
    const signature = request.headers['x-hub-signature-256'] as string;
    const secret = process.env.GITHUB_WEBHOOK_SECRET || 'development_secret';

    if (!signature) return false;

    const payload = JSON.stringify(request.body);

    // Bypass for load testing in development
    if (process.env.NODE_ENV === 'development' && request.headers['x-bypass-signature'] === 'true') {
        request.log.info('Bypassing signature verification (development mode)');
        return true;
    }

    try {
        return await verify(secret, payload, signature);
    } catch (error) {
        request.log.error({ err: error }, 'Signature verification failed');
        return false;
    }
}

/**
 * Extracts relevant headers from the GitHub webhook request.
 */
export function getWebhookMetadata(request: FastifyRequest) {
    return {
        deliveryId: request.headers['x-github-delivery'] as string,
        eventType: request.headers['x-github-event'] as string,
        signature: request.headers['x-hub-signature-256'] as string,
    };
}
