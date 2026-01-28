import { Redis } from 'ioredis';
import { redisOptions } from './queue.js';

const GITHUB_META_URL = 'https://api.github.com/meta';
const CACHE_KEY = 'github-ip-ranges';
const CACHE_TTL = 86400; // 24 hours

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', redisOptions);

export async function getGitHubIPs(): Promise<string[]> {
    // 1. Try Cache
    const cached = await redis.get(CACHE_KEY);
    if (cached) {
        return JSON.parse(cached);
    }

    // 2. Fetch from GitHub
    try {
        const response = await fetch(GITHUB_META_URL, {
            headers: { 'User-Agent': 'missing-actions-monitoring' }
        });

        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.statusText}`);
        }

        const data = await response.json();
        // We care about 'hooks' and 'actions' ranges
        const ipRanges = [...(data.hooks || []), ...(data.actions || [])];

        // 3. Cache results
        await redis.set(CACHE_KEY, JSON.stringify(ipRanges), 'EX', CACHE_TTL);

        console.log(`Successfully fetched and cached ${ipRanges.length} GitHub IP ranges.`);
        return ipRanges;
    } catch (error) {
        console.error('Failed to fetch GitHub IP ranges:', error);
        // Fallback or empty if totally failed
        return [];
    }
}
