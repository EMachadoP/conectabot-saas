import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const asanaApiKey = Deno.env.get('ASANA_API_KEY');

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    try {
        const {
            conversation_id,
            summary,
            priority = 'normal',
            category = 'operational',
            requester_name,
            requester_role,
            condominium_id: providedCondominiumId,
            contact_id
        } = await req.json();

        if (!conversation_id || !summary) {
            throw new Error('conversation_id e summary são obrigatórios');
        }

        // STEP: IDENTIFICAÇÃO DE CONDOMÍNIO (Lógica Estrita)
        let resolvedCondominiumId: string | null = null;

        // Helper to validate UUID
        const isValidUUID = (id: any) => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

        // 1. Check Input ID
        if (providedCondominiumId && isValidUUID(providedCondominiumId)) {
            const { data: c } = await supabaseAdmin.from('condominiums').select('id').eq('id', providedCondominiumId).maybeSingle();
            if (c) {
                resolvedCondominiumId = c.id;
            } else {
                // Try to map from entity name if it was actually an entity_id
                const { data: ent } = await supabaseAdmin.from('entities').select('name').eq('id', providedCondominiumId).maybeSingle();
                if (ent) {
                    const { data: mCondo } = await supabaseAdmin.from('condominiums').select('id').eq('name', ent.name).maybeSingle();
                    if (mCondo) resolvedCondominiumId = mCondo.id;
                }
            }
        }

        // 2. Fallback to Participant
        if (!resolvedCondominiumId) {
            const { data: partState } = await supabaseAdmin
                .from('conversation_participant_state')
                .select('participants(entity_id)')
                .eq('conversation_id', conversation_id)
                .maybeSingle();

            const entityId = (partState as any)?.participants?.entity_id;
            if (entityId && isValidUUID(entityId)) {
                const { data: ent } = await supabaseAdmin.from('entities').select('name').eq('id', entityId).maybeSingle();
                if (ent) {
                    const { data: mCondo } = await supabaseAdmin.from('condominiums').select('id').eq('name', ent.name).maybeSingle();
                    if (mCondo) resolvedCondominiumId = mCondo.id;
                }
            }
        }

        // 3. Fallback to Conversation
        if (!resolvedCondominiumId) {
            const { data: conv } = await supabaseAdmin
                .from('conversations')
                .select('active_condominium_id')
                .eq('id', conversation_id)
                .maybeSingle();

            if (conv?.active_condominium_id && isValidUUID(conv.active_condominium_id)) {
                resolvedCondominiumId = conv.active_condominium_id;
            }
        }

        const condominium_id = resolvedCondominiumId;
        console.log('[create-ticket] Condomínio resolvido:', condominium_id);

        const { data: conversationData } = await supabaseAdmin
            .from('conversations')
            .select('workspace_id')
            .eq('id', conversation_id)
            .single();

        const workspaceId = conversationData?.workspace_id || null;

        // IDEMPOTENCY: Check for existing open protocol on this conversation
        const { data: existingProtocol, error: checkError } = await supabaseAdmin
            .from('protocols')
            .select('id, protocol_code, status')
            .eq('conversation_id', conversation_id)
            .eq('status', 'open')
            .maybeSingle();

        if (checkError) {
            console.error('[Idempotency Check Error]', checkError);
            throw new Error(`Failed to check existing protocol: ${checkError.message}`);
        }

        // If there's already an open protocol, return it instead of creating duplicate
        if (existingProtocol) {
            console.log('[Idempotency] Existing open protocol found:', existingProtocol.protocol_code);
            return new Response(JSON.stringify({
                success: true,
                protocol_code: existingProtocol.protocol_code,
                protocol_id: existingProtocol.id,
                already_existed: true,
                whatsapp_sent: false,
                asana_created: false
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        // 1. Gerar código de protocolo único (formato: G7-YYYYMMDD-NNNN)
        const now = new Date();
        const yearMonthDay = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;

        const { count } = await supabaseAdmin
            .from('protocols')
            .select('*', { count: 'exact', head: true })
            .like('protocol_code', `G7-${yearMonthDay}-%`);

        const sequenceNumber = String((count || 0) + 1).padStart(4, '0');
        const protocol_code = `G7-${yearMonthDay}-${sequenceNumber}`;

        // 2. Buscar configurações de integração
        const { data: settings } = await supabaseAdmin
            .from('integrations_settings')
            .select('*')
            .eq('workspace_id', workspaceId)
            .limit(1)
            .maybeSingle();

        // 3. Buscar informações do condomínio (se disponível)
        let condominiumName = 'Não identificado';
        if (condominium_id) {
            const { data: condo } = await supabaseAdmin
                .from('condominiums')
                .select('name')
                .eq('id', condominium_id)
                .single();
            if (condo) condominiumName = condo.name;
        }

        // 4. Calcular prazo (D+1 para normal, mesmo dia para crítico)
        const dueDate = new Date();
        if (priority === 'critical') {
            // Crítico: mesmo dia
            dueDate.setHours(23, 59, 59);
        } else {
            // Normal: próximo dia útil
            dueDate.setDate(dueDate.getDate() + 1);
        }
        const dueDateStr = dueDate.toISOString().split('T')[0];

        // 5. Criar protocolo no banco
        const { data: protocol, error: protocolError } = await supabaseAdmin
            .from('protocols')
            .insert({
                protocol_code,
                conversation_id,
                contact_id,
                condominium_id,
                workspace_id: workspaceId,
                status: 'open',
                priority,
                category,
                summary,
                requester_name,
                requester_role,
                due_date: dueDateStr,
            })
            .select()
            .single();

        if (protocolError) throw protocolError;

        // Update conversation with protocol code for consistency
        const { error: convUpdateError } = await supabaseAdmin
            .from('conversations')
            .update({
                protocol: protocol_code,
                priority: priority || 'normal',
                active_condominium_id: condominium_id || null,
            })
            .eq('id', conversation_id);

        if (convUpdateError) {
            console.error('[Conversation Update Error]', convUpdateError);
            // Don't fail the whole request, but log it
        }

        // 4. Enviar notificação para o grupo de WhatsApp (se habilitado)
        let whatsapp_message_id = null;
        if (settings?.whatsapp_notifications_enabled && settings?.whatsapp_group_id) {
            try {
                const priorityIcon = (priority === 'critical' || priority === 'high') ? '🔴' : '🟢';
                const priorityLabel = (priority === 'critical' || priority === 'high') ? 'Urgente' : 'Normal';

                const categoryLabel = {
                    operational: 'Operacional',
                    financial: 'Financeiro',
                    support: 'Suporte',
                    admin: 'Administrativo'
                }[category || 'operational'] || 'Operacional';

                const message = `📋 *NOVO PROTOCOLO*\n\n` +
                    `🔖 *Protocolo:* ${protocol_code}\n` +
                    `🏢 *Condomínio:* ${condominiumName}\n` +
                    `👤 *Solicitante:* ${requester_name || 'Não informado'}\n` +
                    `📌 *Função:* ${requester_role || 'Não informado'}\n` +
                    `📂 *Categoria:* ${categoryLabel}\n\n` +
                    `📝 *Resumo:*\n${summary}\n\n` +
                    `${priorityIcon} *${priorityLabel}*\n` +
                    `⏰ *Prazo:* Resolver até ${dueDateStr}\n\n` +
                    `━━━━━━━━━━━━━━━━━━━━\n` +
                    `✅ Para encerrar, digite:\n${protocol_code} - Resolvido`;

                const { data: zapiSettings } = await supabaseAdmin
                    .from('zapi_settings')
                    .select('*')
                    .eq('workspace_id', workspaceId)
                    .limit(1)
                    .maybeSingle();

                const instanceId = Deno.env.get('ZAPI_INSTANCE_ID') || zapiSettings?.zapi_instance_id;
                const token = Deno.env.get('ZAPI_TOKEN') || zapiSettings?.zapi_token;
                const clientToken = Deno.env.get('ZAPI_CLIENT_TOKEN') || zapiSettings?.zapi_security_token;

                if (instanceId && token) {
                    const zapiUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`;
                    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                    if (clientToken) headers['Client-Token'] = clientToken;

                    const response = await fetch(zapiUrl, {
                        method: 'POST',
                        headers,
                        body: JSON.stringify({
                            phone: settings.whatsapp_group_id,
                            message
                        })
                    });

                    if (response.ok) {
                        const result = await response.json();
                        whatsapp_message_id = result.messageId || result.zapiMessageId;

                        // Atualizar protocolo com ID da mensagem
                        await supabaseAdmin
                            .from('protocols')
                            .update({ whatsapp_group_message_id: whatsapp_message_id })
                            .eq('id', protocol.id);
                    }
                }
            } catch (whatsappError) {
                console.error('[WhatsApp Notification Error]', whatsappError);
                // Não falhar se WhatsApp der erro
            }
        }

        // 5. Criar tarefa no Asana (se habilitado e API key disponível)
        const priorityIcon = (priority === 'critical' || priority === 'high') ? '🔴' : '🟢';
        const priorityLabel = (priority === 'critical' || priority === 'high') ? 'Urgente' : 'Normal';

        let asana_task_gid = null;
        if (settings?.asana_enabled && settings?.asana_project_id && asanaApiKey) {
            try {
                const taskData = {
                    data: {
                        name: `${condominiumName} - ${protocol_code}`,
                        notes: `**Resumo da IA:**\n` +
                            `Condomínio: ${condominiumName}\n` +
                            `Contato: ${requester_name || 'Não informado'} (${requester_role || 'Não informado'})\n` +
                            `Problema: ${summary}\n\n` +
                            `**Dados do Cliente:**\n` +
                            `- Condomínio: ${condominiumName}\n` +
                            `- Telefone: ${contact_id || 'Não informado'}\n` + // Use contact_id or fetch contact phone
                            `- Nome: ${requester_name || 'Não informado'}\n` +
                            `- Horário: ${new Date().toLocaleString('pt-BR')}\n\n` +
                            `**Prioridade:** ${priorityIcon} ${priorityLabel}`,
                        projects: [settings.asana_project_id],
                    }
                };

                const asanaResponse = await fetch('https://app.asana.com/api/1.0/tasks', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${asanaApiKey}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(taskData)
                });

                if (asanaResponse.ok) {
                    const asanaResult = await asanaResponse.json();
                    asana_task_gid = asanaResult.data.gid;

                    // Atualizar protocolo com GID do Asana
                    await supabaseAdmin
                        .from('protocols')
                        .update({ asana_task_gid })
                        .eq('id', protocol.id);
                } else {
                    const errorText = await asanaResponse.text();
                    console.error('[Asana Error]', asanaResponse.status, errorText);
                }
            } catch (asanaError) {
                console.error('[Asana Creation Error]', asanaError);
                // Não falhar se Asana der erro
            }
        }

        return new Response(JSON.stringify({
            success: true,
            protocol_code,
            protocol_id: protocol.id,
            whatsapp_sent: !!whatsapp_message_id,
            asana_created: !!asana_task_gid
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error('[Create Ticket Error]', error.message);

        // Extract conversation_id from request if available
        let conversationId = null;
        try {
            const body = await req.clone().json();
            conversationId = body.conversation_id;
        } catch { }

        try {
            await supabaseAdmin.from('ai_logs').insert({
                conversation_id: conversationId,
                status: 'error',
                error_message: `Create Ticket: ${error.message}`,
                provider: 'internal',
                model: 'create-ticket',
                input_excerpt: JSON.stringify({ conversation_id: conversationId }).substring(0, 500)
            });
        } catch (logError) {
            console.error('Failed to log error to ai_logs:', logError);
        }

        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
