import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { Redis } from "https://esm.sh/@upstash/redis@1.25.0"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

    const now = new Date().toISOString();
    let payload: any;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
            .select('tenant_id, webhook_secret, is_enabled')
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

        const tenantId = integration.tenant_id;

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

        // 3. Process MESSAGES_UPSERT
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
                tenant_id: tenantId,
                chat_lid: chatJid,
                lid: chatJid,
                name: chatName,
                is_group: isGroup,
                updated_at: now
            }, { onConflict: 'chat_lid' }).select('id').single();

            if (!contact) throw new Error("Contact upsert failed");

            // Upsert Conversation
            const { data: conv } = await supabase.from('conversations').upsert({
                tenant_id: tenantId,
                contact_id: contact.id,
                chat_id: chatJid,
                thread_key: chatJid,
                status: 'open',
                last_message_at: now
            }, { onConflict: 'thread_key' }).select('id').single();

            if (!conv) throw new Error("Conversation upsert failed");

            // Increment Unread
            await supabase.rpc('increment_unread_count', { conv_id: conv.id });

            // Save Message
            await supabase.from('messages').insert({
                tenant_id: tenantId,
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
            });
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
