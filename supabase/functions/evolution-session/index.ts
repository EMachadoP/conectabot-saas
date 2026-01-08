import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function fetchWithTimeout(url: string, init: RequestInit, ms = 8000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);
    try {
        return await fetch(url, { ...init, signal: controller.signal });
    } finally {
        clearTimeout(id);
    }
}

function normalizeBaseUrl(baseUrl: string) {
    return baseUrl.replace(/\/+$/, "");
}

const ALLOWED_ORIGINS = [
    "https://conectabot-saas.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000",
];

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

async function trySessionAction(
    baseUrl: string,
    apiKey: string,
    instanceKey: string,
    action: "disconnect" | "restart"
) {
    const headers = { "Content-Type": "application/json", "apikey": apiKey };

    const candidates: Array<{ method: "GET" | "POST" | "DELETE" | "PUT"; url: string; body?: any }> = [];

    if (action === "disconnect") {
        candidates.push(
            { method: "DELETE", url: `${baseUrl}/instance/logout/${encodeURIComponent(instanceKey)}` },
            { method: "POST", url: `${baseUrl}/instance/logout`, body: { instance: instanceKey } },
            { method: "DELETE", url: `${baseUrl}/instance/disconnect/${encodeURIComponent(instanceKey)}` },
            { method: "POST", url: `${baseUrl}/instance/disconnect`, body: { instance: instanceKey } },
        );
    } else if (action === "restart") {
        candidates.push(
            { method: "POST", url: `${baseUrl}/instance/restart/${encodeURIComponent(instanceKey)}` },
            { method: "POST", url: `${baseUrl}/instance/restart`, body: { instance: instanceKey } },
            { method: "PUT", url: `${baseUrl}/instance/restart/${encodeURIComponent(instanceKey)}` },
        );
    }

    let lastErr: any = null;

    for (const c of candidates) {
        try {
            const res = await fetchWithTimeout(
                c.url,
                {
                    method: c.method,
                    headers,
                    body: c.body ? JSON.stringify(c.body) : undefined,
                },
                8000
            );

            const text = await res.text();

            if (!res.ok) {
                lastErr = { http_status: res.status, body: text, tried: c.url };
                if (res.status === 401 || res.status === 403) break;
                continue;
            }

            let json: any = {};
            try { json = JSON.parse(text); } catch { json = { raw: text }; }

            return { ok: true, response: json };
        } catch (e) {
            lastErr = { error: String(e), tried: c.url };
        }
    }

    return { ok: false, error: lastErr };
}

serve(async (req) => {
    const origin = req.headers.get("Origin");

    // Preflight
    if (req.method === "OPTIONS") {
        return corsResponse({}, origin, 200);
    }

    try {
        const body = await req.json().catch(() => ({}));
        const team_id = body.team_id as string | undefined;
        const action = body.action as "disconnect" | "restart" | undefined;

        if (!team_id) {
            return corsResponse({ ok: false, error: "Missing team_id" }, origin, 400);
        }

        if (!action || !["disconnect", "restart"].includes(action)) {
            return corsResponse({ ok: false, error: "Invalid action" }, origin, 400);
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, serviceKey);

        const { data: inst, error: instErr } = await supabase
            .from("wa_instances")
            .select("id, team_id, evolution_instance_key, evolution_base_url, evolution_api_key")
            .eq("team_id", team_id)
            .maybeSingle();

        if (instErr) throw instErr;

        if (!inst || !inst.evolution_base_url || !inst.evolution_api_key || !inst.evolution_instance_key) {
            return corsResponse({ ok: false, error: "NOT_CONFIGURED" }, origin, 400);
        }

        const baseUrl = normalizeBaseUrl(inst.evolution_base_url);
        const result = await trySessionAction(baseUrl, inst.evolution_api_key, inst.evolution_instance_key, action);

        if (!result.ok) {
            await supabase.from("wa_instances").update({
                last_error: JSON.stringify(result.error),
            }).eq("id", inst.id);

            return corsResponse({
                ok: false,
                error: `${action.toUpperCase()}_FAILED`,
                details: result.error
            }, origin, 502);
        }

        // Update status based on action
        const newStatus = action === "disconnect" ? "disconnected" : "restarting";

        await supabase.from("wa_instances").update({
            status: newStatus,
            last_status: newStatus,
            last_status_at: new Date().toISOString(),
            last_error: null,
        }).eq("id", inst.id);

        return corsResponse({
            ok: true,
            action,
            team_id,
            instance_key: inst.evolution_instance_key,
            response: result.response,
        }, origin, 200);

    } catch (e) {
        console.error("evolution-session error", e);
        return corsResponse({
            ok: false,
            error: (e as Error).message ?? String(e)
        }, origin, 500);
    }
});
