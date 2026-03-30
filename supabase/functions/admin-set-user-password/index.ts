import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
    const workspace_id = typeof rawBody.workspace_id === 'string' && UUID_REGEX.test(rawBody.workspace_id) ? rawBody.workspace_id : null;
    const target_user_id = typeof rawBody.target_user_id === 'string' && UUID_REGEX.test(rawBody.target_user_id) ? rawBody.target_user_id : null;
    const password = typeof rawBody.password === 'string' ? rawBody.password : '';

    if (!workspace_id || !target_user_id || !password) {
      return new Response(JSON.stringify({ error: 'workspace_id, target_user_id e password são obrigatórios' }), {
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

    const { data: canManageWorkspace, error: permissionError } = await supabaseAdmin.rpc('platform_can_manage_workspace', {
      p_workspace_id: workspace_id,
      p_user_id: user.id,
    });

    if (permissionError) {
      return new Response(JSON.stringify({ error: 'Erro ao validar permissões do workspace' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!canManageWorkspace) {
      return new Response(JSON.stringify({ error: 'Acesso negado para administrar senhas deste workspace' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: memberRow, error: memberError } = await supabaseAdmin
      .from('tenant_members')
      .select('user_id')
      .eq('tenant_id', workspace_id)
      .eq('user_id', target_user_id)
      .maybeSingle();

    if (memberError) {
      return new Response(JSON.stringify({ error: 'Erro ao validar vínculo do usuário com o workspace' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!memberRow) {
      return new Response(JSON.stringify({ error: 'O usuário informado não pertence a este workspace' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(target_user_id, {
      password,
      email_confirm: true,
    });

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[ADMIN-SET-USER-PASSWORD] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
