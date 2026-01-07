import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function maskUrl(url: string) {
    try {
        const u = new URL(url);
        return `${u.protocol}//${u.hostname}${u.pathname.length > 1 ? "/..." : ""}`;
    } catch {
        return "invalid-url";
    }
}

async function fetchWithTimeout(url: string, init: RequestInit, ms = 6000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);
    try {
        const t0 = Date.now();
        const res = await fetch(url, { ...init, signal: controller.signal });
        const t1 = Date.now();
        return { res, latency: t1 - t0 };
    } finally {
        clearTimeout(id);
    }
}

serve(async (req) => {
    try {
        const body = await req.json().catch(() => ({}));
        const team_id = body.team_id as string | undefined;
        if (!team_id) {
            return new Response(JSON.stringify({ ok: false, error: "Missing team_id" }), { status: 400 });
        }

        // Service role (server-side only)
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, serviceKey);

        // 1) Load instance config
        const { data: inst, error: instErr } = await supabase
            .from("wa_instances")
            .select("id, team_id, evolution_instance_key, evolution_base_url, evolution_api_key, status, created_at, updated_at")
            .eq("team_id", team_id)
            .maybeSingle();

        if (instErr) throw instErr;

        if (!inst || !inst.evolution_base_url || !inst.evolution_api_key || !inst.evolution_instance_key) {
            return new Response(JSON.stringify({
                ok: true,
                team_id,
                provider: "evolution",
                server: { reachable: false, base_url_masked: inst?.evolution_base_url ? maskUrl(inst.evolution_base_url) : null, latency_ms: null },
                instance: { configured: false, key: inst?.evolution_instance_key ?? null, status: "NOT_CONFIGURED", details: null },
                auth: { valid: false, http_status: null },
                error: null,
            }), { headers: { "Content-Type": "application/json" } });
        }

        const baseUrl = inst.evolution_base_url.replace(/\/+$/, ""); // trim trailing /
        const headers = {
            "Content-Type": "application/json",
            "apikey": inst.evolution_api_key,
        };

        // 2) Ping server (endpoint pode variar; mantenha simples)
        let serverReachable = false;
        let serverLatency: number | null = null;
        let serverHttp: number | null = null;

        const pingCandidates = [`${baseUrl}/health`, `${baseUrl}/`];
        for (const pingUrl of pingCandidates) {
            try {
                const { res, latency } = await fetchWithTimeout(pingUrl, { method: "GET", headers }, 6000);
                serverHttp = res.status;
                serverLatency = latency;
                serverReachable = true;
                break;
            } catch {
                // try next
            }
        }

        // 3) Instance status
        const statusCandidates = [
            `${baseUrl}/instance/connectionState/${encodeURIComponent(inst.evolution_instance_key)}`,
            `${baseUrl}/instance/status/${encodeURIComponent(inst.evolution_instance_key)}`
        ];

        let instanceStatus: "CONNECTED" | "DISCONNECTED" | "NOT_FOUND" | "UNKNOWN" = "UNKNOWN";
        let authValid = true;
        let authHttp: number | null = null;
        let details: any = null;

        for (const stUrl of statusCandidates) {
            try {
                const { res } = await fetchWithTimeout(stUrl, { method: "GET", headers }, 6000);
                authHttp = res.status;

                if (res.status === 401 || res.status === 403) {
                    authValid = false;
                    instanceStatus = "UNKNOWN";
                    details = { message: "Auth rejected", http_status: res.status };
                    break;
                }

                if (res.status === 404) {
                    instanceStatus = "NOT_FOUND";
                    details = { message: "Instance not found", http_status: 404 };
                    break;
                }

                const json = await res.json().catch(() => ({}));
                details = json;

                // heurística: detecta conectado
                const txt = JSON.stringify(json).toLowerCase();
                if (txt.includes("open") || txt.includes("connected") || txt.includes("online")) instanceStatus = "CONNECTED";
                else if (txt.includes("close") || txt.includes("disconnected") || txt.includes("offline")) instanceStatus = "DISCONNECTED";
                else instanceStatus = "UNKNOWN";

                break;
            } catch (e) {
                details = { message: "Timeout or network error", error: String(e) };
            }
        }

        return new Response(JSON.stringify({
            ok: true,
            team_id,
            provider: "evolution",
            server: {
                reachable: serverReachable,
                base_url_masked: maskUrl(baseUrl),
                latency_ms: serverLatency,
                http_status: serverHttp,
            },
            instance: {
                configured: true,
                key: inst.evolution_instance_key,
                status: instanceStatus,
                details,
            },
            auth: {
                valid: authValid,
                http_status: authHttp,
            },
            error: null,
        }), { headers: { "Content-Type": "application/json" } });

    } catch (e) {
        return new Response(JSON.stringify({ ok: false, error: (e as Error).message ?? String(e) }), { status: 500 });
    }
});
