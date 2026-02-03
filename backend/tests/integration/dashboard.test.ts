import { jest, describe, it, expect, beforeAll, afterAll } from '@jest/globals';

// Mocks must be at the top level for ESM
jest.unstable_mockModule('bullmq', () => ({
    Queue: jest.fn<any>().mockImplementation(() => ({
        add: jest.fn<any>().mockResolvedValue({}),
        close: jest.fn<any>().mockResolvedValue({}),
    })),
    Worker: jest.fn<any>().mockImplementation(() => ({
        on: jest.fn<any>(),
        close: jest.fn<any>().mockResolvedValue({}),
    })),
}));

jest.unstable_mockModule('ioredis', () => ({
    Redis: jest.fn<any>().mockImplementation(() => ({
        on: jest.fn<any>(),
        quit: jest.fn<any>().mockResolvedValue({}),
        defineCommand: jest.fn<any>(),
    })),
}));

const mockPrisma = {
    workflowRun: {
        deleteMany: jest.fn<any>().mockResolvedValue({ count: 0 }),
        createMany: jest.fn<any>().mockResolvedValue({ count: 0 }),
        findMany: jest.fn<any>().mockResolvedValue([]),
        count: jest.fn<any>().mockResolvedValue(0),
        aggregate: jest.fn<any>().mockResolvedValue({ _avg: { waitTime: 0, duration: 0 }, _count: 0 }),
    },
    $queryRaw: jest.fn<any>().mockResolvedValue([]),
    $disconnect: jest.fn<any>().mockResolvedValue(undefined),
};

jest.unstable_mockModule('../../src/models/prisma.js', () => ({
    prisma: mockPrisma,
}));


jest.unstable_mockModule('../../src/utils/env.js', () => ({
    env: {
        NODE_ENV: 'test',
        DASHBOARD_API_KEY: 'test-key-123',
        PORT: 3000,
        DATABASE_URL: 'postgresql://localhost:5432/test',
        REDIS_URL: 'redis://localhost:6379',
        RATE_LIMIT_MAX: 100,
        RATE_LIMIT_WINDOW_MS: 60000,
    }
}));

import { env } from '../../src/utils/env.js';
// We don't import prisma here anymore, we use mockPrisma

describe('GET /api/dashboard/summary', () => {
    let serverInstance: any;
    const API_KEY = 'test-key-123';

    beforeAll(async () => {
        // Mock env before importing server
        process.env.DASHBOARD_API_KEY = API_KEY;
        const { server } = await import('../../src/api/server.js');
        serverInstance = server;

        // Cleanup DB mock
        mockPrisma.workflowRun.deleteMany.mockResolvedValue({ count: 0 });
    });

    afterAll(async () => {
        if (serverInstance) await serverInstance.close();
        mockPrisma.workflowRun.deleteMany.mockResolvedValue({ count: 0 });
    });

    it('should return 401 if API key is missing', async () => {
        const response = await serverInstance.inject({
            method: 'GET',
            url: '/api/dashboard/summary'
        });

        expect(response.statusCode).toBe(401);
    });

    it('should return 401 if API key is invalid', async () => {
        const response = await serverInstance.inject({
            method: 'GET',
            url: '/api/dashboard/summary',
            headers: { 'x-api-key': 'wrong-key' }
        });

        expect(response.statusCode).toBe(401);
    });

    it('should return current state counts (Running & Queued)', async () => {
        mockPrisma.workflowRun.count
            .mockResolvedValueOnce(5)  // running
            .mockResolvedValueOnce(3); // queued

        const response = await serverInstance.inject({
            method: 'GET',
            url: '/api/dashboard/summary',
            headers: { 'x-api-key': API_KEY }
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);

        expect(body.current_state.running).toBe(5);
        expect(body.current_state.queued).toBe(3);

        expect(mockPrisma.workflowRun.count).toHaveBeenCalledWith({
            where: { status: 'in_progress' }
        });
        expect(mockPrisma.workflowRun.count).toHaveBeenCalledWith({
            where: { status: 'queued' }
        });
    });
});
