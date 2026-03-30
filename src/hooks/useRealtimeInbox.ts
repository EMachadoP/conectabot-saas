import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface Conversation {
  id: string;
  contact: any;
  last_message: string;
  last_message_type: string;
  last_message_at: string | null;
  unread_count: number;
  assigned_to: string | null;
  status: string;
  priority: string | null;
}

interface UseRealtimeInboxProps {
  onNewInboundMessage?: () => void;
  userId?: string;
}

export function useRealtimeInbox({ onNewInboundMessage, userId }: UseRealtimeInboxProps = {}) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const processedMessageIds = useRef<Set<string>>(new Set());
  const lastFetchTime = useRef<number>(0);

  const markConversationAsRead = useCallback((conversationId: string) => {
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, unread_count: 0 }
          : conversation
      )
    );
  }, []);

  const fetchConversations = useCallback(async () => {
    // Throttle fetches to max once every 300ms
    const now = Date.now();
    if (now - lastFetchTime.current < 300) return;
    lastFetchTime.current = now;

    console.log('[RealtimeInbox] Fetching conversations...');
    const { data, error } = await supabase
      .from('conversations')
      .select(`*, contacts (*)`)
      .order('last_message_at', { ascending: false });

    if (!error && data) {
      setConversations(data.map((conv: any) => ({
        id: conv.id,
        contact: conv.contacts,
        last_message: conv.last_message_content || 'Nenhuma mensagem',
        last_message_type: 'text',
        last_message_at: conv.last_message_at,
        unread_count: conv.unread_count,
        assigned_to: conv.assigned_to,
        status: conv.status,
        priority: conv.priority,
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchConversations();

    // Canal estável para Inbox global
    const channel = supabase.channel('global-inbox-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        (payload) => {
          console.log('[RealtimeInbox] Conversation record update');

          if (payload.eventType === 'UPDATE' && userId) {
            const previousConversation = payload.old as Partial<Conversation> | undefined;
            const nextConversation = payload.new as Partial<Conversation> | undefined;

            const unreadIncreased =
              (nextConversation?.unread_count || 0) > (previousConversation?.unread_count || 0);
            const newlyAssignedToCurrentUser =
              nextConversation?.assigned_to === userId && previousConversation?.assigned_to !== userId;
            const sharedInboxPending =
              nextConversation?.assigned_to === null && unreadIncreased;
            const minePending =
              nextConversation?.assigned_to === userId && unreadIncreased;

            if (newlyAssignedToCurrentUser || sharedInboxPending || minePending) {
              onNewInboundMessage?.();
            }
          }

          fetchConversations();
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const newMessage = payload.new;
          if (!newMessage || processedMessageIds.current.has(newMessage.id)) return;

          processedMessageIds.current.add(newMessage.id);
          console.log('[RealtimeInbox] New message incoming:', newMessage.id);

          fetchConversations();

          // Limpa o set ocasionalmente para não crescer infinitamente
          if (processedMessageIds.current.size > 100) {
            processedMessageIds.current = new Set([...processedMessageIds.current].slice(-50));
          }
        }
      )
      .subscribe();

    return () => {
      console.log('[RealtimeInbox] Cleaning up channel');
      supabase.removeChannel(channel);
    };
  }, [fetchConversations, onNewInboundMessage]);

  return {
    conversations,
    loading,
    refetch: fetchConversations,
    markConversationAsRead,
  };
}
