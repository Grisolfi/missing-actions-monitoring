import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;

// Use pg adapter for local development (better connection pooling control)
// For production (Supabase), use native Prisma driver
const isLocalDevelopment = process.env.NODE_ENV === 'development' && !connectionString?.includes('supabase.co');

let prisma: PrismaClient;

if (isLocalDevelopment) {
    const poolConfig = {
        connectionString,
        max: Number(process.env.DATABASE_POOL_MAX) || 10,
        idleTimeoutMillis: Number(process.env.DATABASE_IDLE_TIMEOUT) || 10000,
        connectionTimeoutMillis: Number(process.env.DATABASE_CONNECTION_TIMEOUT) || 2000,
    };

    console.log('Postgres Pool Config (Local):', { ...poolConfig, connectionString: '***' });

    const pool = new Pool(poolConfig);
    const adapter = new PrismaPg(pool);
    prisma = new PrismaClient({ adapter });
} else {
    // Production: Use native Prisma driver (Supabase has built-in pooling)
    console.log('Using native Prisma client (Production/Supabase)');
    prisma = new PrismaClient();
}

export { prisma };
