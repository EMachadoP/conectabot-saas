import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_ROLES = new Set(["admin", "agent"]);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Método não permitido" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Sessão inválida ou expirada" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const role = typeof body.role === "string" ? body.role.trim().toLowerCase() : "";
    const requestedWorkspaceId =
      typeof body.workspace_id === "string" && UUID_REGEX.test(body.workspace_id)
        ? body.workspace_id
        : null;

    if (!email || !EMAIL_REGEX.test(email)) {
      return new Response(
        JSON.stringify({ error: "Informe um e-mail válido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!ALLOWED_ROLES.has(role)) {
      return new Response(
        JSON.stringify({ error: "Role inválida. Use admin ou agent" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const metadataWorkspaceId =
      typeof user.app_metadata?.workspace_id === "string" && UUID_REGEX.test(user.app_metadata.workspace_id)
        ? user.app_metadata.workspace_id
        : typeof user.app_metadata?.tenant_id === "string" && UUID_REGEX.test(user.app_metadata.tenant_id)
        ? user.app_metadata.tenant_id
        : null;

    const workspaceId = requestedWorkspaceId || metadataWorkspaceId;
    if (!workspaceId) {
      return new Response(
        JSON.stringify({ error: "Workspace ativo não encontrado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: canManage, error: manageError } = await supabaseAdmin.rpc(
      "platform_can_manage_workspace",
      {
        p_workspace_id: workspaceId,
        p_user_id: user.id,
      },
    );

    if (manageError) {
      console.error("[invite-user] permission lookup failed", manageError);
      return new Response(
        JSON.stringify({ error: "Erro ao validar permissões do workspace" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!canManage) {
      return new Response(
        JSON.stringify({ error: "Apenas administradores da plataforma ou do workspace podem convidar membros" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: workspace, error: workspaceError } = await supabaseAdmin
      .from("tenants")
      .select("id, name")
      .eq("id", workspaceId)
      .single();

    if (workspaceError || !workspace) {
      console.error("[invite-user] workspace lookup failed", workspaceError);
      return new Response(
        JSON.stringify({ error: "Workspace não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      email,
      {
        data: {
          company_name: workspace.name,
          workspace_id: workspace.id,
          workspace_name: workspace.name,
          workspace_role: role,
        },
      },
    );

    if (inviteError || !inviteData.user) {
      console.error("[invite-user] invite failed", inviteError);
      return new Response(
        JSON.stringify({ error: inviteError?.message || "Falha ao enviar convite" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const invitedUserId = inviteData.user.id;

    const { error: memberUpsertError } = await supabaseAdmin
      .from("tenant_members")
      .upsert(
        {
          tenant_id: workspace.id,
          user_id: invitedUserId,
          role,
          is_active: true,
        },
        { onConflict: "tenant_id,user_id" },
      );

    if (memberUpsertError) {
      console.error("[invite-user] membership upsert failed", memberUpsertError);
      return new Response(
        JSON.stringify({ error: "Convite enviado, mas falhou ao vincular o usuário ao workspace" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { error: claimSyncError } = await supabaseAdmin.rpc("sync_user_workspace_claims", {
      p_user_id: invitedUserId,
    });

    if (claimSyncError) {
      console.error("[invite-user] claim sync warning", claimSyncError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        invited_user_id: invitedUserId,
        workspace_id: workspace.id,
        workspace_name: workspace.name,
        role,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    console.error("[invite-user] unexpected error", error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
