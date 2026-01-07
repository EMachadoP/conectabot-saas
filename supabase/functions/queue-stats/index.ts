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

serve(async (req) => {
    try {
        // Env vars no Supabase (Edge Function secrets)
        const UPSTASH_REDIS_REST_URL = Deno.env.get("UPSTASH_REDIS_REST_URL") ?? "";
        const UPSTASH_REDIS_REST_TOKEN = Deno.env.get("UPSTASH_REDIS_REST_TOKEN") ?? "";

        // Permite configurar o nome da fila sem alterar código
        const REMINDER_QUEUE_KEY = Deno.env.get("REMINDER_QUEUE_KEY") ?? "reminder:queue";
        const REMINDER_DLQ_KEY = Deno.env.get("REMINDER_DLQ_KEY") ?? "reminder:dlq";

        if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
            return new Response(
                JSON.stringify({ ok: false, error: "Missing Upstash env vars" }),
                { status: 500, headers: { "Content-Type": "application/json" } },
            );
        }

        // LLEN em ambas
        const [queueLength, dlqLength] = await Promise.all([
            upstashCommand<number>(["LLEN", REMINDER_QUEUE_KEY], UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN),
            upstashCommand<number>(["LLEN", REMINDER_DLQ_KEY], UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN),
        ]);

        return new Response(
            JSON.stringify({
                ok: true,
                queueLength,
                dlqLength,
                keysUsed: { queue: REMINDER_QUEUE_KEY, dlq: REMINDER_DLQ_KEY },
            }),
            { headers: { "Content-Type": "application/json" } },
        );
    } catch (e) {
        return new Response(
            JSON.stringify({ ok: false, error: (e as Error).message ?? String(e) }),
            { status: 500, headers: { "Content-Type": "application/json" } },
        );
    }
});
