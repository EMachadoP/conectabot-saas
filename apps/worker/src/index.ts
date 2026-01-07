import { redis, REDIS_KEYS } from './redis.js';
import { processJob, QueueItem } from './processor.js';
import { CONFIG } from './config.js';

async function main() {
    console.log(`🚀 Worker started [Provider: ${CONFIG.WHATSAPP_PROVIDER}]. Polling queue...`);

    while (true) {
        try {
            const item = await redis.rpop(REDIS_KEYS.QUEUE);

            if (item) {
                console.log('[WORKER] New item found in queue');
                await processJob(item);
                // Note: We NUNCA re-enqueue here. If it lock fails or processing fails, 
                // the dispatcher will pick it up based on its next_attempt_at.
            } else {
                await new Promise(resolve => setTimeout(resolve, CONFIG.WORKER_POLL_MS));
            }
        } catch (error) {
            console.error('[WORKER] Error in main loop:', error);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

main().catch(console.error);
