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

    it('should calculate aggregates correctly (average wait time, duration, success rate)', async () => {
        // Mock current state counts
        mockPrisma.workflowRun.count
            .mockResolvedValueOnce(0)  // running
            .mockResolvedValueOnce(0)  // queued
            .mockResolvedValueOnce(50); // successful count

        // Mock aggregate for average wait time and duration
        mockPrisma.workflowRun.aggregate.mockResolvedValueOnce({
            _avg: {
                waitTime: 120,
                duration: 300
            },
            _count: {
                id: 100
            }
        });

        // Mock time series
        mockPrisma.$queryRaw.mockResolvedValueOnce([]);

        const response = await serverInstance.inject({
            method: 'GET',
            url: '/api/dashboard/summary',
            headers: { 'x-api-key': API_KEY }
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);

        expect(body.aggregates.average_wait_time).toBe(120);
        expect(body.aggregates.average_duration).toBe(300);
        expect(body.aggregates.total_executions).toBe(100);
        expect(body.aggregates.success_rate).toBe(50); // 50/100 * 100 = 50%
    });

    it('should handle zero completed runs (no division by zero)', async () => {
        // Mock current state counts
        mockPrisma.workflowRun.count
            .mockResolvedValueOnce(2)  // running
            .mockResolvedValueOnce(1)  // queued
            .mockResolvedValueOnce(0); // successful count (no completed runs)

        // Mock aggregate with zero completed runs
        mockPrisma.workflowRun.aggregate.mockResolvedValueOnce({
            _avg: {
                waitTime: null,
                duration: null
            },
            _count: {
                id: 0
            }
        });

        // Mock time series
        mockPrisma.$queryRaw.mockResolvedValueOnce([]);

        const response = await serverInstance.inject({
            method: 'GET',
            url: '/api/dashboard/summary',
            headers: { 'x-api-key': API_KEY }
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);

        expect(body.aggregates.average_wait_time).toBe(0);
        expect(body.aggregates.average_duration).toBe(0);
        expect(body.aggregates.total_executions).toBe(0);
        expect(body.aggregates.success_rate).toBe(0); // Should be 0, not NaN
    });

    it('should generate time-series buckets with data', async () => {
        // Mock current state counts
        mockPrisma.workflowRun.count
            .mockResolvedValueOnce(0)
            .mockResolvedValueOnce(0)
            .mockResolvedValueOnce(0);

        // Mock aggregate
        mockPrisma.workflowRun.aggregate.mockResolvedValueOnce({
            _avg: { waitTime: 0, duration: 0 },
            _count: { id: 0 }
        });

        // Mock time series with varied data
        const now = new Date();
        const bucket1 = new Date(now.getTime() - 60 * 60 * 1000); // 1 hour ago
        const bucket2 = new Date(now.getTime() - 30 * 60 * 1000); // 30 mins ago

        mockPrisma.$queryRaw.mockResolvedValueOnce([
            {
                timestamp: bucket1,
                average_duration: 250.5,
                success_rate: 85.5
            },
            {
                timestamp: bucket2,
                average_duration: 310.75,
                success_rate: 92.3
            }
        ]);

        const response = await serverInstance.inject({
            method: 'GET',
            url: '/api/dashboard/summary',
            headers: { 'x-api-key': API_KEY }
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);

        expect(body.time_series).toHaveLength(2);
        expect(body.time_series[0].average_duration).toBe(250.5);
        expect(body.time_series[0].success_rate).toBe(85.5);
        expect(body.time_series[1].average_duration).toBe(310.75);
        expect(body.time_series[1].success_rate).toBe(92.3);
    });

    it('should handle empty time-series buckets (zeroed data)', async () => {
        // Mock current state counts
        mockPrisma.workflowRun.count
            .mockResolvedValueOnce(0)
            .mockResolvedValueOnce(0)
            .mockResolvedValueOnce(0);

        // Mock aggregate
        mockPrisma.workflowRun.aggregate.mockResolvedValueOnce({
            _avg: { waitTime: 0, duration: 0 },
            _count: { id: 0 }
        });

        // Mock time series with zeroed buckets
        const now = new Date();
        const bucket1 = new Date(now.getTime() - 60 * 60 * 1000);

        mockPrisma.$queryRaw.mockResolvedValueOnce([
            {
                timestamp: bucket1,
                average_duration: 0,
                success_rate: 0
            }
        ]);

        const response = await serverInstance.inject({
            method: 'GET',
            url: '/api/dashboard/summary',
            headers: { 'x-api-key': API_KEY }
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);

        expect(body.time_series).toHaveLength(1);
        expect(body.time_series[0].average_duration).toBe(0);
        expect(body.time_series[0].success_rate).toBe(0);
    });

    it('should filter by repository when specified', async () => {
        const testRepo = 'owner/test-repo';

        // Mock current state counts with repository filter
        mockPrisma.workflowRun.count
            .mockResolvedValueOnce(3)  // running in repo
            .mockResolvedValueOnce(2)  // queued in repo
            .mockResolvedValueOnce(15); // successful in repo

        // Mock aggregate with repository filter
        mockPrisma.workflowRun.aggregate.mockResolvedValueOnce({
            _avg: {
                waitTime: 90,
                duration: 200
            },
            _count: {
                id: 30
            }
        });

        // Mock time series
        mockPrisma.$queryRaw.mockResolvedValueOnce([]);

        const response = await serverInstance.inject({
            method: 'GET',
            url: `/api/dashboard/summary?repository=${encodeURIComponent(testRepo)}`,
            headers: { 'x-api-key': API_KEY }
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);

        // Verify repository filter was applied to current state
        expect(mockPrisma.workflowRun.count).toHaveBeenCalledWith({
            where: { repositoryName: testRepo, status: 'in_progress' }
        });
        expect(mockPrisma.workflowRun.count).toHaveBeenCalledWith({
            where: { repositoryName: testRepo, status: 'queued' }
        });

        // Verify aggregate calculations
        expect(body.current_state.running).toBe(3);
        expect(body.current_state.queued).toBe(2);
        expect(body.aggregates.total_executions).toBe(30);
        expect(body.aggregates.success_rate).toBe(50); // 15/30 * 100
    });

    it('should filter by date range when specified', async () => {
        const startDate = '2024-01-01T00:00:00.000Z';
        const endDate = '2024-01-31T23:59:59.999Z';

        // Mock current state counts (not affected by date filter)
        mockPrisma.workflowRun.count
            .mockResolvedValueOnce(1)
            .mockResolvedValueOnce(1)
            .mockResolvedValueOnce(5);

        // Mock aggregate with date filter
        mockPrisma.workflowRun.aggregate.mockResolvedValueOnce({
            _avg: {
                waitTime: 60,
                duration: 150
            },
            _count: {
                id: 10
            }
        });

        // Mock time series
        mockPrisma.$queryRaw.mockResolvedValueOnce([]);

        const response = await serverInstance.inject({
            method: 'GET',
            url: `/api/dashboard/summary?start_date=${startDate}&end_date=${endDate}`,
            headers: { 'x-api-key': API_KEY }
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);

        // Verify the aggregate was called with date range
        expect(mockPrisma.workflowRun.aggregate).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    startedAt: expect.objectContaining({
                        gte: new Date(startDate),
                        lte: new Date(endDate)
                    })
                })
            })
        );

        expect(body.aggregates.total_executions).toBe(10);
        expect(body.aggregates.success_rate).toBe(50); // 5/10 * 100
    });
});
