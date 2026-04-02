import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";

function normalizeForComparison(text: string | null | undefined) {
  return (text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function removeRepeatedLead(previousText: string | null | undefined, nextText: string | null | undefined) {
  const previous = (previousText || '').trim();
  const next = (nextText || '').trim();

  if (!previous || !next) return next;

  const previousNormalized = normalizeForComparison(previous);
  const nextNormalized = normalizeForComparison(next);

  if (nextNormalized === previousNormalized) {
    return '';
  }

  if (!nextNormalized.startsWith(previousNormalized)) {
    return next;
  }

  const remainder = next.slice(previous.length).trimStart();
  return remainder.replace(/^[\s\-–—:]+/, '').trimStart();
}

function normalizeAgentLabel(text: string | null | undefined) {
  return (text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function resolveAgentFromText(text: string | null | undefined, agents: Array<{ id: string; name: string; email?: string | null }>) {
  const haystack = normalizeAgentLabel(text);
  if (!haystack) return null;

  for (const agent of agents) {
    const fullName = normalizeAgentLabel(agent.name);
    const firstName = fullName.split(' ')[0] || '';
    const emailPrefix = normalizeAgentLabel(agent.email?.split('@')[0] || '');

    if (fullName && haystack.includes(fullName)) return agent;
    if (firstName && firstName.length >= 4 && haystack.includes(firstName)) return agent;
    if (emailPrefix && emailPrefix.length >= 4 && haystack.includes(emailPrefix)) return agent;
  }

  return null;
}

function getLocalDateParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'long',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );

  return {
    weekday: (parts.weekday || '').toLowerCase(),
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour || '0'),
    minute: Number(parts.minute || '0'),
  };
}

function timeToMinutes(value: string | null | undefined) {
  const [hours, minutes] = (value || '00:00').split(':').map((item) => Number(item || '0'));
  return (hours * 60) + minutes;
}

function formatNextBusinessDate(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
  }).format(date);
}

function buildNextBusinessSlot(scheduleJson: any, timeZone: string, now: Date) {
  for (let offset = 0; offset < 14; offset++) {
    const candidate = new Date(now.getTime() + offset * 24 * 60 * 60 * 1000);
    const local = getLocalDateParts(candidate, timeZone);
    const exception = (scheduleJson?.exceptions || []).find((item: any) => item?.date === local.date);
    const baseDay = scheduleJson?.days?.[local.weekday];

    if (exception) {
      if (!exception.enabled) continue;
      return {
        date: candidate,
        time: exception.start || baseDay?.start || '08:00',
      };
    }

    if (!baseDay?.enabled) continue;
    return {
      date: candidate,
      time: baseDay.start || '08:00',
    };
  }

  return null;
}

function evaluateBusinessHours(scheduleJson: any, timeZone: string, now: Date) {
  const local = getLocalDateParts(now, timeZone);
  const currentMinutes = (local.hour * 60) + local.minute;
  const baseDay = scheduleJson?.days?.[local.weekday];
  const exception = (scheduleJson?.exceptions || []).find((item: any) => item?.date === local.date);

  if (exception) {
    if (!exception.enabled) {
      return {
        open: false,
        reason: 'holiday',
        holidayName: exception.name || '',
        message: exception.message || '',
        nextSlot: buildNextBusinessSlot(scheduleJson, timeZone, new Date(now.getTime() + 24 * 60 * 60 * 1000)),
      };
    }

    const startMinutes = timeToMinutes(exception.start || baseDay?.start || '08:00');
    const endMinutes = timeToMinutes(exception.end || baseDay?.end || '18:00');

    if (currentMinutes < startMinutes) {
      return {
        open: false,
        reason: 'before_hours',
        holidayName: exception.name || '',
        message: exception.message || '',
        nextSlot: buildNextBusinessSlot(scheduleJson, timeZone, now),
      };
    }

    if (currentMinutes >= endMinutes) {
      return {
        open: false,
        reason: 'after_hours',
        holidayName: exception.name || '',
        message: exception.message || '',
        nextSlot: buildNextBusinessSlot(scheduleJson, timeZone, new Date(now.getTime() + 24 * 60 * 60 * 1000)),
      };
    }

    return { open: true, reason: 'open', holidayName: exception.name || '', message: '', nextSlot: null };
  }

  if (!baseDay?.enabled) {
    return {
      open: false,
      reason: 'closed_day',
      holidayName: '',
      message: '',
      nextSlot: buildNextBusinessSlot(scheduleJson, timeZone, new Date(now.getTime() + 24 * 60 * 60 * 1000)),
    };
  }

  const startMinutes = timeToMinutes(baseDay.start);
  const endMinutes = timeToMinutes(baseDay.end);

  if (currentMinutes < startMinutes) {
    return {
      open: false,
      reason: 'before_hours',
      holidayName: '',
      message: '',
      nextSlot: buildNextBusinessSlot(scheduleJson, timeZone, now),
    };
  }

  if (currentMinutes >= endMinutes) {
    return {
      open: false,
      reason: 'after_hours',
      holidayName: '',
      message: '',
      nextSlot: buildNextBusinessSlot(scheduleJson, timeZone, new Date(now.getTime() + 24 * 60 * 60 * 1000)),
    };
  }

  return { open: true, reason: 'open', holidayName: '', message: '', nextSlot: null };
}

