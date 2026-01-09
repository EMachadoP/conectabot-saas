// supabase/functions/dlq-manager/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Redis } from "https://esm.sh/@upstash/redis@1.25.0";

const ALLOWED_ORIGINS = [
    "https://conectabot-saas.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000",
];

const ALLOWED_ROLES = ["anon", "authenticated", "service_role"];

function getSupabaseJwt(req: Request): string | null {
    const auth = req.headers.get("Authorization");
    if (auth?.startsWith("Bearer ")) return auth.slice(7);
    return null;
}

function validateJwt(req: Request) {
    const jwt = getSupabaseJwt(req);
    if (!jwt) {
        console.log("[Auth] No JWT found in Authorization header");
        return null;
    }
    try {
        const parts = jwt.split(".");
        if (parts.length !== 3) {
            console.log("[Auth] Invalid JWT structure (parts != 3)");
            return null;
        }
        // JWT uses Base64URL
        const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const payload = JSON.parse(atob(base64));
        if (!ALLOWED_ROLES.includes(payload?.role)) {
            console.log(`[Auth] Role '${payload?.role}' not allowed`);
            return null;
        }
        return payload;
    } catch (e) {
        console.error("[Auth] JWT decode failed:", (e as Error).message);
        return null;
    }
}

function corsResponse(body: unknown, origin: string | null, status = 200) {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };

    const allowed = origin && ALLOWED_ORIGINS.includes(origin);
    if (allowed) {
        headers["Access-Control-Allow-Origin"] = origin;
        headers["Vary"] = "Origin";
    }

    headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS,PUT,DELETE";
    headers["Access-Control-Allow-Headers"] = "authorization, x-client-info, apikey, content-type";

    return new Response(JSON.stringify(body), { status, headers });
}

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "https://rzlrslywbszlffmaglln.supabase.co";
const serviceKey = Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
});

serve(async (req) => {
    const origin = req.headers.get("Origin");

    if (req.method === 'OPTIONS') {
        return corsResponse({}, origin, 200);
    }

    const userPayload = validateJwt(req);
    if (!userPayload) {
        return corsResponse({ ok: false, error: 'Unauthorized' }, origin, 401);
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

        const teamIdFromPayload = userPayload.team_id || userPayload.profile?.team_id;

        // Note: For admin/system tasks like DLQ, we usually need a real user.
        // If team_id is not in JWT payload, we might need a DB lookup.
        let teamId = teamIdFromPayload;

        if (!teamId && userPayload.sub) {
            const { data: profile } = await supabase
                .from('profiles')
                .select('team_id')
                .eq('id', userPayload.sub)
                .single();
            teamId = profile?.team_id;
        }

        if (!teamId && userPayload.role !== 'service_role') {
            return corsResponse({ ok: false, error: 'No team_id found in token or profile' }, origin, 403);
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
                .filter((item: any) => {
                    // If service_role, show all. Otherwise filter by teamId.
                    if (userPayload.role === 'service_role') return true;
                    return item.payload_original?.team_id === teamId;
                });

            return corsResponse({
                ok: true,
                items: parsedItems,
                total: parsedItems.length,
            }, origin, 200);
        }

        // REQUEUE single item
        if (action === 'requeue') {
            const body = await req.json();
            const { index } = body;

            if (typeof index !== 'number') {
                return corsResponse({ ok: false, error: 'Invalid index' }, origin, 400);
            }

            // Get item from DLQ
            const item = await redis.lindex('reminder:dlq', index);
            if (!item) {
                return corsResponse({ ok: false, error: 'Item not found' }, origin, 404);
            }

            const parsed = typeof item === 'string' ? JSON.parse(item) : item;
            const payload = parsed.payload_original;

            // Validate payload
            if (!payload?.recipient_id || !payload?.reminder_id || !payload?.team_id) {
                return corsResponse({ ok: false, error: 'Incomplete payload' }, origin, 400);
            }

            // Security: verify team_id matches
            if (payload.team_id !== teamId) {
                return corsResponse({ ok: false, error: 'Unauthorized' }, origin, 403);
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

            return corsResponse({
                ok: true,
                message: 'Item requeued successfully',
            }, origin, 200);
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

            return corsResponse({
                ok: true,
                requeued,
                skipped,
                total: parsedItems.length,
            }, origin, 200);
        }

        return corsResponse({ ok: false, error: 'Invalid action' }, origin, 400);

    } catch (error: any) {
        console.error('[dlq-manager] Error:', error);
        return corsResponse({
            ok: false,
            error: error.message,
        }, origin, 500);
    }
});
