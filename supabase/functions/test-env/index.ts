import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(() => {
    return new Response(
        JSON.stringify({
            SUPABASE_URL: Deno.env.get("SUPABASE_URL") ?? "not set",
            SERVICE_ROLE_KEY_exists: Deno.env.get("SERVICE_ROLE_KEY") ? "YES (length: " + Deno.env.get("SERVICE_ROLE_KEY")!.length + ")" : "NO",
            SUPABASE_SERVICE_ROLE_KEY_exists: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ? "YES (length: " + Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!.length + ")" : "NO",
            SERVICE_ROLE_KEY_preview: Deno.env.get("SERVICE_ROLE_KEY")?.substring(0, 20) + "..." ?? "null",
            SUPABASE_SERVICE_ROLE_KEY_preview: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.substring(0, 20) + "..." ?? "null",
        }),
        {
            status: 200,
            headers: { "Content-Type": "application/json" }
        }
    );
});
