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
        if (!team_id) {
            return corsResponse({ ok: false, error: "Missing team_id" }, origin, 400);
        }

        // Service role (server-side only)
        const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "https://rzlrslywbszlffmaglln.supabase.co";
        const serviceKey = Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

        if (!serviceKey) {
            console.error("[Config] SERVICE_ROLE_KEY is MISSING in environment");
        } else {
            console.log("[Config] SERVICE_ROLE_KEY found (length:", serviceKey.length, ")");
        }

        const supabase = createClient(supabaseUrl, serviceKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        // 1) Load instance config
        const { data: dbInst, error: instErr } = await supabase
            .from("wa_instances")
            .select("id, team_id, evolution_instance_key, evolution_base_url, evolution_api_key, status, created_at, updated_at")
            .eq("team_id", team_id)
            .maybeSingle();

        if (instErr) throw instErr;

        // Support override for real-time testing before save
        const override = body.override || {};
        const inst = {
            evolution_base_url: override.base_url || dbInst?.evolution_base_url,
            evolution_api_key: override.api_key || dbInst?.evolution_api_key,
            evolution_instance_key: override.instance_key || dbInst?.evolution_instance_key,
        };

        const overrideUsed = !!body.override;
        const dbConfigured = !!(dbInst?.evolution_base_url && dbInst?.evolution_api_key && dbInst?.evolution_instance_key);
        const configured = !!(inst.evolution_base_url && inst.evolution_api_key && inst.evolution_instance_key);

        if (!configured) {
            return corsResponse({
                ok: true,
                team_id,
                provider: "evolution",
                db_configured: dbConfigured,
                override_used: overrideUsed,
                server: { reachable: false, base_url_masked: inst?.evolution_base_url ? maskUrl(inst.evolution_base_url) : null, latency_ms: null },
                instance: { configured: false, key: inst?.evolution_instance_key ?? null, status: "NOT_CONFIGURED", details: null },
                auth: { valid: false, http_status: null },
                error: "DADOS_INCOMPLETOS",
            }, origin, 200);
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

        return corsResponse({
            ok: true,
            team_id,
            provider: "evolution",
            db_configured: dbConfigured,
            override_used: overrideUsed,
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
        }, origin, 200);

    } catch (e) {
        console.error("evolution-health error", e);
        return corsResponse({ ok: false, error: (e as Error).message ?? String(e) }, origin, 500);
    }
});
