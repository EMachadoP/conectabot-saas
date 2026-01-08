// supabase/functions/queue-stats/index.ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

type UpstashResp<T> = { result: T; error?: string };

async function upstashCommand<T>(cmd: string[], url: string, token: string): Promise<T> {
    const res = await fetch(`${url}/${cmd.map(encodeURIComponent).join("/")}`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Upstash error ${res.status}: ${text}`);
    }
    const json = (await res.json()) as UpstashResp<T>;
    return json.result;
}

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

        // Initialize Supabase client with service role key for potential fallback or additional checks
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "https://rzlrslywbszlffmaglln.supabase.co";
        const serviceKey = Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, serviceKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

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

    headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS";
    headers["Access-Control-Allow-Headers"] = "authorization, x-client-info, apikey, content-type";

    return new Response(JSON.stringify(body), { status, headers });
}

serve(async (req) => {
    const origin = req.headers.get("Origin");

    // Preflight
    if (req.method === "OPTIONS") {
        return corsResponse({}, origin, 200);
    }

    const payload = validateJwt(req);
    if (!payload) {
        return corsResponse({ ok: false, error: "Unauthorized" }, origin, 401);
    }

    try {
        // Env vars no Supabase (Edge Function secrets)
        const UPSTASH_REDIS_REST_URL = Deno.env.get("UPSTASH_REDIS_REST_URL") ?? "";
        const UPSTASH_REDIS_REST_TOKEN = Deno.env.get("UPSTASH_REDIS_REST_TOKEN") ?? "";

        // Permite configurar o nome da fila sem alterar código
        const REMINDER_QUEUE_KEY = Deno.env.get("REMINDER_QUEUE_KEY") ?? "reminder:queue";
        const REMINDER_DLQ_KEY = Deno.env.get("REMINDER_DLQ_KEY") ?? "reminder:dlq";

        if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
            console.error("Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN");
            return corsResponse({ ok: false, error: "Missing Upstash env vars. Please set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in Supabase Secrets." }, origin, 500);
        }

        // LLEN em ambas
        const [queueLength, dlqLength] = await Promise.all([
            upstashCommand<number>(["LLEN", REMINDER_QUEUE_KEY], UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN),
            upstashCommand<number>(["LLEN", REMINDER_DLQ_KEY], UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN),
        ]);

        return corsResponse({
            ok: true,
            queueLength,
            dlqLength,
            keysUsed: { queue: REMINDER_QUEUE_KEY, dlq: REMINDER_DLQ_KEY },
        }, origin, 200);
    } catch (e) {
        console.error("queue-stats error", e);
        return corsResponse({ ok: false, error: (e as Error).message ?? String(e) }, origin, 500);
    }
});
