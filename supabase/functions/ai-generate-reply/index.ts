import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- HELPERS ---

function isOperationalIssue(text: string) {
  return /(câmera|camera|cftv|dvr|gravador|nvr|port[aã]o|motor|cerca|interfone|controle de acesso|catraca|fechadura|tv coletiva|antena|acesso remoto|sem imagem|sem sinal|travado|n[aã]o abre|n[aã]o fecha|parou|quebrado|defeito)/i.test(text);
}

function looksLikeApartment(text: string) {
  return /^\s*\d{1,6}[A-Za-z]?\s*$/.test(text.trim());
}

function buildSummaryFromRecentUserMessages(msgs: { role: string; content: string }[], max = 3) {
  const users = msgs.filter(m => m.role === 'user').slice(-max).map(m => m.content);
  return users.join(' | ').slice(0, 500);
}

function getLastByRole(msgs: { role: string; content: string }[], role: string) {
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i]?.role === role) return msgs[i];
  }
  return null;
}

function sanitizePrompt(prompt: string | null | undefined) {
  if (!prompt) return "";
  return prompt.split(/EXEMPLO ERRADO|EXEMPLO DE ERRO|MIMETISMO/i)[0].trim();
}

function interpolatePrompt(template: string, variables: Record<string, string>) {
  let rendered = template;
  for (const [key, value] of Object.entries(variables)) {
    rendered = rendered.replace(new RegExp(key, 'g'), value);
  }
  return rendered;
}

function normalizeMessages(messages: any[]) {
  return messages
    .filter((message) => typeof message?.content === 'string')
    .map((message) => ({
      role: message.role === 'assistant' ? 'assistant' : message.role === 'system' ? 'system' : 'user',
      content: message.content.trim(),
    }))
    .filter((message) => message.content.length > 0)
    .slice(-50);
}

function buildDefaultSystemPrompt() {
  return Deno.env.get('AI_DEFAULT_SYSTEM_PROMPT') ||
    `Você é o assistente virtual da empresa {{company_name}}.

Atenda em português brasileiro, com clareza, objetividade e empatia.
O cliente atual chama-se {{contact_name}}.
Se houver um protocolo ativo, considere o código {{protocol_number}}.
Se o cliente pedir ajuda humana, informe que a equipe seguirá o atendimento.
Nunca invente preços, prazos ou informações não confirmadas.`;
}

function getProviderSecretName(provider: { provider: string; key_ref?: string | null }) {
  if (provider.key_ref) return provider.key_ref;
  if (provider.provider === 'openai') return 'OPENAI_API_KEY';
  if (provider.provider === 'gemini') return 'GEMINI_API_KEY';
  return '';
}

function providerSupportsModel(providerName: string, model: string) {
  if (!model) return true;
  const normalized = model.toLowerCase();

  if (providerName === 'gemini') return normalized.includes('gemini');
  if (providerName === 'openai') {
    return normalized.includes('gpt') || normalized.includes('o1') || normalized.includes('o3') || normalized.includes('o4');
  }

  return false;
}

/**
 * Executes the create-protocol edge function
 */
