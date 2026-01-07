import { supabase } from './supabase.js';
import { redis, REDIS_KEYS, redisUtils } from './redis.js';

async function pushTestJob() {
    console.log('🔍 Fetching test data from Supabase...');

    // 1. Get a real job to test
    const { data: job, error: jobError } = await supabase
        .from('reminder_jobs')
        .select('*, calendar_events(title)')
        .eq('status', 'scheduled')
        .limit(1)
        .single();

    if (jobError || !job) {
        console.error('❌ No scheduled job found to test. Run the mock data migration first.', jobError);
        return;
    }

    // 2. Get targets for this event
    const { data: targets, error: targetError } = await supabase
        .from('reminder_targets')
        .select('*')
        .eq('event_id', job.event_id);

    if (targetError || !targets || targets.length === 0) {
        console.error('❌ No targets found for event:', job.event_id);
        return;
    }

    // 3. Prepare Payload
    const payload = {
        tenant_id: job.tenant_id,
        job_id: job.id,
        event_id: job.event_id,
        attempt_no: job.attempts + 1,
        targets: targets.map(t => ({
            target_id: t.id,
            type: t.target_type,
            ref: t.target_ref,
            name: t.target_name
        })),
        message: {
            text: `Lembrete de Teste: ${(job.calendar_events as any)?.title || 'Sem Título'}. Responda OK para confirmar.`
        }
    };

    const REDIS_QUEUE = REDIS_KEYS.QUEUE;

    console.log(`Enqueuing Job ${job.id} into ${REDIS_QUEUE}...`);
    await redisUtils.lpush(REDIS_QUEUE, payload);

    console.log('✅ Success! Run "npm run worker" to see it being processed.');
    process.exit(0);
}

pushTestJob().catch(err => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
});
