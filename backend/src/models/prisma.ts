import { env } from '../utils/env.js';

const connectionString = env.DATABASE_URL;

// Use pg adapter for local development or testing (better connection pooling control)
const isLocal = (env.NODE_ENV === 'development' || env.NODE_ENV === 'test') && !connectionString?.includes('supabase.co');

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

let prisma: PrismaClient;

if (isLocal) {
    const poolConfig = {
        connectionString,
        max: env.DATABASE_POOL_MAX || 10,
        idleTimeoutMillis: env.DATABASE_IDLE_TIMEOUT || 10000,
        connectionTimeoutMillis: env.DATABASE_CONNECTION_TIMEOUT || 2000,
    };

    console.log('Postgres Pool Config (Local/Test):', { ...poolConfig, connectionString: '***' });

    const pool = new Pool(poolConfig);
    const adapter = new PrismaPg(pool);
    prisma = new PrismaClient({ adapter });
} else {
    // Production: Use native Prisma driver (Supabase has built-in pooling)
    console.log('Using native Prisma client (Production/Supabase)');
    prisma = new PrismaClient();
}

export { prisma };
