import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { conversation_id } = await req.json();
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[ai-maybe-reply] Processando:', conversation_id);

    // 1. Debounce Logic: Aguardar mensagens seguidas
    console.log('[ai-maybe-reply] Iniciando debounce de 5 segundos...');

    const { data: initialLatest } = await supabase
      .from('messages')
      .select('id')
      .eq('conversation_id', conversation_id)
      .eq('sender_type', 'contact')
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const initialId = initialLatest?.id;

    await new Promise(r => setTimeout(r, 5000));

    const { data: checkLatest } = await supabase
      .from('messages')
      .select('id')
      .eq('conversation_id', conversation_id)
      .eq('sender_type', 'contact')
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (checkLatest && checkLatest.id !== initialId) {
      console.log('[ai-maybe-reply] Debounce: Nova mensagem detectada. Abortando.');
      return new Response(JSON.stringify({ success: false, reason: 'Debounced' }));
    }

    // 2. Carregar dados da conversa e configurações
    const { data: conv } = await supabase
      .from('conversations')
      .select('id, workspace_id, contact_id, ai_mode, human_control, ai_paused_until, assigned_to, contacts(*), assigned_profile:assigned_to(name)')
      .eq('id', conversation_id)
      .single();

    if (!conv || conv.ai_mode === 'OFF') {
      return new Response(JSON.stringify({ success: false, reason: 'IA OFF' }));
    }

    const pausedUntil = conv.ai_paused_until ? new Date(conv.ai_paused_until) : null;
    const isPauseActive = pausedUntil && pausedUntil.getTime() > Date.now();

    if (isPauseActive) {
      console.log('[ai-maybe-reply] IA pausada ate:', conv.ai_paused_until);
      return new Response(JSON.stringify({ success: false, reason: 'AI paused' }));
    }

    if (conv.human_control && !isPauseActive) {
      await supabase
        .from('conversations')
        .update({
          human_control: false,
          ai_paused_until: null,
        })
        .eq('id', conversation_id);
    }

    // 3. Checar papel do participante (Fornecedor)
    const { data: participantState } = await supabase
      .from('conversation_participant_state')
      .select('current_participant_id, participants(name, role_type, entity_id, entities(name))')
      .eq('conversation_id', conversation_id)
      .maybeSingle();

    if (participantState?.participants) {
      const participant = participantState.participants as any;
      if (participant.role_type === 'fornecedor') {
        console.log('[ai-maybe-reply] Bloqueando resposta automática para Fornecedor');
        return new Response(JSON.stringify({ success: false, reason: 'Role: fornecedor' }));
      }
    }

    // 4. Buscar histórico de mensagens
    const { data: msgs } = await supabase
      .from('messages')
      .select('content, sender_type, sender_name, sent_at')
      .eq('conversation_id', conversation_id)
      .order('sent_at', { ascending: false })
      .limit(30);

    const messages = (msgs || []).reverse().map(m => ({
      role: m.sender_type === 'contact' ? 'user' : 'assistant',
      content: m.content || '',
    }));

    const { data: lastAgentMessage } = await supabase
      .from('messages')
      .select('sender_id, sender_name, sent_at')
      .eq('conversation_id', conversation_id)
      .eq('sender_type', 'agent')
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: contactMemory } = await (supabase as any)
      .from('contact_memory')
      .select('contact_name, company_name, role_title, notes')
      .eq('contact_id', conv.contact_id)
      .maybeSingle();

    // 5. Montar contexto complementar do workspace/conversa
    let promptContext = '';

    if (participantState?.participants) {
      const participant = participantState.participants as any;
      const roleLabels: Record<string, string> = {
        'sindico': 'Síndico',
        'subsindico': 'Subsíndico',
        'porteiro': 'Porteiro',
        'zelador': 'Zelador',
        'morador': 'Morador',
        'administrador': 'Administrador',
        'conselheiro': 'Conselheiro',
        'funcionario': 'Funcionário',
        'supervisor_condominial': 'Supervisor Condominial',
        'visitante': 'Visitante',
        'prestador': 'Prestador de Serviço',
        'fornecedor': 'Fornecedor',
        'outro': 'Outro'
      };

      const roleLabel = roleLabels[participant.role_type] || participant.role_type;
      const condoName = participant.entities?.name || 'não especificado';

      promptContext += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
      promptContext += `\nDADOS DO REMETENTE (JA IDENTIFICADOS)`;
      promptContext += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
      promptContext += `\nNome: ${participant.name}`;
      if (participant.role_type) promptContext += `\nFuncao: ${roleLabel}`;
      if (participant.entities?.name) promptContext += `\nCondominio: ${condoName}`;
      promptContext += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

      promptContext += `\n\nINSTRUCOES CRITICAS:`;
      promptContext += `\n1. Nunca pergunte o nome do remetente. Voce ja sabe que e "${participant.name}".`;
      if (participant.role_type) promptContext += `\n2. Nunca pergunte a funcao. Voce ja sabe que e "${roleLabel}".`;
      if (participant.entities?.name) promptContext += `\n3. Nunca pergunte o condominio. Voce ja sabe que e "${condoName}".`;
      promptContext += `\n4. Use essas informacoes diretamente ao criar protocolos.`;
    }

    if (contactMemory) {
      promptContext += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
      promptContext += `\nMEMORIA ESTRUTURADA DO CONTATO`;
      promptContext += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
      if (contactMemory.contact_name) promptContext += `\nNome confirmado: ${contactMemory.contact_name}`;
      if (contactMemory.company_name) promptContext += `\nEmpresa/condominio: ${contactMemory.company_name}`;
      if (contactMemory.role_title) promptContext += `\nFuncao/cargo: ${contactMemory.role_title}`;
      if (contactMemory.notes) promptContext += `\nObservacoes: ${contactMemory.notes}`;
      promptContext += `\nUse esses dados para personalizar a resposta sem pedir novamente o que ja foi salvo.`;
    }

    const assignedAgentName = (conv.assigned_profile as any)?.name || null;
    const fallbackAgentName = lastAgentMessage?.sender_name || null;
    const preferredAgentName = assignedAgentName || fallbackAgentName;

    if (preferredAgentName) {
      promptContext += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
      promptContext += `\nDIRECIONAMENTO PRIORITARIO`;
      promptContext += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
      promptContext += `\nEste contato deve ser priorizado para ${preferredAgentName}.`;
      if (assignedAgentName) {
        promptContext += `\nEssa conversa ja esta atribuida a ${assignedAgentName}.`;
      } else {
        promptContext += `\nUltimo agente humano que falou com esse contato: ${fallbackAgentName}.`;
      }
      promptContext += `\nSe o cliente retomar o assunto, sinalize continuidade com esse responsavel para encurtar o atendimento.`;
    }

    // Add message variation instructions
    promptContext += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    promptContext += `\nREGRAS DE VARIACAO DE MENSAGENS`;
    promptContext += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    promptContext += `\nNunca repita a mesma mensagem.`;
    promptContext += `\n1. Varie a estrutura das frases.`;
    promptContext += `\n2. Use sinonimos.`;
    promptContext += `\n3. Reorganize as informacoes.`;
    promptContext += `\n4. Varie as saudacoes.`;
    promptContext += `\n5. Personalize o tom conforme o contexto.`;
    promptContext += `\n6. Considere as ultimas 30 mensagens para manter o contexto antes de responder.`;

    // 5.5. Get participant_id for protocol creation
    const { data: participantData } = await supabase
      .from('conversation_participant_state')
      .select('participant_id, participants(name, role_type, entity_id)')
      .eq('conversation_id', conversation_id)
      .maybeSingle();

    const participant_id = participantData?.participant_id;
    console.log('[ai-maybe-reply] Participant ID:', participant_id);

    // 6. Gerar resposta
    console.log('[ai-maybe-reply] Chamando geração...');
    const aiResponse = await fetch(`${supabaseUrl}/functions/v1/ai-generate-reply`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        messages,
        promptContext,
        conversation_id,
        participant_id,
        workspace_id: conv.workspace_id,
      }),
    });

    const aiData = await aiResponse.json();
    if (!aiData.text) throw new Error('IA não gerou texto');

    // 7. Enviar via Z-API
    console.log('[ai-maybe-reply] Enviando resposta via Z-API');
    await fetch(`${supabaseUrl}/functions/v1/zapi-send-message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify({
        conversation_id,
        content: aiData.text,
        message_type: 'text',
        sender_name: 'Ana Mônica'
      }),
    });

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('[ai-maybe-reply] Erro:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
