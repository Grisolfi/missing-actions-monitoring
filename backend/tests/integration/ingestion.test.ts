import { jest, describe, it, expect, beforeAll, afterAll } from '@jest/globals';

// Mocks must be at the top level
jest.unstable_mockModule('../../src/utils/github-webhook.js', () => ({
    verifySignature: jest.fn<() => Promise<boolean>>().mockResolvedValue(true),
    getWebhookMetadata: jest.fn<() => any>().mockReturnValue({
        deliveryId: 'test-delivery-id',
        eventType: 'workflow_run',
    }),
}));

jest.unstable_mockModule('ioredis', () => ({
    Redis: jest.fn<any>().mockImplementation(() => ({
        set: jest.fn<() => Promise<string | null>>().mockResolvedValue('OK'),
        on: jest.fn<any>(),
        quit: jest.fn<any>().mockResolvedValue(undefined),
    })),
}));

jest.unstable_mockModule('../../src/models/event.js', () => ({
    findWebhookEventByExternalId: jest.fn<() => Promise<any>>().mockResolvedValue(null),
    createWebhookEvent: jest.fn<() => Promise<any>>().mockResolvedValue({ id: 'test-event-id' }),
    updateWebhookEventStatus: jest.fn<() => Promise<any>>().mockResolvedValue({}),
}));

jest.unstable_mockModule('../../src/services/queue.js', () => ({
    eventQueue: {
        add: jest.fn<() => Promise<any>>().mockResolvedValue({}),
    },
    redisOptions: {
        maxRetriesPerRequest: null,
    },
    GITHUB_EVENT_QUEUE: 'github-event-processing-test',
    queueConnection: {
        quit: jest.fn<() => Promise<void>>().mockResolvedValue(),
    },
}));

jest.unstable_mockModule('../../src/services/github-ips.js', () => ({
    getGitHubIPs: jest.fn<() => Promise<string[]>>().mockResolvedValue(['127.0.0.1/32']),
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
            payload: {
                action: 'requested',
                workflow_run: {
                    id: 12345,
                    name: 'test-workflow',
                    status: 'queued',
                    conclusion: null,
                    head_branch: 'main',
                    head_sha: 'sha123',
                    created_at: '2023-01-01T00:00:00Z',
                    updated_at: '2023-01-01T00:00:00Z',
                    run_started_at: '2023-01-01T00:00:00Z',
                },
                repository: {
                    id: 1,
                    full_name: 'test/repo',
                    html_url: 'https://github.com/test/repo',
                }
            },
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
