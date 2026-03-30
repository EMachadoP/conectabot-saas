import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const USERS_PAGE_SIZE = 1000;

async function findUserByEmail(
  supabaseAdmin: ReturnType<typeof createClient>,
  email: string,
) {
  let page = 1;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: USERS_PAGE_SIZE,
    });

    if (error) {
      throw error;
    }

    const matchedUser = data.users.find(
      (listedUser) => listedUser.email?.toLowerCase() === email,
    );

    if (matchedUser) {
      return matchedUser;
    }

    if (data.users.length < USERS_PAGE_SIZE) {
      return null;
    }

    page += 1;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
      return new Response(JSON.stringify({ error: "Sessão inválida ou expirada" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const role = typeof body.role === "string" ? body.role.trim().toLowerCase() : "agent";
    const workspaceId =
      typeof body.workspace_id === "string" && UUID_REGEX.test(body.workspace_id)
        ? body.workspace_id
        : null;
    const workspaceName = typeof body.workspace_name === "string" ? body.workspace_name.trim() : "";
    const redirectTo = typeof body.redirect_to === "string" && body.redirect_to.trim()
      ? body.redirect_to.trim()
      : undefined;

    if (!email || !EMAIL_REGEX.test(email)) {
      return new Response(JSON.stringify({ error: "Informe um e-mail válido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!workspaceId) {
      return new Response(JSON.stringify({ error: "Workspace inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: canManage, error: manageError } = await supabaseAdmin.rpc(
      "platform_can_manage_workspace",
      {
        p_workspace_id: workspaceId,
        p_user_id: user.id,
      },
    );

    if (manageError) {
      return new Response(JSON.stringify({ error: "Erro ao validar permissões do workspace" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!canManage) {
      return new Response(JSON.stringify({ error: "Apenas administradores da plataforma ou do workspace podem reenviar acessos" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const existingUser = await findUserByEmail(supabaseAdmin, email);
    if (!existingUser) {
      return new Response(JSON.stringify({ error: "Usuário não encontrado no Auth" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (existingUser.email_confirmed_at) {
      const { data, error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        mode: "recovery_email_sent",
        message: "E-mail de acesso reenviado com sucesso.",
        data,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const inviteMetadata = {
      company_name: workspaceName,
      workspace_id: workspaceId,
      workspace_name: workspaceName,
      workspace_role: role,
    };

    const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: inviteMetadata,
    });

    if (!inviteError) {
      return new Response(JSON.stringify({
        success: true,
        mode: "invite_email_sent",
        message: "E-mail de ativação reenviado com sucesso.",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: generatedLink, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        redirectTo,
        data: inviteMetadata,
      },
    });

    if (linkError || !generatedLink?.properties?.action_link) {
      return new Response(JSON.stringify({ error: inviteError.message || linkError?.message || "Falha ao reenviar o acesso" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      mode: "activation_link_generated",
      message: "O e-mail não pôde ser reenviado automaticamente. O link de ativação foi gerado.",
      action_link: generatedLink.properties.action_link,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro inesperado";
    console.error("[resend-user-access-email]", error);

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
