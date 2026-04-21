import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Database } from '@/integrations/supabase/types';
import { getRealtimePollingInterval } from '@/lib/realtimeTuning';
import { useIsMobile } from '@/hooks/use-mobile';

type Message = Database['public']['Tables']['messages']['Row'];
export type RealtimeConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'error';

export function useRealtimeMessages(conversationId: string | null) {
  const isMobile = useIsMobile();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<RealtimeConnectionStatus>('connecting');
  const channelRef = useRef<any>(null);
  const activeConversationRef = useRef<string | null>(conversationId);
  const latestRequestRef = useRef(0);
  const fetchInFlightIdsRef = useRef<Set<string>>(new Set());
  const lastFetchAtByConversationRef = useRef<Map<string, number>>(new Map());

  const fetchMessages = useCallback(async (id: string) => {
    if (fetchInFlightIdsRef.current.has(id)) return;
    const now = Date.now();
    const lastFetchAt = lastFetchAtByConversationRef.current.get(id) || 0;
    if (now - lastFetchAt < 1000) return;
    const requestId = ++latestRequestRef.current;

    // Immediate log to track request
    console.log(`[RealtimeMessages] Fetching messages for: ${id}`);
    fetchInFlightIdsRef.current.add(id);
    lastFetchAtByConversationRef.current.set(id, now);
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', id)
        .order('sent_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setMessages((prev) => {
        if (requestId !== latestRequestRef.current || activeConversationRef.current !== id) {
          return prev;
        }
        if (data) return data.reverse();
        return prev;
      });

    } catch (err) {
      console.error('[RealtimeMessages] Error fetching:', err);
      if (activeConversationRef.current === id) {
        setConnectionStatus('error');
      }
    } finally {
      fetchInFlightIdsRef.current.delete(id);
      if (requestId === latestRequestRef.current && activeConversationRef.current === id) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    activeConversationRef.current = conversationId;
    // ALWAYS clear messages immediately when conversation changes
    setMessages([]);
    setConnectionStatus(conversationId ? 'connecting' : 'connected');

    if (!conversationId) {
      setLoading(false);
      return;
    }

    console.log(`[RealtimeMessages] Conversation changed to: ${conversationId}`);
    fetchMessages(conversationId);

    // Cleanup previous channel
    if (channelRef.current) {
      console.log('[RealtimeMessages] Cleaning up previous channel');
      supabase.removeChannel(channelRef.current);
    }

    // Subscribe to ALL changes for this conversation's messages
    const channel = supabase.channel(`chat:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newMessage = payload.new as Message;
            setMessages((prev) => {
              // Ignore if message already exists or belongs to another conversation
              if (newMessage.conversation_id !== conversationId) return prev;
              if (prev.some((m) => m.id === newMessage.id)) return prev;

              return [...prev, newMessage].sort(
                (a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()
              );
            });
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Message;
            setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
          } else if (payload.eventType === 'DELETE') {
            setMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected');
        }
        if (status === 'CHANNEL_ERROR') {
          console.error('[RealtimeMessages] Subscription error, retrying...');
          setConnectionStatus('reconnecting');
          setTimeout(() => {
            if (activeConversationRef.current === conversationId) {
              void fetchMessages(conversationId);
            }
          }, 2000);
        }
        if (status === 'TIMED_OUT') {
          setConnectionStatus('reconnecting');
        }
      });

    channelRef.current = channel;

    const getPollingInterval = () => {
      return getRealtimePollingInterval({
        channel: 'messages',
        isMobile,
        visibilityState: typeof document !== 'undefined' ? document.visibilityState : 'visible',
      });
    };

    let intervalId: number | null = null;

    const startPolling = () => {
      if (intervalId !== null) window.clearInterval(intervalId);
      intervalId = window.setInterval(() => {
        if (!conversationId) return;
        void fetchMessages(conversationId);
      }, getPollingInterval());
    };

    const handleVisibilityChange = () => {
      if (!conversationId) return;
      void fetchMessages(conversationId);
      startPolling();
    };

    const handleWindowFocus = () => {
      if (!conversationId) return;
      void fetchMessages(conversationId);
    };

    startPolling();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    return () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [conversationId, fetchMessages, isMobile]);

  return { messages, loading, connectionStatus, setMessages };
}
