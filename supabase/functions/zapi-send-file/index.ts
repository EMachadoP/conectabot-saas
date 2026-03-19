import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const normalizeRecipient = (value: unknown) => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
          : 'Limite do plano atingido. Faça upgrade para continuar.';

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
    
    const { conversation_id, file_url, file_name, file_type, caption, sender_id } = await req.json();
    
    console.log('Sending file via Z-API:', { conversation_id, file_type, file_name });

    if (!conversation_id || !file_url) {
      return new Response(JSON.stringify({ error: 'conversation_id and file_url are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get conversation and contact info
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select(`
        id,
        workspace_id,
        contacts (
          id,
          phone,
          lid,
          chat_lid,
          is_group
        )
      `)
      .eq('id', conversation_id)
      .single();

    if (convError || !conversation) {
      console.error('Conversation not found:', convError);
      return new Response(JSON.stringify({ error: 'Conversation not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const workspaceId = (conversation as any).workspace_id;
    const contact = (conversation as any).contacts;
    const recipientPhone = normalizeRecipient(contact.chat_lid) || normalizeRecipient(contact.lid) || normalizeRecipient(contact.phone);

    const billingBlock = await requireBillingAccess(workspaceId, 'outbound_message', 1);
    if (billingBlock) return billingBlock;

    if (!recipientPhone) {
      return new Response(JSON.stringify({ error: 'No valid recipient identifier' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: zapiSettings } = await supabase
      .from('zapi_settings')
      .select('*')
      .eq('workspace_id', workspaceId)
      .limit(1)
      .maybeSingle();

    // Get Z-API credentials for the conversation workspace
    const instanceId = zapiSettings?.zapi_instance_id || Deno.env.get('ZAPI_INSTANCE_ID');
    const token = zapiSettings?.zapi_token || Deno.env.get('ZAPI_TOKEN');
    const clientToken = zapiSettings?.zapi_security_token || Deno.env.get('ZAPI_CLIENT_TOKEN');

    if (!instanceId || !token) {
      console.error('Z-API credentials not configured');
      return new Response(JSON.stringify({ error: 'Z-API credentials not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Determine Z-API endpoint based on file type
    let endpoint = 'send-document';
    let messageType: 'image' | 'video' | 'audio' | 'document' = 'document';
    
    if (file_type?.startsWith('image/')) {
      endpoint = 'send-image';
      messageType = 'image';
    } else if (file_type?.startsWith('video/')) {
      endpoint = 'send-video';
      messageType = 'video';
    } else if (file_type?.startsWith('audio/')) {
      endpoint = 'send-audio';
      messageType = 'audio';
    }

    const zapiUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}/${endpoint}`;
    
    const zapiPayload: Record<string, string> = {
      phone: recipientPhone,
    };

    // Different payload structure for different file types
    if (messageType === 'image') {
      zapiPayload.image = file_url;
      if (caption) zapiPayload.caption = caption;
    } else if (messageType === 'video') {
      zapiPayload.video = file_url;
      if (caption) zapiPayload.caption = caption;
    } else if (messageType === 'audio') {
      zapiPayload.audio = file_url;
    } else {
      zapiPayload.document = file_url;
      if (file_name) zapiPayload.fileName = file_name;
    }

    console.log('Calling Z-API:', { endpoint, payload: zapiPayload });

    const zapiResponse = await fetch(zapiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(clientToken ? { 'Client-Token': clientToken } : {}),
      },
      body: JSON.stringify(zapiPayload),
    });

    const zapiResult = await zapiResponse.json();
    console.log('Z-API response:', zapiResult);

    if (!zapiResponse.ok) {
      return new Response(JSON.stringify({ error: 'Failed to send via Z-API', details: zapiResult }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Save message to database
    const { data: message, error: msgError } = await supabase
      .from('messages')
      .insert({
        workspace_id: workspaceId,
        conversation_id,
        sender_type: 'agent',
        sender_id,
        message_type: messageType,
        content: caption || file_name || null,
        media_url: file_url,
        provider: 'zapi',
        provider_message_id: zapiResult.messageId || zapiResult.zapiMessageId,
        sent_at: new Date().toISOString(),
        direction: 'outbound',
      })
      .select()
      .single();

    if (msgError) {
      console.error('Error saving message:', msgError);
      throw msgError;
    }

    // Update conversation
    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversation_id);

    await supabase.rpc('record_usage', {
      p_workspace_id: workspaceId,
      p_metric_name: 'messages_sent',
      p_quantity: 1,
    });

    console.log('File message saved:', message.id);

    return new Response(JSON.stringify({ 
      success: true, 
      message_id: message.id,
      zapi_message_id: zapiResult.messageId || zapiResult.zapiMessageId,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Send file error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
