import { Redis } from '@upstash/redis';
import { CONFIG } from './config.js';

export const redis = new Redis({
    url: CONFIG.UPSTASH_REDIS_REST_URL,
    token: CONFIG.UPSTASH_REDIS_REST_TOKEN,
});

export const REDIS_KEYS = {
    QUEUE: 'reminder:queue',
    DLQ: 'reminder:dlq',
    lock: (jobId: string) => `lock:job:${jobId}`,
    idempotency: (jobId: string, attempt_no: number, target_id: string) =>
        `idem:${jobId}:${attempt_no}:${target_id}`,
};

export const REDIS_CONFIG = {
    LOCK_TTL: 60,
    IDEM_TTL: 7 * 24 * 60 * 60,
};

// Redis Helper Utilities
export const redisUtils = {
    lpush: (key: string, value: any) => redis.lpush(key, typeof value === 'string' ? value : JSON.stringify(value)),
    llen: (key: string) => redis.llen(key),
    setnx: (key: string, value: any, ttlSeconds: number) =>
        redis.set(key, typeof value === 'string' ? value : JSON.stringify(value), { nx: true, ex: ttlSeconds }),
};
