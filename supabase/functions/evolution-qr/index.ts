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

/**
 * Evolution APIs variam por versão.
 * Aqui tentamos endpoints candidatos até obter um QR.
 */
async function tryGetQr(baseUrl: string, apiKey: string, instanceKey: string) {
    const headers = { "Content-Type": "application/json", "apikey": apiKey };

    const candidates: Array<{ method: "GET" | "POST"; url: string; body?: any }> = [
        // mais comuns
        { method: "GET", url: `${baseUrl}/instance/connect/${encodeURIComponent(instanceKey)}` },
        { method: "GET", url: `${baseUrl}/instance/qrcode/${encodeURIComponent(instanceKey)}` },
        { method: "GET", url: `${baseUrl}/instance/qr/${encodeURIComponent(instanceKey)}` },

        // algumas versões exigem POST
        { method: "POST", url: `${baseUrl}/instance/connect`, body: { instance: instanceKey } },
        { method: "POST", url: `${baseUrl}/instance/qrcode`, body: { instance: instanceKey } },
    ];

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
                // 401/403: não adianta tentar outros
                if (res.status === 401 || res.status === 403) break;
                continue;
            }

            // tenta parsear
            let json: any = {};
            try { json = JSON.parse(text); } catch { json = { raw: text }; }

            // heurísticas para achar o QR (pode vir como base64, string, qr, qrcode, etc.)
            const qrBase64 =
                json?.qr ??
                json?.qrcode ??
                json?.base64 ??
                json?.data?.qr ??
                json?.data?.qrcode ??
                json?.data?.base64 ??
                null;

            if (typeof qrBase64 === "string" && qrBase64.length > 30) {
                const value = qrBase64.startsWith("data:image")
                    ? qrBase64
                    : `data:image/png;base64,${qrBase64}`;
                return { ok: true, value, raw: json };
            }

            // alguns retornam um "pairing code" ou string QR
            const qrText =
                json?.code ??
                json?.pairingCode ??
                json?.data?.code ??
                json?.data?.pairingCode ??
                json?.qrString ??
                json?.data?.qrString ??
                null;

            if (typeof qrText === "string" && qrText.length > 10) {
                return { ok: true, value: qrText, raw: json, type: "text" as const };
            }

            lastErr = { http_status: res.status, body: json, tried: c.url };
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
        if (!team_id) return corsResponse({ ok: false, error: "Missing team_id" }, origin, 400);

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, serviceKey);

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

        if (!qrRes.ok) {
            await supabase.from("wa_instances").update({
                last_error: JSON.stringify(qrRes.error),
                last_qr_at: new Date().toISOString(),
            }).eq("id", inst.id);

            return corsResponse({ ok: false, error: "QR_FAILED", details: qrRes.error }, origin, 502);
        }

        await supabase.from("wa_instances").update({
            last_error: null,
            last_qr_at: new Date().toISOString(),
        }).eq("id", inst.id);

        const qrType = (qrRes as any).type === "text" ? "text" : "image_base64";

        return corsResponse({
            ok: true,
            team_id,
            instance_key: inst.evolution_instance_key,
            qr: { type: qrType, value: qrRes.value },
            raw: (qrRes as any).raw ?? null
        }, origin, 200);

    } catch (e) {
        console.error("evolution-qr error", e);
        return corsResponse({ ok: false, error: (e as Error).message ?? String(e) }, origin, 500);
    }
});
