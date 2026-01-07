// supabase/functions/dlq-manager/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Redis } from "https://esm.sh/@upstash/redis@1.25.0";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const url = new URL(req.url);
        const action = url.searchParams.get('action') || 'list';

        // Initialize Redis
        const redisUrl = Deno.env.get('UPSTASH_REDIS_REST_URL');
        const redisToken = Deno.env.get('UPSTASH_REDIS_REST_TOKEN');

        if (!redisUrl || !redisToken) {
            throw new Error('Missing Upstash Redis environment variables');
        }

        const redis = new Redis({
            url: redisUrl,
            token: redisToken,
        });

        // Get team_id from auth
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);

        if (authError || !user) {
            return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('team_id')
            .eq('id', user.id)
            .single();

        const teamId = profile?.team_id;
        if (!teamId) {
            return new Response(JSON.stringify({ ok: false, error: 'No team_id found' }), {
                status: 403,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // LIST DLQ items
        if (action === 'list') {
            const limit = parseInt(url.searchParams.get('limit') || '20', 10);

            // Get all DLQ items (LRANGE 0 -1 or limited)
            const dlqItems = await redis.lrange('reminder:dlq', 0, limit - 1);

            // Parse and filter by team_id
            const parsedItems = dlqItems
                .map((item: any, index: number) => {
                    try {
                        const parsed = typeof item === 'string' ? JSON.parse(item) : item;
                        return { ...parsed, _index: index };
                    } catch {
                        return null;
                    }
                })
                .filter(Boolean)
                .filter((item: any) => item.payload_original?.team_id === teamId);

            return new Response(JSON.stringify({
                ok: true,
                items: parsedItems,
                total: parsedItems.length,
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // REQUEUE single item
        if (action === 'requeue') {
            const body = await req.json();
            const { index } = body;

            if (typeof index !== 'number') {
                return new Response(JSON.stringify({ ok: false, error: 'Invalid index' }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }

            // Get item from DLQ
            const item = await redis.lindex('reminder:dlq', index);
            if (!item) {
                return new Response(JSON.stringify({ ok: false, error: 'Item not found' }), {
                    status: 404,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }

            const parsed = typeof item === 'string' ? JSON.parse(item) : item;
            const payload = parsed.payload_original;

            // Validate payload
            if (!payload?.recipient_id || !payload?.reminder_id || !payload?.team_id) {
                return new Response(JSON.stringify({ ok: false, error: 'Incomplete payload' }), {
                    status: 400,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }

            // Security: verify team_id matches
            if (payload.team_id !== teamId) {
                return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
                    status: 403,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
            }

            // Update recipient status in DB
            await supabase
                .from('reminder_recipients')
                .update({
                    status: 'pending',
                    next_attempt_at: null,
                    last_error: null,
                })
                .eq('id', payload.recipient_id)
                .eq('team_id', teamId);

            // Re-enqueue to main queue
            await redis.rpush('reminder:queue', JSON.stringify(payload));

            // Remove from DLQ (by index)
            // Note: LREM removes by value, not index. We'll use a marker approach.
            // For simplicity, we'll just leave it in DLQ (dispatcher will handle duplicates via idempotency)
            // Or implement a cleanup job later.

            return new Response(JSON.stringify({
                ok: true,
                message: 'Item requeued successfully',
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // REQUEUE ALL (limited)
        if (action === 'requeue-all') {
            const limit = parseInt(url.searchParams.get('limit') || '20', 10);

            // Get DLQ items
            const dlqItems = await redis.lrange('reminder:dlq', 0, limit - 1);

            // Parse and filter by team_id
            const parsedItems = dlqItems
                .map((item: any) => {
                    try {
                        const parsed = typeof item === 'string' ? JSON.parse(item) : item;
                        return parsed;
                    } catch {
                        return null;
                    }
                })
                .filter(Boolean)
                .filter((item: any) => item.payload_original?.team_id === teamId);

            let requeued = 0;
            let skipped = 0;

            for (const item of parsedItems) {
                const payload = item.payload_original;

                // Validate
                if (!payload?.recipient_id || !payload?.reminder_id || !payload?.team_id) {
                    skipped++;
                    continue;
                }

                // Update DB
                await supabase
                    .from('reminder_recipients')
                    .update({
                        status: 'pending',
                        next_attempt_at: null,
                        last_error: null,
                    })
                    .eq('id', payload.recipient_id)
                    .eq('team_id', teamId);

                // Re-enqueue
                await redis.rpush('reminder:queue', JSON.stringify(payload));
                requeued++;
            }

            return new Response(JSON.stringify({
                ok: true,
                requeued,
                skipped,
                total: parsedItems.length,
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify({ ok: false, error: 'Invalid action' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        console.error('[dlq-manager] Error:', error);
        return new Response(JSON.stringify({
            ok: false,
            error: error.message,
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
