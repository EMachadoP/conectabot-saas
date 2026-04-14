import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { Redis } from "https://esm.sh/@upstash/redis@1.25.0"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const findStickyAssignee = async (supabase: any, conversationId: string, workspaceId: string) => {
    const { data: lastAgentMessage } = await supabase
        .from('messages')
        .select('sender_id, sender_name')
        .eq('conversation_id', conversationId)
        .eq('sender_type', 'agent')
        .not('sender_id', 'is', null)
        .order('sent_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    const agentId = lastAgentMessage?.sender_id;
    if (!agentId) return null;

    const { data: membership } = await supabase
        .from('tenant_members')
        .select('user_id, role, is_active, profiles!tenant_members_user_id_fkey(display_name, name, email)')
        .eq('tenant_id', workspaceId)
        .eq('user_id', agentId)
        .maybeSingle();

    if (!membership?.is_active) return null;
    if (!['owner', 'admin', 'agent'].includes(membership.role ?? '')) return null;

    const profile = membership.profiles;
    return {
        agentId,
        agentName: profile?.display_name || profile?.name || profile?.email || lastAgentMessage.sender_name || 'agente responsável',
    };
};

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

    const now = new Date().toISOString();
    let payload: any;
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? 'https://rzlrslywbszlffmaglln.supabase.co';
    const serviceKey = Deno.env.get("SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    try {
        payload = await req.json();
        const instanceName = payload.instance;
        const eventType = payload.event;

        // --- DEBUG LOGGING ---
        await supabase.from('ai_logs').insert({
            status: 'webhook_received',
            input_excerpt: JSON.stringify(payload).substring(0, 1000),
            model: 'evolution-webhook-debug',
            provider: 'evolution',
            created_at: now
        });

        // 1. Identification & Security
        const { data: integration, error: integrationError } = await supabase
            .from('tenant_integrations')
            .select('workspace_id, webhook_secret, is_enabled')
            .eq('instance_name', instanceName)
            .eq('provider', 'evolution')
            .maybeSingle();

        if (integrationError) throw integrationError;
        if (!integration) {
            console.error(`[EVO-WEBHOOK] Instance ${instanceName} not found in tenant_integrations.`);
            return new Response(JSON.stringify({ error: "Instance not found" }), { status: 200, headers: corsHeaders });
        }

        if (!integration.is_enabled) {
            console.warn(`[EVO-WEBHOOK] Integration for instance ${instanceName} is disabled.`);
            return new Response(JSON.stringify({ error: "Integration disabled" }), { status: 200, headers: corsHeaders });
        }

        // Security Validation (Header apikey vs webhook_secret)
        const reqApiKey = req.headers.get('apikey');
        if (integration.webhook_secret && reqApiKey !== integration.webhook_secret) {
            console.error(`[EVO-WEBHOOK] Invalid Webhook Secret for instance ${instanceName}`);
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 200, headers: corsHeaders });
        }

        const workspaceId = integration.workspace_id;

        // 2. Redis Deduplication (Idempotency)
        const redisUrl = Deno.env.get('UPSTASH_REDIS_REST_URL');
        const redisToken = Deno.env.get('UPSTASH_REDIS_REST_TOKEN');
        const msgId = payload.data?.key?.id;

        if (redisUrl && redisToken && msgId) {
            const redis = new Redis({ url: redisUrl, token: redisToken });
            const isNew = await redis.set(`inbound:evolution:${msgId}`, '1', { nx: true, ex: 604800 });
            if (!isNew) {
                console.log(`[EVO-WEBHOOK] Duplicate message detected: ${msgId}`);
                return new Response(JSON.stringify({ success: true, warning: "Duplicate" }), { status: 200, headers: corsHeaders });
            }
        }

        // 3a. Process MESSAGES_UPDATE (confirmação de entrega e leitura)
        if (eventType === 'messages.update') {
            const updates = Array.isArray(payload.data) ? payload.data : [payload.data];
            for (const update of updates) {
                const providerMsgId = update?.key?.id;
                const status = update?.update?.status;
                if (!providerMsgId || !status) continue;

                const updateFields: Record<string, string> = {};
                if (status === 'DELIVERY_ACK' || status === 'SERVER_ACK') {
                    updateFields.delivered_at = now;
                } else if (status === 'READ' || status === 'PLAYED') {
                    updateFields.delivered_at = now;
                    updateFields.read_at = now;
                }

                if (Object.keys(updateFields).length > 0) {
                    const { error: updateError } = await supabase
                        .from('messages')
                        .update(updateFields)
                        .eq('provider_message_id', providerMsgId)
                        .eq('workspace_id', workspaceId);

                    if (updateError) {
                        console.error(`[EVO-WEBHOOK] Erro ao atualizar status da mensagem ${providerMsgId}:`, updateError);
                    } else {
                        console.log(`[EVO-WEBHOOK] Mensagem ${providerMsgId} atualizada: status=${status}`);
                    }
                }
            }
            return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // 3b. Process MESSAGES_UPSERT
        if (eventType === 'messages.upsert') {
            const data = payload.data;
            if (!data?.message) {
                console.log(`[EVO-WEBHOOK] Event messages.upsert received but no message content found. Ignoring.`);
                return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
            }

            const fromMe = data.key?.fromMe;
            if (fromMe) return new Response(JSON.stringify({ success: true, message: "Self message ignored" }), { headers: corsHeaders });

            // Normalize Content
            const text = data.message?.conversation ||
                data.message?.extendedTextMessage?.text ||
                data.message?.imageMessage?.caption ||
                data.message?.videoMessage?.caption ||
                "";

            // 4. ACK Detector
            // Pattern: (ok|finalizar|resolvido) <token>
            const ackMatch = text.match(/(^|\s)(ok|finalizar|resolvido)\s+([a-z0-9]{5,12})(\s|$)/i);
            if (ackMatch) {
                const token = ackMatch[3].toUpperCase();
                console.log(`[EVO-WEBHOOK] ACK Keyword "${ackMatch[2]}" with Token detected: ${token}`);

                // Find the attempt log entry to get job and event IDs
                const { data: logEntry } = await supabase
                    .from('reminder_attempt_logs')
                    .select('job_id, event_id')
                    .eq('ack_token', token)
                    .maybeSingle();

                if (logEntry) {
                    // Update Job status
                    await supabase
                        .from('reminder_jobs')
                        .update({
                            status: 'done',
                            ack_received_at: now,
                            updated_at: now
                        })
                        .eq('id', logEntry.job_id);

                    // Update Event status (Optional but requested)
                    await supabase
                        .from('calendar_events')
                        .update({
                            status: 'done',
                            updated_at: now
                        })
                        .eq('id', logEntry.event_id);

                    console.log(`[EVO-WEBHOOK] Job ${logEntry.job_id} and Event ${logEntry.event_id} marked as DONE via ACK token ${token}`);
                }
            }

            // 5. Save to CRM (Contacts, Conversations, Messages)
            const chatJid = data.key?.remoteJid;
            if (!chatJid) throw new Error("Missing remoteJid");

            const isGroup = chatJid.includes('@g.us');
            const chatName = payload.data?.pushName || chatJid.split('@')[0];

            // Upsert Contact
            const { data: contact } = await supabase.from('contacts').upsert({
                workspace_id: workspaceId,
                chat_lid: chatJid,
                lid: chatJid,
                name: chatName,
                is_group: isGroup,
                updated_at: now
            }, { onConflict: 'chat_lid' }).select('id, tags').single();

            if (!contact) throw new Error("Contact upsert failed");

            const isBlockedContact = Array.isArray(contact.tags) && contact.tags.includes('blocked');
            if (isBlockedContact) {
                console.log(`[EVO-WEBHOOK] Ignoring message from blocked contact: ${contact.id}`);
                return new Response(JSON.stringify({ success: true, blocked: true }), { headers: corsHeaders });
            }

            // Upsert Conversation
            const { data: existingConversation } = await supabase
                .from('conversations')
                .select('id, assigned_to')
                .eq('thread_key', chatJid)
                .maybeSingle();

            let conv: any = null;

            if (existingConversation) {
                const stickyAssignee = !existingConversation.assigned_to
                    ? await findStickyAssignee(supabase, existingConversation.id, workspaceId)
                    : null;

                const conversationUpdate: Record<string, unknown> = {
                    workspace_id: workspaceId,
                    contact_id: contact.id,
                    chat_id: chatJid,
                    thread_key: chatJid,
                    status: 'open',
                    last_message_at: now,
                };

                if (stickyAssignee) {
                    conversationUpdate.assigned_to = stickyAssignee.agentId;
                    conversationUpdate.assigned_at = now;
                    conversationUpdate.human_control = true;
                    conversationUpdate.ai_paused_until = new Date(Date.now() + 30 * 60 * 1000).toISOString();
                }

                const updateResult = await supabase.from('conversations')
                    .update(conversationUpdate)
                    .eq('id', existingConversation.id)
                    .select('id')
                    .single();

                if (updateResult.error || !updateResult.data) throw updateResult.error || new Error("Conversation update failed");
                conv = updateResult.data;

                if (stickyAssignee) {
                    await supabase.from('messages').insert({
                        workspace_id: workspaceId,
                        conversation_id: conv.id,
                        sender_type: 'system',
                        message_type: 'system',
                        content: `↩️ Conversa retornou e foi redirecionada automaticamente para ${stickyAssignee.agentName}.`,
                        sent_at: now,
                    });
                }
            } else {
                const createResult = await supabase.from('conversations').upsert({
                    workspace_id: workspaceId,
                    contact_id: contact.id,
                    chat_id: chatJid,
                    thread_key: chatJid,
                    status: 'open',
                    last_message_at: now
                }, { onConflict: 'thread_key' }).select('id').single();

                if (createResult.error || !createResult.data) throw createResult.error || new Error("Conversation upsert failed");
                conv = createResult.data;
            }
            if (!conv) throw new Error("Conversation upsert failed");

            // Increment Unread
            await supabase.rpc('increment_unread_count', { conv_id: conv.id });

            // Save Message
            const { data: insertedMessage, error: messageError } = await supabase.from('messages').insert({
                workspace_id: workspaceId,
                conversation_id: conv.id,
                sender_type: 'contact',
                sender_name: chatName,
                sender_phone: chatJid.split('@')[0],
                message_type: 'text', // Simple text for now
                content: text || "[Mídia]",
                provider: 'evolution',
                provider_message_id: msgId,
                chat_id: chatJid,
                direction: 'inbound',
                sent_at: now,
                raw_payload: payload
            }).select('id').single();

            if (messageError) throw messageError;

            if (!isGroup && insertedMessage?.id) {
                const aiTriggerResponse = await fetch(`${supabaseUrl}/functions/v1/ai-maybe-reply`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${serviceKey}` },
                    body: JSON.stringify({
                        conversation_id: conv.id,
                        trigger_message_id: insertedMessage.id,
                    }),
                }).catch(err => {
                    console.error('[EVO-WEBHOOK] Failed to trigger AI reply:', err);
                    return null;
                });

                if (aiTriggerResponse && !aiTriggerResponse.ok) {
                    const triggerError = await aiTriggerResponse.text();
                    console.error('[EVO-WEBHOOK] ai-maybe-reply returned error:', triggerError);
                    await supabase.from('ai_logs').insert({
                        status: 'error',
                        input_excerpt: JSON.stringify({ conversation_id: conv.id }),
                        error_message: `ai-maybe-reply trigger failed: ${triggerError}`,
                        model: 'evolution-webhook-debug',
                        provider: 'evolution',
                        conversation_id: conv.id,
                        created_at: now
                    });
                }
            }
        }

        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    } catch (error: any) {
        console.error('[EVO-WEBHOOK ERROR]', error.message);
        await supabase.from('ai_logs').insert({
            status: 'webhook_error',
            error_message: error.message,
            input_excerpt: JSON.stringify(payload || {}).substring(0, 1000),
            model: 'evolution-webhook-debug',
            provider: 'evolution',
            created_at: now
        });
        return new Response(JSON.stringify({ error: error.message }), { status: 200, headers: corsHeaders });
    }
});

