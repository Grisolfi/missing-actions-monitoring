import { jest } from '@jest/globals';

// Mocks must be at the top level
jest.unstable_mockModule('../../src/utils/github-webhook.js', () => ({
    verifySignature: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
    getWebhookMetadata: jest.fn<() => any>().mockReturnValue({
        deliveryId: 'test-delivery-id',
        eventType: 'workflow_run',
    }),
}));

jest.unstable_mockModule('../../src/models/event.js', () => ({
    findWebhookEventByExternalId: jest.fn<() => Promise<any>>().mockResolvedValue(null),
    createWebhookEvent: jest.fn<() => Promise<any>>().mockResolvedValue({ id: 'test-event-id' }),
}));

jest.unstable_mockModule('../../src/services/queue.js', () => ({
    eventQueue: {
        add: jest.fn<() => Promise<any>>().mockResolvedValue({}),
    },
}));

describe('POST /webhooks/github', () => {
    let serverInstance: any;

    beforeAll(async () => {
        const { server } = await import('../../src/api/server.js');
        serverInstance = server;
    });

    afterAll(async () => {
        if (serverInstance) await serverInstance.close();
    });

    it('should return 202 and queue the event on valid request', async () => {
        const response = await serverInstance.inject({
            method: 'POST',
            url: '/webhooks/github',
            payload: { action: 'requested' },
            headers: {
                'x-hub-signature-256': 'valid-sig',
                'x-github-delivery': 'test-delivery-id',
                'x-github-event': 'workflow_run',
            },
        });

        expect(response.statusCode).toBe(202);
        expect(JSON.parse(response.body)).toEqual({
            status: 'accepted',
            deliveryId: 'test-delivery-id',
            eventId: 'test-event-id',
        });
    });
});
