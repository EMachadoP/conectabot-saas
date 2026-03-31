import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const authHeader = req.headers.get('Authorization');

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Sessão inválida ou expirada' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { message, teamId, providerId, workspaceId } = await req.json();

    if (!message) {
      return new Response(
        JSON.stringify({ error: 'Mensagem é obrigatória' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const resolvedWorkspaceId = workspaceId || teamId || null;

    if (!resolvedWorkspaceId) {
      return new Response(
        JSON.stringify({ error: 'Workspace obrigatório para teste da IA' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: canManage, error: permissionError } = await supabase.rpc('platform_can_manage_workspace', {
      p_workspace_id: resolvedWorkspaceId,
      p_user_id: user.id,
    });

    if (permissionError) {
      return new Response(
        JSON.stringify({ error: `Erro ao validar permissão: ${permissionError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!canManage) {
      return new Response(
        JSON.stringify({ error: 'Acesso negado ao teste de IA deste workspace' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get workspace settings
    const { data: settings } = resolvedWorkspaceId
      ? await supabase
          .from('ai_settings')
          .select('*')
          .eq('workspace_id', resolvedWorkspaceId)
          .limit(1)
          .maybeSingle()
      : { data: null };

    const { data: workspace } = resolvedWorkspaceId
      ? await supabase
          .from('workspaces')
          .select('id, name')
          .eq('id', resolvedWorkspaceId)
          .maybeSingle()
      : { data: null };

    // Get team settings if provided
    let teamSettings = null;
    if (teamId) {
      const { data: ts } = await supabase
        .from('ai_team_settings')
        .select('*')
        .eq('team_id', teamId)
        .single();
      teamSettings = ts;
    }

    // Build system prompt with variables
    let systemPrompt = teamSettings?.prompt_override
      || settings?.system_prompt
      || settings?.base_system_prompt
      || 'Você é um assistente virtual profissional.';
    
    const variables: Record<string, string> = {
      '{{customer_name}}': 'Cliente Teste',
      '{{timezone}}': settings?.timezone || 'America/Fortaleza',
      '{{business_hours}}': 'Seg-Sex 08:00-18:00, Sáb 08:00-12:00',
      '{{policies}}': JSON.stringify(settings?.policies_json || {}),
      '{{company_name}}': workspace?.name || 'Empresa',
      '{{agent_name}}': 'Agente IA',
      '{{team_name}}': 'Equipe',
    };

    for (const [key, value] of Object.entries(variables)) {
      systemPrompt = systemPrompt.replace(new RegExp(key, 'g'), value);
    }

    // Call AI generate function directly with service role key authorization
    const aiGenerateUrl = `${supabaseUrl}/functions/v1/ai-generate-reply`;
    
    console.log('Calling ai-generate-reply with service role key...');
    
    const aiResponse = await fetch(aiGenerateUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: message }],
        systemPrompt,
        providerId,
        workspace_id: resolvedWorkspaceId,
        ragEnabled: false, // Disable RAG for testing
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI generate error:', aiResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: `Erro ao gerar resposta: ${errorText}` }),
        { status: aiResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();

    if (aiData.error) {
      return new Response(
        JSON.stringify({ error: aiData.error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const totalLatency = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        response: aiData.text,
        prompt_rendered: systemPrompt,
        provider: aiData.provider,
        model: aiData.model,
        tokens_in: aiData.tokens_in,
        tokens_out: aiData.tokens_out,
        latency_ms: totalLatency,
        ai_latency_ms: aiData.latency_ms,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('AI test error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
