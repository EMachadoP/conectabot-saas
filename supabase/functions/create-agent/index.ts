import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ALLOWED_WORKSPACE_ROLES = new Set(['admin', 'agent']);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Token inválido' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rawBody = await req.json();
    const email = typeof rawBody.email === 'string' ? rawBody.email.trim().toLowerCase().slice(0, 255) : '';
    const password = typeof rawBody.password === 'string' ? rawBody.password : '';
    const name = typeof rawBody.name === 'string' ? rawBody.name.trim().slice(0, 100) : '';
    const team_id = typeof rawBody.team_id === 'string' && UUID_REGEX.test(rawBody.team_id) ? rawBody.team_id : null;
    const workspace_id = typeof rawBody.workspace_id === 'string' && UUID_REGEX.test(rawBody.workspace_id) ? rawBody.workspace_id : null;
    const workspace_role = typeof rawBody.workspace_role === 'string' ? rawBody.workspace_role.trim().toLowerCase() : 'agent';

    const { data: roles, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (rolesError) {
      return new Response(JSON.stringify({ error: 'Erro ao verificar permissões' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const isPlatformAdmin = roles?.some((entry) => entry.role === 'admin') ?? false;
    let canManageWorkspace = false;

    if (workspace_id) {
      const { data, error } = await supabaseAdmin.rpc('platform_can_manage_workspace', {
        p_workspace_id: workspace_id,
        p_user_id: user.id,
      });

      if (error) {
        return new Response(JSON.stringify({ error: 'Erro ao validar permissões do workspace' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      canManageWorkspace = Boolean(data);
    }

    if (!isPlatformAdmin && !canManageWorkspace) {
      return new Response(JSON.stringify({ error: 'Acesso negado - Requer administração da plataforma ou do workspace' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!email || !password || !name) {
      return new Response(JSON.stringify({ error: 'Email, senha e nome são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!EMAIL_REGEX.test(email)) {
      return new Response(JSON.stringify({ error: 'Formato de email inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (name.length < 2 || name.length > 100) {
      return new Response(JSON.stringify({ error: 'Nome deve ter entre 2 e 100 caracteres' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const hasMinLength = password.length >= 8;
    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);

    if (!hasMinLength || !hasLowercase || !hasUppercase || !hasNumber) {
      return new Response(JSON.stringify({ error: 'Senha deve ter pelo menos 8 caracteres, incluindo maiúsculas, minúsculas e números' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (workspace_id && !ALLOWED_WORKSPACE_ROLES.has(workspace_role)) {
      return new Response(JSON.stringify({ error: 'Permissão do workspace inválida. Use admin ou agent' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = userData.user.id;

    if (workspace_id) {
      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .upsert({
          id: userId,
          email,
          name,
          team_id,
          tenant_id: workspace_id,
          workspace_id,
          is_active: true,
        }, { onConflict: 'id' });

      if (profileError) {
        return new Response(JSON.stringify({ error: `Usuário criado, mas falhou ao preparar o perfil: ${profileError.message}` }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    } else if (team_id) {
      await supabaseAdmin
        .from('profiles')
        .update({ team_id, email, name })
        .eq('id', userId);
    }

    const { data: existingAgentRole } = await supabaseAdmin
      .from('user_roles')
      .select('user_id')
      .eq('user_id', userId)
      .eq('role', 'agent')
      .maybeSingle();

    if (!existingAgentRole) {
      await supabaseAdmin
        .from('user_roles')
        .insert({ user_id: userId, role: 'agent' });
    }

    if (workspace_id) {
      const { error: tenantMemberError } = await supabaseAdmin
        .from('tenant_members')
        .upsert({
          tenant_id: workspace_id,
          user_id: userId,
          role: workspace_role,
          is_active: true,
        }, { onConflict: 'tenant_id,user_id' });

      if (tenantMemberError) {
        return new Response(JSON.stringify({ error: `Usuário criado, mas falhou ao vincular ao workspace: ${tenantMemberError.message}` }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error: claimSyncError } = await supabaseAdmin.rpc('sync_user_workspace_claims', {
        p_user_id: userId,
      });

      if (claimSyncError) {
        console.error('[CREATE-AGENT] Warning syncing claims:', claimSyncError);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      user_id: userId,
      workspace_id,
      workspace_role: workspace_id ? workspace_role : null,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[CREATE-AGENT] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