async function executeCreateProtocol(
  supabase: any,
  supabaseUrl: string,
  supabaseServiceKey: string,
  conversationId: string,
  participantId: string | undefined,
  args: any
) {
  // Validate conversation_id first
  if (!conversationId) {
    console.error('[TICKET] executeCreateProtocol called with empty conversationId');
    throw new Error('conversation_id is required');
  }

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(conversationId)) {
    console.error('[TICKET] Invalid conversation_id format:', conversationId);
    throw new Error(`Invalid conversation_id format: ${conversationId}`);
  }

  console.log('[TICKET] Starting protocol creation for conversation:', conversationId);

  // 1. Deep Condominium Lookup (Critical for Asana/G7)
  const { data: conv, error: convError } = await supabase
    .from('conversations')
    .select('contact_id, active_condominium_id, contacts(name)')
    .eq('id', conversationId)
    .single();

  if (convError) {
    console.error('[TICKET] Failed to fetch conversation:', convError);
    throw new Error(`Failed to fetch conversation: ${convError.message}`);
  }

  if (!conv) {
    console.error('[TICKET] Conversation not found:', conversationId);
    throw new Error(`Conversation not found: ${conversationId}`);
  }

  let condominiumId = conv?.active_condominium_id;

  if (!condominiumId) {
    const { data: part } = await supabase
      .from('conversation_participants')
      .select('entity_id')
      .eq('conversation_id', conversationId)
      .not('entity_id', 'is', null)
      .limit(1)
      .single();
    if (part) condominiumId = part.entity_id;
  }

  const bodyObj = {
    conversation_id: conversationId,
    condominium_id: condominiumId,
    participant_id: participantId, // Pass participant_id for better condominium resolution
    summary: args.summary,
    priority: args.priority || 'normal',
    category: args.category || 'operational',
    requester_name: args.requester_name || (conv?.contacts as any)?.name || 'Não informado',
    requester_role: args.requester_role || 'Morador',
    apartment: args.apartment,
    notify_group: true // IMPORTANT: Triggers WhatsApp + Asana
  };

  console.log('[TICKET] Calling create-protocol with body:', bodyObj);

  const response = await fetch(`${supabaseUrl}/functions/v1/create-protocol`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'apikey': supabaseServiceKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(bodyObj)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[TICKET] create-protocol failed with status:', response.status);
    console.error('[TICKET] Error response:', errorText);
    console.error('[TICKET] Payload sent:', JSON.stringify(bodyObj, null, 2));
    throw new Error(`Create protocol failed (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  console.log('[TICKET] create-protocol SUCCESS:', result);
  return result;
}

// --- SERVE ---

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const requireBillingAccess = async (workspaceId: string, actionType: string, quantity = 1) => {
      const { data, error } = await supabase.rpc('can_perform_action', {
        p_workspace_id: workspaceId,
        p_action_type: actionType,
        p_quantity: quantity,
      });

      if (error) {
        throw new Error(`Falha ao validar billing: ${error.message}`);
      }

      const result = Array.isArray(data) ? data[0] : data;
      if (!result?.allowed) {
        const message = result?.reason === 'subscription_inactive'
          ? 'Assinatura pendente. Regularize o pagamento para continuar usando.'
          : 'Limite do plano de IA atingido. Faça upgrade para continuar.';

        return new Response(JSON.stringify({
          error: message,
          reason: result?.reason ?? 'billing_blocked',
          plan_name: result?.plan_name ?? null,
          usage: result?.current_usage ?? null,
          limit: result?.usage_limit ?? null,
        }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return null;
    };

    const rawBody = await req.json();
    const conversationIdRaw = rawBody.conversation_id || rawBody.conversationId || rawBody.conversation?.id;
    const conversationId = (typeof conversationIdRaw === 'string') ? conversationIdRaw : undefined;
    const participant_id = rawBody.participant_id; // Extract participant_id from request
    let workspaceId = typeof rawBody.workspace_id === 'string' ? rawBody.workspace_id : undefined;

    let conversation: any = null;
    if (conversationId) {
      const { data: conversationData, error: conversationError } = await supabase
        .from('conversations')
        .select('id, workspace_id, contact_id')
        .eq('id', conversationId)
        .maybeSingle();

      if (conversationError) {
        throw new Error(`Falha ao carregar conversa: ${conversationError.message}`);
      }

      if (!conversationData) {
        throw new Error(`Conversa ${conversationId} nao encontrada`);
      }

      conversation = conversationData;
      workspaceId = workspaceId || conversation.workspace_id || undefined;
    }

    let contact: any = null;
    let workspace: any = null;
    let activeProtocol: any = null;

    if (conversation?.contact_id) {
      const { data } = await supabase
        .from('contacts')
        .select('id, name')
        .eq('id', conversation.contact_id)
        .eq('workspace_id', workspaceId)
        .maybeSingle();
      contact = data;
    }

    if (workspaceId) {
      const { data } = await supabase
        .from('workspaces')
        .select('id, name, slug')
        .eq('id', workspaceId)
        .maybeSingle();
      workspace = data;
    }

    if (conversation?.id) {
      const { data } = await supabase
        .from('protocols')
        .select('id, protocol_code')
        .eq('conversation_id', conversation.id)
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      activeProtocol = data;
    }

    const { data: workspaceSettings } = workspaceId
      ? await supabase
          .from('ai_settings')
          .select('*')
          .eq('workspace_id', workspaceId)
          .limit(1)
          .maybeSingle()
      : { data: null };

    if (workspaceId) {
      const billingBlock = await requireBillingAccess(workspaceId, 'ai_reply', 1);
      if (billingBlock) return billingBlock;
    }

    const memoryMessageCount = Math.min(
      Math.max(Number(workspaceSettings?.memory_message_count) || 10, 1),
      20,
    );

    let normalizedMessages = normalizeMessages(rawBody.messages || []);
    if (conversationId && workspaceId) {
      const { data: historyMessages, error: historyError } = await supabase
        .from('messages')
        .select('content, sender_type')
        .eq('conversation_id', conversationId)
        .eq('workspace_id', workspaceId)
        .order('sent_at', { ascending: false })
        .limit(memoryMessageCount);

      if (historyError) {
        throw new Error(`Falha ao carregar historico da conversa: ${historyError.message}`);
      }

      if (historyMessages?.length) {
        normalizedMessages = historyMessages
          .slice()
          .reverse()
          .map((message) => ({
            role: message.sender_type === 'contact' ? 'user' : 'assistant',
            content: message.content || '',
          }));
      }
    }

    const messagesNoSystem = normalizedMessages.filter((m: any) => m.role !== 'system');

    const promptTemplate = sanitizePrompt(
      rawBody.systemPrompt ||
      workspaceSettings?.system_prompt ||
      workspaceSettings?.base_system_prompt ||
      buildDefaultSystemPrompt(),
    );
    const promptContext = sanitizePrompt(rawBody.promptContext);

    const formatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: workspaceSettings?.timezone || 'America/Fortaleza',
      dateStyle: 'full',
      timeStyle: 'medium',
    });
    const currentTime = formatter.format(new Date());
    const companyName = workspace?.name || 'G7 Client Connector';
    const contactName = contact?.name || 'Cliente';
    const protocolNumber = activeProtocol?.protocol_code || 'sem protocolo ativo';
    const agentName = Deno.env.get('AI_DEFAULT_AGENT_NAME') || 'Ana Monica';

    const renderedPrompt = interpolatePrompt(promptTemplate, {
      '{{customer_name}}': contactName,
      '{{contact_name}}': contactName,
      '{{company_name}}': companyName,
      '{{agent_name}}': agentName,
      '{{protocol_number}}': protocolNumber,
      '{{current_time}}': currentTime,
      '{{timezone}}': workspaceSettings?.timezone || 'America/Fortaleza',
    });

    // Get last user message and recent context
    const lastUserMsg = getLastByRole(messagesNoSystem, 'user');
    const lastUserMsgText = (lastUserMsg?.content || "").trim();
    const recentText = messagesNoSystem.slice(-6).map((m: any) => m.content).join(" ");

    // --- TIER 4: DETERMINISTIC (Bulletproof Context-Aware) ---
    const lastIssueMsg = [...messagesNoSystem].reverse().find(m => m.role === 'user' && isOperationalIssue(m.content));
    const hasOperationalContext = isOperationalIssue(recentText);
    const aptCandidate = [...messagesNoSystem]
      .reverse()
      .find(m => m.role === "user" && looksLikeApartment(m.content))
      ?.content.trim();

    const isProvidingApartment = looksLikeApartment(lastUserMsgText) && hasOperationalContext;
    const needsApartment = /(interfone|tv|controle|apartamento|apto|unidade)/i.test(recentText);
    const canOpenNow = hasOperationalContext && (!needsApartment || Boolean(aptCandidate));

    if (conversationId && (canOpenNow || isProvidingApartment)) {
      if (needsApartment && !aptCandidate) {
        console.log('[TICKET] Deterministic block: Need apartment for issue:', lastIssueMsg?.content);
        return new Response(JSON.stringify({
          text: "Entendido. Para eu abrir o protocolo agora mesmo, me confirme por favor o número do seu apartamento.",
          finish_reason: 'NEED_APARTMENT',
          provider: 'deterministic',
          model: 'keyword-detection',
          request_id: crypto.randomUUID()
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      try {
        const ticketData = await executeCreateProtocol(supabase, supabaseUrl, supabaseServiceKey, conversationId, participant_id, {
          summary: (lastIssueMsg?.content || lastUserMsgText).slice(0, 500),
          priority: /travado|urgente|urgência|emergência/i.test(recentText) ? 'critical' : 'normal',
          apartment: aptCandidate
        });

        const protocolCode = ticketData.protocol?.protocol_code || ticketData.protocol_code;
        return new Response(JSON.stringify({
          text: `Certo. Já registrei o chamado sob o protocolo **${protocolCode}** e encaminhei para a equipe operacional. Vamos dar sequência por aqui.`,
          finish_reason: 'DETERMINISTIC_SUCCESS',
          provider: 'deterministic',
          model: 'keyword-detection',
          request_id: crypto.randomUUID()
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      } catch (e) {
        console.error("Deterministic opening failed, falling back to LLM...", e);
      }
    }

    // --- TIER 5: IA (LLM) ---

    // Final Prompt Reinforcement
    const cleanPrompt = `${renderedPrompt}

${promptContext ? `${promptContext}\n\n` : ''}Sua personalidade atual e a de um assistente dedicado ao workspace ${companyName}.

Sua única função é ajudar com problemas técnicos de condomínio.
Para registrar um problema, use SEMPRE a ferramenta 'create_protocol' IMEDIATAMENTE.
NUNCA diga que registrou o protocolo sem chamar a ferramenta.
NUNCA invente preços ou prazos.`;

    const { data: providerConfigsRaw, error: providerConfigsError } = await supabase
      .from('ai_provider_configs')
      .select('*')
      .order('created_at', { ascending: true });

    if (providerConfigsError) {
      throw new Error(`Falha ao carregar provedores de IA: ${providerConfigsError.message}`);
    }

    const providerConfigs = (providerConfigsRaw ?? []).filter(
      (config: any) => config.provider === 'openai' || config.provider === 'gemini',
    );

    if (!providerConfigs?.length) {
      throw new Error('Nenhum provedor de IA configurado. Cadastre OpenAI ou Gemini e marque um deles como ativo.');
    }

    const requestedProvider = rawBody.providerId
      ? providerConfigs.find((config: any) => config.id === rawBody.providerId) ?? null
      : null;
    const activeProvider = providerConfigs.find((config: any) => config.active) ?? null;
    const initialProvider = requestedProvider ?? activeProvider ?? providerConfigs[0];

    if (!initialProvider) throw new Error('Nenhum provedor de IA disponivel');

    const workspaceSelectedModel = typeof workspaceSettings?.model_name === 'string'
      ? workspaceSettings.model_name
      : '';
    const desiredModel = workspaceSelectedModel || initialProvider.model || '';

    const providerCandidates = providerConfigs
      .map((config: any) => {
        const secretName = getProviderSecretName(config);
        const secretValue = secretName ? Deno.env.get(secretName) : undefined;
        return {
          config,
          secretName,
          secretValue,
        };
      })
      .filter((candidate) => candidate.secretName && candidate.secretValue);

    let selectedProviderEntry = providerCandidates.find(
      (candidate) => candidate.config.id === initialProvider.id,
    );

    if (!selectedProviderEntry) {
      selectedProviderEntry = providerCandidates.find((candidate) =>
        providerSupportsModel(candidate.config.provider, desiredModel),
      ) ?? providerCandidates[0];
    }

    if (!selectedProviderEntry) {
      const expectedKeyRef = getProviderSecretName(initialProvider);
      throw new Error(`Chave de API não encontrada para ${initialProvider.provider}. Configure o secret ${expectedKeyRef}`);
    }

    const provider = selectedProviderEntry.config as any;
    const selectedModel = desiredModel && providerSupportsModel(provider.provider, desiredModel)
      ? desiredModel
      : provider.model;
    const selectedTemperature = Number(workspaceSettings?.temperature ?? provider.temperature) || 0.7;
    const apiKey = selectedProviderEntry.secretValue!;

    // Tool definition (using create_protocol as name to avoid confusion)
    const protocolTool = [{
      type: "function",
      function: {
        name: "create_protocol",
        description: "Registra tecnicamente um problema de condomínio para a equipe operacional.",
        parameters: {
          type: "object",
          properties: {
            summary: { type: "string", description: "O problema detalhado" },
            priority: { type: "string", enum: ["normal", "critical"] },
            apartment: { type: "string", description: "Apartamento (se souber)" }
          },
          required: ["summary"]
        }
      }
    }];

    let response: Response;
    if (provider.provider === 'openai') {
      response = await fetch(
        'https://api.openai.com/v1/chat/completions',
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: selectedModel,
            messages: [{ role: 'system', content: cleanPrompt }, ...messagesNoSystem],
            tools: protocolTool,
            tool_choice: 'auto',
            temperature: selectedTemperature
          })
        }
      );
    } else if (provider.provider === 'gemini') {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`;
      response = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: cleanPrompt }] },
          contents: messagesNoSystem.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
          })),
          tools: [{ functionDeclarations: [protocolTool[0].function] }],
          toolConfig: { functionCallingConfig: { mode: "AUTO" } },
          generationConfig: { temperature: selectedTemperature }
        })
      });
    } else { throw new Error(`Provedor não suportado: ${provider.provider}`); }

    if (!response.ok) throw new Error(`Erro da API de IA: ${await response.text()}`);
    const responseData = await response.json();

    let generatedText = '';
    let functionCall: any = null;
    let tokensIn = 0;
    let tokensOut = 0;

    if (provider.provider === 'gemini') {
      const candidate = responseData.candidates?.[0];
      const part = candidate?.content?.parts?.find((p: any) => p.functionCall);
      if (part) {
        functionCall = { name: part.functionCall.name, args: part.functionCall.args };
      } else {
        generatedText = candidate?.content?.parts?.[0]?.text || '';
      }
      tokensIn = responseData.usageMetadata?.promptTokenCount || 0;
      tokensOut = responseData.usageMetadata?.candidatesTokenCount || 0;
    } else {
      const msg = responseData.choices?.[0]?.message;
      if (msg?.tool_calls?.length) {
        functionCall = {
          name: msg.tool_calls[0].function.name,
          args: JSON.parse(msg.tool_calls[0].function.arguments)
        };
      } else {
        generatedText = msg?.content || '';
      }
      tokensIn = responseData.usage?.prompt_tokens || 0;
      tokensOut = responseData.usage?.completion_tokens || 0;
    }

    if (workspaceId) {
      const totalTokens = Math.max((tokensIn || 0) + (tokensOut || 0), 0);
      if (totalTokens > 0) {
        const tokenBillingBlock = await requireBillingAccess(workspaceId, 'ai_tokens', totalTokens);
        if (tokenBillingBlock) return tokenBillingBlock;
      }
    }

    // --- FALLBACK INTENT DETECTION ---
    const aiSaidWillRegister = /vou registrar|vou abrir|vou encaminhar|registrei/i.test(generatedText);
    if (!functionCall && aiSaidWillRegister) {
      console.warn('FALLBACK: Intent detected. Forcing protocol creation...');
      functionCall = {
        name: 'create_protocol',
        args: {
          summary: (lastIssueMsg?.content || buildSummaryFromRecentUserMessages(messagesNoSystem)).slice(0, 500),
          priority: /travado|urgente|urgência|emergência/i.test(recentText) ? 'critical' : 'normal',
          apartment: aptCandidate
        }
      };
    }

    // Implementation of Tool call (if triggered by AI or Fallback)
    if (functionCall && (functionCall.name === 'create_protocol' || functionCall.name === 'create_ticket')) {
      try {
        const ticketData = await executeCreateProtocol(supabase, supabaseUrl, supabaseServiceKey, conversationId!, participant_id, functionCall.args);
        const protocolCode = ticketData.protocol?.protocol_code || ticketData.protocol_code;
        generatedText = `Certo. Já registrei o chamado sob o protocolo **${protocolCode}** e encaminhei para a equipe operacional. Vamos dar sequência por aqui.`;
      } catch (e) {
        console.error('Tool call failed:', e);
        console.error('Tool call error details:', {
          conversationId,
          functionCall,
          error: e instanceof Error ? e.message : String(e),
          stack: e instanceof Error ? e.stack : undefined
        });
        // Improved fallback message - don't ask for name if we already have participant info
        generatedText = "Puxa, tive um probleminha técnico ao tentar abrir o protocolo automaticamente agora. Mas não se preocupe, eu já anotei tudo e vou passar agora mesmo para a equipe manual. Eles vão entrar em contato em breve!";
      }
    }

    if (workspaceId) {
      await supabase.rpc('record_usage', {
        p_workspace_id: workspaceId,
        p_metric_name: 'ai_tokens',
        p_quantity: Math.max((tokensIn || 0) + (tokensOut || 0), 0),
      });

      await supabase.rpc('record_usage', {
        p_workspace_id: workspaceId,
        p_metric_name: 'ai_replies',
        p_quantity: 1,
      });
    }

    return new Response(JSON.stringify({
      text: generatedText,
      provider: provider.provider,
      model: selectedModel,
      tokens_in: tokensIn,
      tokens_out: tokensOut,
      latency_ms: Date.now() - startTime,
      request_id: crypto.randomUUID()
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('AI Error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }
});
