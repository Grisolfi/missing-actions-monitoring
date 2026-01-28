import { jest } from '@jest/globals';

// Mocks
jest.unstable_mockModule('../../src/models/prisma.js', () => ({
    prisma: {
        webhookEvent: {
            findUnique: jest.fn(),
        },
        workflowRun: {
            upsert: jest.fn(),
        },
        workflowJob: {
            upsert: jest.fn(),
        },
        $transaction: jest.fn((callback: any) => callback({
            workflowRun: { upsert: jest.fn() },
            workflowJob: { upsert: jest.fn() },
        })),
    },
}));

jest.unstable_mockModule('../../src/models/event.js', () => ({
    updateWebhookEventStatus: jest.fn(),
}));

const { processGithubEvent } = await import('../../src/services/processor.js');
const { prisma } = await import('../../src/models/prisma.js');

describe('processGithubEvent', () => {
    it('should process workflow_run event', async () => {
        const mockEvent = {
            id: 'event-1',
            eventType: 'workflow_run',
            status: 'PENDING',
            payload: {
                workflow_run: {
                    id: 12345,
                    status: 'in_progress',
                    run_started_at: '2026-01-01T00:00:00Z',
                    created_at: '2026-01-01T00:00:00Z',
                    name: 'CI',
                },
                repository: {
                    full_name: 'org/repo',
                },
            },
        };

        (prisma.webhookEvent.findUnique as any).mockResolvedValue(mockEvent);

        await processGithubEvent('event-1');

        expect(prisma.$transaction).toHaveBeenCalled();
    });
});
