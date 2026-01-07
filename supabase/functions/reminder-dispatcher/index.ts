import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { Redis } from "https://esm.sh/@upstash/redis@1.25.0"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        console.log('[reminder-dispatcher] Starting pure queue dispatch...')

        // Initialize Redis
        const redisUrl = Deno.env.get('UPSTASH_REDIS_REST_URL')
        const redisToken = Deno.env.get('UPSTASH_REDIS_REST_TOKEN')

        if (!redisUrl || !redisToken) {
            throw new Error('Missing Upstash Redis environment variables')
        }

        const redis = new Redis({
            url: redisUrl,
            token: redisToken,
        })

        // Fetch recipients that are due for delivery
        // Status: pending (first attempt) or retry_scheduled (retry after failure)
        // Due: next_attempt_at is null (pending) or <= now (retry)
        const { data: recipients, error: recipientsError } = await supabase
            .from('reminder_recipients')
            .select('id, reminder_id, team_id, attempt_count')
            .in('status', ['pending', 'retry_scheduled'])
            .or('next_attempt_at.is.null,next_attempt_at.lte.' + new Date().toISOString())
            .order('next_attempt_at', { ascending: true, nullsFirst: true })
            .limit(100)

        if (recipientsError) {
            throw new Error(`Failed to fetch recipients: ${recipientsError.message}`)
        }

        if (!recipients || recipients.length === 0) {
            console.log('[reminder-dispatcher] No recipients due at this time')
            return new Response(JSON.stringify({
                ok: true,
                enqueued: 0,
                message: 'No recipients due'
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            })
        }

        console.log(`[reminder-dispatcher] Found ${recipients.length} recipients to enqueue`)

        let enqueued = 0
        let skipped = 0

        // Enqueue each recipient
        for (const recipient of recipients) {
            try {
                // Generate idempotency key (recipient_id + attempt_count)
                const idempotencyKey = `${recipient.id}:${recipient.attempt_count}`

                // Minimal payload (NO SECRETS - worker will fetch from DB)
                const payload = {
                    recipient_id: recipient.id,
                    reminder_id: recipient.reminder_id,
                    team_id: recipient.team_id,
                    attempt_no: recipient.attempt_count + 1,
                    idempotency_key: idempotencyKey,
                    enqueued_at: new Date().toISOString(),
                }

                // Push to Redis queue
                await redis.rpush('reminder:queue', JSON.stringify(payload))

                // Update recipient status to 'queued'
                await supabase
                    .from('reminder_recipients')
                    .update({
                        status: 'queued',
                        last_enqueued_at: new Date().toISOString(),
                    })
                    .eq('id', recipient.id)

                enqueued++
                console.log(`[reminder-dispatcher] Enqueued recipient ${recipient.id} (attempt ${recipient.attempt_count + 1})`)

            } catch (error: any) {
                console.error(`[reminder-dispatcher] Failed to enqueue recipient ${recipient.id}:`, error.message)
                skipped++
            }
        }

        console.log(`[reminder-dispatcher] Batch complete: ${enqueued} enqueued, ${skipped} skipped`)

        return new Response(JSON.stringify({
            ok: true,
            enqueued,
            skipped,
            total: recipients.length,
            timestamp: new Date().toISOString()
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error: any) {
        console.error('[reminder-dispatcher] Critical error:', error)
        return new Response(JSON.stringify({
            ok: false,
            error: error.message,
            timestamp: new Date().toISOString()
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        })
    }
})
