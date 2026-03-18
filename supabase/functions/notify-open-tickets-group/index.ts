import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotifyRequest {
  conversation_id: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { conversation_id } = await req.json() as NotifyRequest;

    if (!conversation_id) {
      return new Response(
        JSON.stringify({ error: 'conversation_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processing notification for conversation:', conversation_id);

    // Check for duplicate notification
    const dedupeKey = `ticket_created:${conversation_id}`;
    const { data: existingNotification } = await supabase
      .from('notifications')
      .select('id, status')
      .eq('dedupe_key', dedupeKey)
      .single();

    if (existingNotification?.status === 'sent') {
      console.log('Notification already sent for this conversation');
      return new Response(
        JSON.stringify({ success: false, reason: 'already_sent' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get conversation details with related data
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select(`
        id,
        workspace_id,
        protocol,
        status,
        priority,
        created_at,
        assigned_to,
        contact_id
      `)
      .eq('id', conversation_id)
      .single();

    if (convError || !conversation) {
      console.error('Conversation not found:', convError);
      return new Response(
        JSON.stringify({ error: 'Conversa não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get contact separately
    const { data: contact } = await supabase
      .from('contacts')
      .select('id, name, phone, is_group')
      .eq('id', conversation.contact_id)
      .single();

    // Get participant state to find current participant
    const { data: participantState } = await supabase
      .from('conversation_participant_state')
      .select('current_participant_id')
      .eq('conversation_id', conversation_id)
      .single();

    // Get participant details if exists
    let participant: { name: string; role_type: string | null; entity_id: string | null } | null = null;
    let entity: { name: string; type: string } | null = null;
    
    if (participantState?.current_participant_id) {
      const { data: participantData } = await supabase
        .from('participants')
        .select('name, role_type, entity_id')
        .eq('id', participantState.current_participant_id)
        .single();
      participant = participantData;
      
      if (participantData?.entity_id) {
        const { data: entityData } = await supabase
          .from('entities')
          .select('name, type')
          .eq('id', participantData.entity_id)
          .single();
        entity = entityData;
      }
    }

    // Get assigned agent if exists
    let assignedAgent: { name: string; team_id: string | null; teamName?: string } | null = null;
    if (conversation.assigned_to) {
      const { data: agentData } = await supabase
        .from('profiles')
        .select('name, team_id')
        .eq('id', conversation.assigned_to)
        .single();
      
      if (agentData) {
        assignedAgent = { name: agentData.name, team_id: agentData.team_id };
        
        if (agentData.team_id) {
          const { data: teamData } = await supabase
            .from('teams')
            .select('name')
            .eq('id', agentData.team_id)
            .single();
          if (teamData) {
            assignedAgent.teamName = teamData.name;
          }
        }
      }
    }

    // Get AI conversation summary if exists
    const { data: aiState } = await supabase
      .from('ai_conversation_state')
      .select('conversation_summary')
      .eq('conversation_id', conversation_id)
      .single();

    // Get Z-API settings for the conversation workspace, with global fallback only if needed
    let zapiSettings = null;
    const workspaceId = conversation.workspace_id;

    if (workspaceId) {
      const { data: workspaceSettings } = await supabase
        .from('zapi_settings')
        .select('*')
        .eq('workspace_id', workspaceId)
        .limit(1)
        .maybeSingle();
      zapiSettings = workspaceSettings;
    }

    if (!zapiSettings && assignedAgent?.team_id) {
      const { data: teamSettings } = await supabase
        .from('zapi_settings')
        .select('*')
        .eq('team_id', assignedAgent.team_id)
        .single();
      zapiSettings = teamSettings;
    }

    if (!zapiSettings) {
      const { data: globalSettings } = await supabase
        .from('zapi_settings')
        .select('*')
        .is('team_id', null)
        .single();
      zapiSettings = globalSettings;
    }

    if (!zapiSettings || !zapiSettings.enable_group_notifications) {
      console.log('Group notifications not enabled');
      return new Response(
        JSON.stringify({ success: false, reason: 'notifications_disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!zapiSettings.open_tickets_group_id) {
      console.log('No group ID configured');
      return new Response(
        JSON.stringify({ success: false, reason: 'no_group_configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Z-API credentials from settings or env vars
    const instanceId = zapiSettings.zapi_instance_id || Deno.env.get('ZAPI_INSTANCE_ID');
    const token = zapiSettings.zapi_token || Deno.env.get('ZAPI_TOKEN');
    const clientToken = zapiSettings.zapi_security_token || Deno.env.get('ZAPI_CLIENT_TOKEN');

    if (!instanceId || !token) {
      console.error('Z-API credentials not configured');
      return new Response(
        JSON.stringify({ error: 'Credenciais Z-API não configuradas' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build notification message
    const priorityMap: Record<string, string> = {
      'high': '🔴',
      'urgent': '🚨',
      'normal': '🟡',
      'low': '🟢',
    };
    const priorityEmoji = priorityMap[conversation.priority || 'normal'] || '🟡';

    const messageLines = [
      `📣 *NOVO CHAMADO ABERTO*`,
      ``,
      `🎫 *Protocolo:* ${conversation.protocol || 'N/A'}`,
      `📅 *Data:* ${new Date(conversation.created_at).toLocaleString('pt-BR', { timeZone: 'America/Recife' })}`,
      ``,
    ];

    // Add entity/condo info if available
    if (entity) {
      messageLines.push(`🏢 *${entity.type === 'condominio' ? 'Condomínio' : 'Entidade'}:* ${entity.name}`);
    }

    // Add participant info
    if (participant) {
      messageLines.push(`👤 *Contato:* ${participant.name}${participant.role_type ? ` (${participant.role_type})` : ''}`);
    } else if (contact) {
      messageLines.push(`👤 *Contato:* ${contact.name}`);
    }

    // Add priority
    messageLines.push(`${priorityEmoji} *Prioridade:* ${conversation.priority || 'Normal'}`);

    // Add assigned agent or queue
    if (assignedAgent) {
      messageLines.push(`👨‍💼 *Atribuído a:* ${assignedAgent.name}${assignedAgent.teamName ? ` (${assignedAgent.teamName})` : ''}`);
    } else {
      messageLines.push(`📋 *Status:* Aguardando atribuição`);
    }

    // Add summary if available
    if (aiState?.conversation_summary) {
      messageLines.push(``, `📝 *Resumo:* ${aiState.conversation_summary}`);
    }

    messageLines.push(``, `---`);

    const messageText = messageLines.join('\n');

    // Create notification record first (pending)
    const { data: notification, error: notifError } = await supabase
      .from('notifications')
      .upsert({
        dedupe_key: dedupeKey,
        conversation_id: conversation_id,
        notification_type: 'ticket_created',
        status: 'pending',
      }, {
        onConflict: 'dedupe_key',
      })
      .select()
      .single();

    if (notifError) {
      console.error('Error creating notification record:', notifError);
    }

    // Send message via Z-API
    const zapiUrl = `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    
    if (clientToken) {
      headers['Client-Token'] = clientToken;
    }

    console.log('Sending message to group:', zapiSettings.open_tickets_group_id);

    const zapiResponse = await fetch(zapiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        phone: zapiSettings.open_tickets_group_id,
        message: messageText,
      }),
    });

    const zapiResult = await zapiResponse.json();
    console.log('Z-API response:', zapiResult);

    // Update notification status
    const notificationUpdate: Record<string, any> = {
      sent_at: new Date().toISOString(),
    };

    if (zapiResponse.ok && zapiResult.zapiMessageId) {
      notificationUpdate.status = 'sent';
      notificationUpdate.zapi_response_id = zapiResult.zapiMessageId;
    } else {
      notificationUpdate.status = 'failed';
      notificationUpdate.error_message = zapiResult.error || zapiResult.message || 'Unknown error';
    }

    if (notification) {
      await supabase
        .from('notifications')
        .update(notificationUpdate)
        .eq('id', notification.id);
    }

    // Add internal message to conversation timeline
    const internalMessage = notificationUpdate.status === 'sent'
      ? `📣 Protocolo ${conversation.protocol || 'N/A'} enviado para o grupo de chamados em aberto.`
      : `⚠️ Falha ao enviar notificação para o grupo: ${notificationUpdate.error_message}`;

    await supabase.from('messages').insert({
      workspace_id: workspaceId,
      conversation_id: conversation_id,
      sender_type: 'agent',
      sender_id: null, // System message
      content: internalMessage,
      message_type: 'text',
    });

    return new Response(
      JSON.stringify({
        success: notificationUpdate.status === 'sent',
        status: notificationUpdate.status,
        zapi_response_id: notificationUpdate.zapi_response_id,
        protocol: conversation.protocol,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in notify-open-tickets-group:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
