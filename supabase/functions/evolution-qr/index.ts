import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

async function fetchWithTimeout(url: string, init: RequestInit, ms = 5000) {
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

    headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS";
    headers["Access-Control-Allow-Headers"] = "authorization, x-client-info, apikey, content-type";

    return new Response(JSON.stringify(body), { status, headers });
}

/**
 * Evolution APIs vary by version.
 * For v2.2.3, we primarily use /instance/connect/{instanceName}.
 */
async function tryGetQr(baseUrl: string, apiKey: string, instanceKey: string) {
    const headers = { "Content-Type": "application/json", "apikey": apiKey };

    const candidates: Array<{ method: "GET" | "POST"; url: string; body?: any }> = [
        // v2.x primary endpoint
        { method: "GET", url: `${baseUrl}/instance/connect/${encodeURIComponent(instanceKey)}` },
        // fallbacks for different versions/configs
        { method: "GET", url: `${baseUrl}/instance/qrcode/${encodeURIComponent(instanceKey)}` },
    ];

    let lastErr: any = null;

    for (const c of candidates) {
        try {
            console.log(`[evolution-qr] Trying ${c.method} ${c.url}`);
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
            console.log(`[evolution-qr] Response status: ${res.status}, body length: ${text.length}`);

            if (!res.ok) {
                lastErr = { http_status: res.status, body: text, tried: c.url };
                // 401/403: don't bother trying others
                if (res.status === 401 || res.status === 403) break;
                continue;
            }

            // try parse
            let json: any = {};
            try { json = JSON.parse(text); } catch { json = { raw: text }; }

            console.log(`[evolution-qr] Parsed JSON keys: ${Object.keys(json).join(", ")}`);
            console.log(`[evolution-qr] Full response: ${JSON.stringify(json).substring(0, 500)}`);

            // [FIX] Evolution v2.2.3 returns {"count":0} when QR is not yet ready
            if (json?.count === 0) {
                console.log(`[evolution-qr] instance connect pending (count=0) for ${instanceKey}`);
                return { status: "PENDING" as const, raw: json };
            }

            // heuristics to find the QR
            const qrBase64 =
                json?.qr ??
                json?.qrcode ??
                json?.base64 ??
                json?.data?.qr ??
                json?.data?.qrcode ??
                json?.data?.base64 ??
                null;

            console.log(`[evolution-qr] qrBase64 found: ${qrBase64 ? `yes (length: ${qrBase64.length})` : "no"}`);

            if (typeof qrBase64 === "string" && qrBase64.length > 30) {
                const value = qrBase64.startsWith("data:image")
                    ? qrBase64
                    : `data:image/png;base64,${qrBase64}`;
                console.log(`[evolution-qr] Returning READY with image_base64`);
                return { status: "READY" as const, value, raw: json, type: "image_base64" as const };
            }

            // pairing code or string QR
            const qrText =
                json?.code ??
                json?.pairingCode ??
                json?.data?.code ??
                json?.data?.pairingCode ??
                json?.qrString ??
                json?.data?.qrString ??
                null;

            console.log(`[evolution-qr] qrText found: ${qrText ? `yes (length: ${qrText.length})` : "no"}`);

            if (typeof qrText === "string" && qrText.length > 10) {
                console.log(`[evolution-qr] Returning READY with text`);
                return { status: "READY" as const, value: qrText, raw: json, type: "text" as const };
            }

            console.log(`[evolution-qr] No QR found in this response, trying next endpoint`);
            lastErr = { http_status: res.status, body: json, tried: c.url };
        } catch (e) {
            console.log(`[evolution-qr] Exception: ${String(e)}`);
            lastErr = { error: String(e), tried: c.url };
        }
    }

    console.log(`[evolution-qr] All endpoints exhausted, returning ERROR`);
    return { status: "ERROR" as const, error: lastErr };
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
        const body = await req.json().catch(() => ({}));
        const team_id = body.team_id as string | undefined;
        if (!team_id) return corsResponse({ ok: false, error: "Missing team_id" }, origin, 400);

        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "https://rzlrslywbszlffmaglln.supabase.co";
        const serviceKey = Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, serviceKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        const { data: inst, error: instErr } = await supabase
            .from("wa_instances")
            .select("id, team_id, evolution_instance_key, evolution_base_url, evolution_api_key, status")
            .eq("team_id", team_id)
            .maybeSingle();

        if (instErr) throw instErr;

        if (!inst || !inst.evolution_base_url || !inst.evolution_api_key || !inst.evolution_instance_key) {
            return corsResponse({ ok: false, error: "NOT_CONFIGURED" }, origin, 400);
        }

        const baseUrl = normalizeBaseUrl(inst.evolution_base_url);
        const qrRes = await tryGetQr(baseUrl, inst.evolution_api_key, inst.evolution_instance_key);

        if (qrRes.status === "ERROR") {
            await supabase.from("wa_instances").update({
                last_error: qrRes.error,
                last_qr_requested_at: new Date().toISOString(),
                status: 'error'
            }).eq("id", inst.id);

            return corsResponse({
                ok: false,
                status: "ERROR",
                error: "QR_FAILED",
                details: qrRes.error
            }, origin, 502);
        }

        if (qrRes.status === "PENDING") {
            await supabase.from("wa_instances").update({
                last_error: null,
                last_qr_requested_at: new Date().toISOString()
            }).eq("id", inst.id);

            return corsResponse({
                ok: true,
                status: "PENDING",
                team_id,
                instance_key: inst.evolution_instance_key,
                raw: qrRes.raw
            }, origin, 200);
        }

        // Ready
        await supabase.from("wa_instances").update({
            last_error: null,
            last_qr_requested_at: new Date().toISOString(),
        }).eq("id", inst.id);

        return corsResponse({
            ok: true,
            status: "READY",
            team_id,
            instance_key: inst.evolution_instance_key,
            qr: { type: qrRes.type, value: qrRes.value },
            raw: qrRes.raw ?? null
        }, origin, 200);

    } catch (e) {
        console.error("evolution-qr error", e);
        return corsResponse({ ok: false, error: (e as Error).message ?? String(e) }, origin, 500);
    }
});
