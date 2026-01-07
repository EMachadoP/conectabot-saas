/**
 * Redis Key Structures for Upstash
 */

export const REDIS_KEYS = {
    // Queue for processing
    // Type: List or Stream
    REMINDER_QUEUE: 'reminder:queue',

    // Lock to prevent duplicate processing of the same job
    // Type: String (set with NX and EX)
    // Format: lock:reminder_job:{jobId}
    jobLock: (jobId: string) => `lock:reminder_job:${jobId}`,

    // Idempotency to prevent duplicate messages for the same attempt/target
    // Type: String (set with NX and EX)
    // Format: idem:reminder_attempt:{jobId}:{attemptNo}:{targetId}
    idempotency: (jobId: string, attemptNo: number, targetId: string) =>
        `idem:reminder_attempt:${jobId}:${attemptNo}:${targetId}`,
};

export const REDIS_CONFIG = {
    LOCK_TTL_SECONDS: 60,
    IDEM_TTL_DAYS: 7,
    IDEM_TTL_SECONDS: 7 * 24 * 60 * 60,
};
