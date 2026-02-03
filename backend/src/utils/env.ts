import { config } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, '../../.env') });

export const env = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: Number(process.env.PORT) || 3000,
    DATABASE_URL: process.env.DATABASE_URL || '',
    REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
    RATE_LIMIT_MAX: Number(process.env.RATE_LIMIT_MAX) || 100,
    RATE_LIMIT_WINDOW_MS: Number(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
    DASHBOARD_API_KEY: process.env.DASHBOARD_API_KEY || '',
    GITHUB_WEBHOOK_SECRET: process.env.GITHUB_WEBHOOK_SECRET || '',
    DATABASE_POOL_MAX: Number(process.env.DATABASE_POOL_MAX) || 10,
    DATABASE_IDLE_TIMEOUT: Number(process.env.DATABASE_IDLE_TIMEOUT) || 10000,
    DATABASE_CONNECTION_TIMEOUT: Number(process.env.DATABASE_CONNECTION_TIMEOUT) || 2000,
};

const requiredEnv: (keyof typeof env)[] = [
    'DATABASE_URL',
    'DASHBOARD_API_KEY',
    'GITHUB_WEBHOOK_SECRET'
];

for (const key of requiredEnv) {
    if (!env[key]) {
        if (env.NODE_ENV === 'production') {
            throw new Error(`Missing required environment variable: ${key}`);
        } else {
            console.warn(`Warning: Missing environment variable: ${key}`);
        }
    }
}
