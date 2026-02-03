import { FastifyInstance } from 'fastify';
import { dashboardSummarySchema } from '../schemas/dashboard.js';
import { prisma } from '../../models/prisma.js';
import { Prisma } from '@prisma/client';

export default async function dashboardRoutes(fastify: FastifyInstance) {
    fastify.get('/summary', {
        schema: dashboardSummarySchema
    }, async (request, reply) => {
        const { start_date, end_date, repository } = request.query as any;

        const start = start_date ? new Date(start_date) : new Date(Date.now() - 24 * 60 * 60 * 1000);
        const end = end_date ? new Date(end_date) : new Date();

        const repoFilter = repository ? Prisma.sql`AND w."repositoryName" = ${repository}` : Prisma.empty;

        const where: any = {
            startedAt: {
                gte: start,
                lte: end
            }
        };
        if (repository) {
            where.repositoryName = repository;
        }

        // 1. Current State (Always absolute, unless filtered by repo)
        const [running, queued] = await Promise.all([
            prisma.workflowRun.count({
                where: {
                    ...(repository ? { repositoryName: repository } : {}),
                    status: 'in_progress'
                }
            }),
            prisma.workflowRun.count({
                where: {
                    ...(repository ? { repositoryName: repository } : {}),
                    status: 'queued'
                }
            })
        ]);

        // 2. Aggregates
        const stats = await prisma.workflowRun.aggregate({
            _avg: {
                waitTime: true,
                duration: true
            },
            _count: {
                id: true
            },
            where: {
                ...where,
                status: 'completed'
            }
        });

        const totalCompleted = stats._count.id || 0;
        const successfulCount = await prisma.workflowRun.count({
            where: {
                ...where,
                status: 'completed',
                conclusion: 'success'
            }
        });

        const success_rate = totalCompleted > 0 ? (successfulCount / totalCompleted) * 100 : 0;

        // 1. Align dates to 30-minute boundaries in JS to ensure clean SQL buckets
        const alignToInterval = (date: Date) => {
            const ms = 1000 * 60 * 30; // 30 minutes
            return new Date(Math.floor(date.getTime() / ms) * ms);
        };

        const alignedStart = alignToInterval(start);
        const alignedEnd = alignToInterval(end);

        // 3. Time Series (30-minute buckets)
        const timeSeries: any[] = await prisma.$queryRaw`
            WITH buckets AS (
                SELECT generate_series(
                    ${alignedStart}::timestamp,
                    ${alignedEnd}::timestamp,
                    '30 minutes'::interval
                ) AS bucket_time
            )
            SELECT
                b.bucket_time as timestamp,
                COALESCE(AVG(CASE WHEN status = 'completed' THEN duration END), 0)::float as average_duration,
                COALESCE(
                    (COUNT(CASE WHEN status = 'completed' AND conclusion = 'success' THEN 1 END)::float /
                    NULLIF(COUNT(CASE WHEN status = 'completed' THEN 1 END), 0)::float) * 100,
                    0
                )::float as success_rate
            FROM buckets b
            LEFT JOIN "WorkflowRun" w ON w."startedAt" >= b.bucket_time
                AND w."startedAt" < b.bucket_time + '30 minutes'::interval
                ${repoFilter}
            GROUP BY b.bucket_time
            ORDER BY b.bucket_time ASC
        `;

        return {
            current_state: { running, queued },
            aggregates: {
                average_wait_time: stats._avg.waitTime || 0,
                average_duration: stats._avg.duration || 0,
                total_executions: totalCompleted,
                success_rate: Math.round(success_rate * 100) / 100
            },
            time_series: timeSeries.map(bucket => ({
                timestamp: bucket.timestamp.toISOString(),
                success_rate: Math.round(bucket.success_rate * 100) / 100,
                average_duration: Math.round(bucket.average_duration * 100) / 100
            }))
        };
    });
}
