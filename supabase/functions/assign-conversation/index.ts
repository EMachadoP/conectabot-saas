import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ASSIGNABLE_ROLES = new Set(["owner", "admin", "agent"]);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Não autorizado");
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      throw new Error("Token inválido");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { conversation_id, agent_id } = await req.json();
    if (!conversation_id || !agent_id) {
      throw new Error("Conversa e agente são obrigatórios");
    }

    const { data: conversation, error: conversationError } = await supabaseAdmin
      .from("conversations")
      .select("id, unread_count, workspace_id, tenant_id")
      .eq("id", conversation_id)
      .single();

    if (conversationError || !conversation) {
      throw new Error("Conversa não encontrada");
    }

    const workspaceId = conversation.workspace_id ?? conversation.tenant_id;
    if (!workspaceId) {
      throw new Error("Conversa sem workspace associado");
    }

    const { data: actorMembership, error: actorMembershipError } = await supabaseAdmin
      .from("tenant_members")
      .select("role, is_active")
      .eq("tenant_id", workspaceId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (actorMembershipError) {
      throw new Error(`Falha ao validar seu acesso ao workspace: ${actorMembershipError.message}`);
    }

    if (!actorMembership?.is_active || !ASSIGNABLE_ROLES.has(actorMembership.role ?? "")) {
      throw new Error("Você não tem permissão para atribuir conversas neste workspace");
    }

    const { data: targetMembership, error: targetMembershipError } = await supabaseAdmin
      .from("tenant_members")
      .select("role, is_active")
      .eq("tenant_id", workspaceId)
      .eq("user_id", agent_id)
      .maybeSingle();

    if (targetMembershipError) {
      throw new Error(`Falha ao validar o agente de destino: ${targetMembershipError.message}`);
    }

    if (!targetMembership?.is_active || !ASSIGNABLE_ROLES.has(targetMembership.role ?? "")) {
      throw new Error("O usuário selecionado não está ativo neste workspace");
    }

    const { data: targetAgent, error: targetAgentError } = await supabaseAdmin
      .from("profiles")
      .select("id, name, display_name, email, is_active")
      .eq("id", agent_id)
      .maybeSingle();

    if (targetAgentError) {
      throw new Error(`Falha ao carregar perfil do agente: ${targetAgentError.message}`);
    }

    if (!targetAgent || targetAgent.is_active === false) {
      throw new Error("Agente de destino inválido ou inativo");
    }

    const nowIso = new Date().toISOString();
    const pauseUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const { error: updateConversationError } = await supabaseAdmin
      .from("conversations")
      .update({
        assigned_to: agent_id,
        assigned_at: nowIso,
        assigned_by: user.id,
        status: "open",
        resolved_at: null,
        resolved_by: null,
        human_control: true,
        ai_paused_until: pauseUntil,
        unread_count: Math.max(conversation.unread_count || 0, 1),
      })
      .eq("id", conversation_id);

    if (updateConversationError) {
      throw new Error(`Falha ao atribuir conversa: ${updateConversationError.message}`);
    }

    const { data: actor } = await supabaseAdmin
      .from("profiles")
      .select("name, display_name, email")
      .eq("id", user.id)
      .maybeSingle();

    const actorName = actor?.display_name || actor?.name || actor?.email || "sistema";
    const targetName =
      targetAgent.display_name || targetAgent.name || targetAgent.email || "agente";

    const { error: systemMessageError } = await supabaseAdmin
      .from("messages")
      .insert({
        conversation_id,
        workspace_id: workspaceId,
        tenant_id: workspaceId,
        sender_type: "system",
        message_type: "system",
        content: `👥 Atribuída para ${targetName} por ${actorName}. IA pausada por 30 minutos.`,
        sent_at: nowIso,
      });

    if (systemMessageError) {
      throw new Error(`Conversa atribuída, mas falhou ao registrar histórico: ${systemMessageError.message}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro inesperado";
    console.error("[assign-conversation]", message);

    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
