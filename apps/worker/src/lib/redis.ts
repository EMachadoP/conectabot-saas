import { Redis } from '@upstash/redis';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.error('Missing Upstash Redis environment variables');
}

export const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL || '',
    token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

export const REDIS_KEYS = {
    QUEUE: 'reminder:queue',
    lock: (jobId: string) => `lock:reminder_job:${jobId}`,
    idempotency: (jobId: string, attemptNo: number, targetId: string) =>
        `idem:reminder_attempt:${jobId}:${attemptNo}:${targetId}`,
};

export const REDIS_CONFIG = {
    LOCK_TTL: 60,
    IDEM_TTL: 7 * 24 * 60 * 60,
};
