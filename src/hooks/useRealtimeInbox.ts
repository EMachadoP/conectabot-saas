import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';

export interface Conversation {
  id: string;
  contact: any;
  last_message: string;
  last_message_type: string;
  last_message_at: string | null;
  unread_count: number;
  marked_unread: boolean;
  assigned_to: string | null;
  status: string;
  priority: string | null;
}

interface LatestMessageRecord {
  conversation_id: string;
  content: string | null;
  message_type: string | null;
  sent_at: string | null;
}

function isUsefulPreview(message: LatestMessageRecord) {
  if (!message) return false;
  if (message.message_type === 'system') return false;
  return Boolean(message.content || message.message_type);
}

interface UseRealtimeInboxProps {
  onNewInboundMessage?: () => void;
  userId?: string;
}

export function useRealtimeInbox({ onNewInboundMessage, userId }: UseRealtimeInboxProps = {}) {
  const { activeTenant } = useTenant();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const processedMessageIds = useRef<Set<string>>(new Set());
  const lastFetchTime = useRef<number>(0);
  const fetchInFlightRef = useRef(false);

  const markConversationAsRead = useCallback((conversationId: string) => {
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, unread_count: 0, marked_unread: false }
          : conversation
      )
    );
  }, []);

  const markConversationAsUnread = useCallback((conversationId: string) => {
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, marked_unread: true }
          : conversation
      )
    );
  }, []);

  const markConversationAsOpen = useCallback((conversationId: string) => {
    setConversations((current) =>
      current.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, status: 'open' }
          : conversation
      )
    );
  }, []);

  const fetchConversations = useCallback(async () => {
    if (!activeTenant?.id) return;
    if (fetchInFlightRef.current) return;
    const now = Date.now();
    if (now - lastFetchTime.current < 300) return;
    lastFetchTime.current = now;
    fetchInFlightRef.current = true;

    try {
      console.log('[RealtimeInbox] Fetching conversations...');
      const { data, error } = await supabase
        .from('conversations')
        .select(`*, contacts (*)`)
        .eq('workspace_id', activeTenant.id)
        .order('last_message_at', { ascending: false });

      if (!error && data) {
        const conversationIds = data.map((conv: any) => conv.id).filter(Boolean);
        const latestMessageByConversation = new Map<string, { content: string; message_type: string; sent_at: string | null }>();

        if (conversationIds.length > 0) {
          const { data: latestMessages } = await supabase
            .from('messages')
            .select('conversation_id, content, message_type, sent_at')
            .in('conversation_id', conversationIds)
            .order('sent_at', { ascending: false });

          for (const message of (latestMessages || []) as LatestMessageRecord[]) {
            if (!latestMessageByConversation.has(message.conversation_id) && isUsefulPreview(message)) {
              latestMessageByConversation.set(message.conversation_id, {
                content: message.content || 'Nenhuma mensagem',
                message_type: message.message_type || 'text',
                sent_at: message.sent_at || null,
              });
            }
          }
        }

        setConversations(data.map((conv: any) => {
          const latestMessage = latestMessageByConversation.get(conv.id);
          return {
            id: conv.id,
            contact: conv.contacts,
            last_message: latestMessage?.content || conv.last_message || 'Nenhuma mensagem',
            last_message_type: latestMessage?.message_type || conv.last_message_type || 'text',
            last_message_at: latestMessage?.sent_at || conv.last_message_at,
            unread_count: conv.unread_count,
            marked_unread: conv.marked_unread ?? false,
            assigned_to: conv.assigned_to,
            status: conv.status,
            priority: conv.priority,
          };
        }));
      }
    } finally {
      fetchInFlightRef.current = false;
      setLoading(false);
    }
  }, [activeTenant?.id]);

  useEffect(() => {
    setConversations([]);
    fetchConversations();

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

          if (processedMessageIds.current.size > 100) {
            processedMessageIds.current = new Set([...processedMessageIds.current].slice(-50));
          }
        }
      )
      .subscribe();

    const getPollingInterval = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return 25000;
      }
      return 8000;
    };

    let intervalId: number | null = null;

    const startPolling = () => {
      if (intervalId !== null) window.clearInterval(intervalId);
      intervalId = window.setInterval(() => {
        void fetchConversations();
      }, getPollingInterval());
    };

    const handleVisibilityChange = () => {
      void fetchConversations();
      startPolling();
    };

    const handleWindowFocus = () => {
      void fetchConversations();
    };

    startPolling();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      console.log('[RealtimeInbox] Cleaning up channel');
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
      supabase.removeChannel(channel);
    };
  }, [fetchConversations, onNewInboundMessage, userId, activeTenant?.id]);

  return {
    conversations,
    loading,
    refetch: fetchConversations,
    markConversationAsRead,
    markConversationAsUnread,
    markConversationAsOpen,
  };
}
