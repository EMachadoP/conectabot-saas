import dotenv from 'dotenv';
dotenv.config();

export const CONFIG = {
    SUPABASE_URL: process.env.SUPABASE_URL || '',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL || '',
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN || '',
    WHATSAPP_PROVIDER: process.env.WHATSAPP_PROVIDER || 'mock',
    EVOLUTION_BASE_URL: process.env.EVOLUTION_BASE_URL || '',
    EVOLUTION_API_KEY: process.env.EVOLUTION_API_KEY || '',
    EVOLUTION_INSTANCE: process.env.EVOLUTION_INSTANCE || '',
    WORKER_POLL_MS: parseInt(process.env.WORKER_POLL_MS || '1000', 10),
};

if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Missing Supabase configuration');
}

if (!CONFIG.UPSTASH_REDIS_REST_URL || !CONFIG.UPSTASH_REDIS_REST_TOKEN) {
    console.error('❌ Missing Upstash Redis configuration');
}