function renderOffhoursMessage(
  template: string,
  timeZone: string,
  nextSlot: { date: Date; time: string } | null,
  holidayName: string,
) {
  const nextBusinessDate = nextSlot ? formatNextBusinessDate(nextSlot.date, timeZone) : 'no próximo dia útil';
  const nextBusinessTime = nextSlot?.time || '08:00';

  return (template || 'Recebemos sua mensagem e retornaremos no próximo horário útil.')
    .replaceAll('{{next_business_date}}', nextBusinessDate)
    .replaceAll('{{next_business_time}}', nextBusinessTime)
    .replaceAll('{{holiday_name}}', holidayName || 'feriado')
    .trim();
}

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { conversation_id, trigger_message_id } = await req.json();
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization');

    if (!authHeader || authHeader !== `Bearer ${supabaseServiceKey}`) {
      return new Response(JSON.stringify({ error: 'Acesso interno apenas' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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

    const initialId = trigger_message_id || initialLatest?.id;

    await new Promise(r => setTimeout(r, 5000));

    const { data: checkLatest } = await supabase
      .from('messages')
      .select('id')
      .eq('conversation_id', conversation_id)
      .eq('sender_type', 'contact')
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (checkLatest && initialId && checkLatest.id !== initialId) {
      console.log('[ai-maybe-reply] Debounce: Nova mensagem detectada. Abortando.');
      await supabase.from('ai_logs').insert({
        provider: 'system',
        model: 'ai-maybe-reply',
        status: 'skipped',
        error_message: 'Debounced',
      });
      return new Response(JSON.stringify({ success: false, reason: 'Debounced' }));
    }

    const latestInboundId = checkLatest?.id || initialId;
    if (!latestInboundId) {
      await supabase.from('ai_logs').insert({
        provider: 'system',
        model: 'ai-maybe-reply',
        conversation_id: conversation_id,
        status: 'skipped',
        error_message: 'Nenhuma mensagem inbound disponível para responder',
      });
      return new Response(JSON.stringify({ success: false, reason: 'No inbound message' }));
    }

    // 2. Carregar dados da conversa e configurações
    const { data: conv } = await supabase
      .from('conversations')
      .select('id, workspace_id, contact_id, ai_mode, human_control, ai_paused_until, assigned_to, contacts(*), assigned_profile:assigned_to(name)')
      .eq('id', conversation_id)
      .single();

    if (!conv || conv.ai_mode === 'OFF') {
      await supabase.from('ai_logs').insert({
        provider: 'system',
        model: 'ai-maybe-reply',
        conversation_id: conversation_id,
        status: 'skipped',
        error_message: 'IA OFF',
      });
      return new Response(JSON.stringify({ success: false, reason: 'IA OFF' }));
    }

    const pausedUntil = conv.ai_paused_until ? new Date(conv.ai_paused_until) : null;
    const isPauseActive = pausedUntil && pausedUntil.getTime() > Date.now();

    if (isPauseActive) {
      console.log('[ai-maybe-reply] IA pausada ate:', conv.ai_paused_until);
      await supabase.from('ai_logs').insert({
        provider: 'system',
        model: 'ai-maybe-reply',
        conversation_id: conversation_id,
        status: 'skipped',
        error_message: `AI paused until ${conv.ai_paused_until}`,
      });
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

    const { data: workspaceSettings } = await supabase
      .from('ai_settings')
      .select('agent_display_name, fallback_offhours_message, timezone, schedule_json, policies_json')
      .eq('workspace_id', conv.workspace_id)
      .limit(1)
      .maybeSingle();

    const businessHours = evaluateBusinessHours(
      workspaceSettings?.schedule_json || { days: {}, exceptions: [] },
      workspaceSettings?.timezone || 'America/Fortaleza',
      new Date(),
    );

    if (!businessHours.open) {
      const fallbackMessage = renderOffhoursMessage(
        businessHours.message || workspaceSettings?.fallback_offhours_message || '',
        workspaceSettings?.timezone || 'America/Fortaleza',
        businessHours.nextSlot,
        businessHours.holidayName,
      );

      await fetch(`${supabaseUrl}/functions/v1/zapi-send-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          conversation_id,
          content: fallbackMessage,
          message_type: 'text',
          sender_name: workspaceSettings?.agent_display_name?.trim() || 'Ana Mônica',
        }),
      });

      await supabase.from('ai_logs').insert({
        provider: 'system',
        model: 'schedule-fallback',
        conversation_id,
        status: 'success',
        output_text: fallbackMessage,
        error_message: `Fallback automático por ${businessHours.reason}`,
      });

      return new Response(JSON.stringify({ success: true, reason: businessHours.reason }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
        await supabase.from('ai_logs').insert({
          provider: 'system',
          model: 'ai-maybe-reply',
          conversation_id: conversation_id,
          status: 'skipped',
          error_message: 'Role: fornecedor',
        });
        return new Response(JSON.stringify({ success: false, reason: 'Role: fornecedor' }));
      }
    }

    // 4. Buscar histórico de mensagens
    const { data: latestInboundMessage } = await supabase
      .from('messages')
      .select('id, sent_at')
      .eq('id', latestInboundId)
      .maybeSingle();

    const { data: replyAlreadySent } = await supabase
      .from('messages')
      .select('id')
      .eq('conversation_id', conversation_id)
      .eq('sender_type', 'agent')
      .gte('sent_at', latestInboundMessage?.sent_at || new Date().toISOString())
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (replyAlreadySent) {
      await supabase.from('ai_logs').insert({
        provider: 'system',
        model: 'ai-maybe-reply',
        conversation_id: conversation_id,
        status: 'skipped',
        error_message: 'Já existe resposta enviada para a última mensagem inbound',
      });
      return new Response(JSON.stringify({ success: false, reason: 'Reply already sent' }));
    }

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
      .select('sender_id, sender_name, sent_at, content')
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

    const { data: workspaceMembersRaw } = await supabase
      .from('tenant_members')
      .select('user_id, role, is_active, profiles!tenant_members_user_id_fkey(display_name, name, email)')
      .eq('tenant_id', conv.workspace_id)
      .eq('is_active', true);

    const workspaceAgents = (workspaceMembersRaw || [])
      .filter((member: any) => ['owner', 'admin', 'agent'].includes(member.role || ''))
      .map((member: any) => ({
        id: member.user_id,
        name:
          member.profiles?.display_name ||
          member.profiles?.name ||
          member.profiles?.email?.split('@')[0] ||
          'Agente',
        email: member.profiles?.email || null,
      }));

    // 5. Montar contexto complementar do workspace/conversa
    let promptContext = '';
    const isRegisteredCustomer = Boolean(
      participantState?.participants ||
      contactMemory?.contact_name ||
      contactMemory?.company_name ||
      contactMemory?.role_title,
    );

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

    promptContext += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    promptContext += `\nREGRA DE QUALIFICACAO DO ATENDIMENTO`;
    promptContext += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
    if (isRegisteredCustomer) {
      promptContext += `\nEste contato ja esta identificado/cadastrado no sistema.`;
      promptContext += `\nSeja direto e objetivo.`;
      promptContext += `\nNao repita perguntas basicas que o sistema ja conhece.`;
      promptContext += `\nPergunte apenas o que faltar para concluir a demanda atual.`;
    } else {
      promptContext += `\nEste contato ainda nao esta totalmente identificado no sistema.`;
      promptContext += `\nFaca apenas as perguntas pertinentes e minimas para avancar no atendimento.`;
      promptContext += `\nEvite interrogatorio longo ou coleta desnecessaria.`;
    }

    const assignedAgent =
      workspaceAgents.find((agent) => agent.id === conv.assigned_to) || null;
    const memoryPreferredAgent = resolveAgentFromText(contactMemory?.notes, workspaceAgents);
    const fallbackAgent =
      (lastAgentMessage?.sender_id
        ? workspaceAgents.find((agent) => agent.id === lastAgentMessage.sender_id)
        : null) ||
      resolveAgentFromText(lastAgentMessage?.sender_name, workspaceAgents);

    const preferredAgent = assignedAgent || memoryPreferredAgent || fallbackAgent || null;
    const preferredAgentName = preferredAgent?.name || null;

    if (preferredAgent && conv.assigned_to !== preferredAgent.id) {
      const nowIso = new Date().toISOString();
      const pauseUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString();

      await supabase
        .from('conversations')
        .update({
          assigned_to: preferredAgent.id,
          assigned_at: nowIso,
          status: 'open',
          human_control: true,
          ai_paused_until: pauseUntil,
        })
        .eq('id', conversation_id);

      await supabase.from('messages').insert({
        conversation_id,
        workspace_id: conv.workspace_id,
        tenant_id: conv.workspace_id,
        sender_type: 'system',
        message_type: 'system',
        content: `👥 Atribuída para ${preferredAgent.name} automaticamente. IA pausada por 30 minutos.`,
        sent_at: nowIso,
      });

      conv.assigned_to = preferredAgent.id;
      conv.assigned_profile = { name: preferredAgent.name };
      conv.human_control = true;
      conv.ai_paused_until = pauseUntil;
    }

    if (preferredAgentName) {
      promptContext += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
      promptContext += `\nDIRECIONAMENTO PRIORITARIO`;
      promptContext += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
      promptContext += `\nEste contato deve ser priorizado para ${preferredAgentName}.`;
      if (assignedAgent) {
        promptContext += `\nEssa conversa ja esta atribuida a ${preferredAgentName}.`;
      } else {
        promptContext += `\nEste contato deve ser atendido por ${preferredAgentName} conforme o historico ou memoria salva.`;
      }
      promptContext += `\nSe o cliente retomar o assunto, sinalize continuidade com esse responsavel para encurtar o atendimento.`;
    }

    promptContext += `\n\nNao cite nome de agente especifico nem diga que encaminhou para alguem se o sistema nao tiver definido um responsavel real no contexto acima.`;

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
    promptContext += `\n7. Se a conversa ja foi iniciada, nao repita mensagem de boas-vindas, apresentacao da assistente ou abertura padrao.`;

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

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      await supabase.from('ai_logs').insert({
        provider: 'system',
        model: 'ai-maybe-reply',
        conversation_id: conversation_id,
        status: 'error',
        error_message: `ai-generate-reply failed: ${errorText}`,
      });
      throw new Error(`ai-generate-reply failed: ${errorText}`);
    }

    const aiData = await aiResponse.json();
    if (!aiData.text) throw new Error('IA não gerou texto');

    const dedupedText = removeRepeatedLead(lastAgentMessage?.content, aiData.text);
    if (!dedupedText) {
      await supabase.from('ai_logs').insert({
        provider: aiData.provider || 'system',
        model: aiData.model || 'unknown',
        conversation_id: conversation_id,
        status: 'skipped',
        error_message: 'Resposta descartada por duplicar a última mensagem da assistente',
      });
      return new Response(JSON.stringify({ success: false, reason: 'Duplicated assistant message' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
        content: dedupedText,
        message_type: 'text',
        sender_name: workspaceSettings?.agent_display_name?.trim() || 'Ana Mônica',
      }),
    });

    await supabase.from('ai_logs').insert({
      provider: aiData.provider || 'system',
      model: aiData.model || 'unknown',
      conversation_id: conversation_id,
      status: 'success',
      output_text: dedupedText,
      tokens_in: aiData.tokens_in || 0,
      tokens_out: aiData.tokens_out || 0,
      latency_ms: aiData.latency_ms || null,
    });

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('[ai-maybe-reply] Erro:', error);
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      await supabase.from('ai_logs').insert({
        provider: 'system',
        model: 'ai-maybe-reply',
        status: 'error',
        error_message: error.message,
      });
    } catch (_) {}
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
