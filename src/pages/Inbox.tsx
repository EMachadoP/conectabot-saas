import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { useNotificationSound } from '@/hooks/useNotificationSound';
import { useToast } from '@/hooks/use-toast';
import { AppLayout } from '@/components/layout/AppLayout';
import { ConversationList } from '@/components/inbox/ConversationList';
import { ChatArea } from '@/components/inbox/ChatArea';
import { useRealtimeMessages } from '@/hooks/useRealtimeMessages';
import { ChatSkeleton } from '@/components/inbox/ChatSkeleton';
import { useRealtimeInbox } from '@/hooks/useRealtimeInbox';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';

export default function InboxPage() {
  const { id: conversationIdParam } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { user, loading: authLoading } = useAuth();
  const { playNotificationSound } = useNotificationSound();
  const { toast } = useToast();

  const [activeConversationId, setActiveConversationId] = useState<string | null>(conversationIdParam || null);
  const [activeContact, setActiveContact] = useState<any>(null);
  const [activeConvData, setActiveConvData] = useState<any>(null);
  const [agents, setAgents] = useState<{ id: string; name: string; email?: string | null }[]>([]);
  const [replyTarget, setReplyTarget] = useState<any | null>(null);

  const { conversations, markConversationAsRead, markConversationAsUnread } = useRealtimeInbox({
    onNewInboundMessage: playNotificationSound,
    userId: user?.id,
  });

  const { messages, loading: loadingMessages } = useRealtimeMessages(activeConversationId);

  const shouldMarkConversationAsRead = useCallback((conversation: { assigned_to?: string | null } | null | undefined) => {
    return Boolean(user?.id && conversation);
  }, [user?.id]);

  const parseFunctionError = useCallback(async (error: unknown) => {
    if (error instanceof FunctionsHttpError) {
      try {
        const response = await error.context.json();
        return response?.error || error.message;
      } catch {
        return error.message;
      }
    }

    return error instanceof Error ? error.message : 'Erro desconhecido';
  }, []);

  const fileToDataUrl = useCallback((file: File) => {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
          return;
        }
        reject(new Error('Falha ao ler o arquivo selecionado.'));
      };
      reader.onerror = () => reject(new Error('Falha ao ler o arquivo selecionado.'));
      reader.readAsDataURL(file);
    });
  }, []);

  const fetchActiveConversationDetails = useCallback(async (id: string) => {
    const { data } = await supabase
      .from('conversations')
      .select('*, contacts(*)')
      .eq('id', id)
      .single();

    if (data) {
      setActiveConvData(data);
      setActiveContact(data.contacts);

      if (shouldMarkConversationAsRead(data)) {
        markConversationAsRead(id);
        await supabase.from('conversations').update({ unread_count: 0, marked_unread: false }).eq('id', id);
      }
    }
  }, [markConversationAsRead, shouldMarkConversationAsRead]);

  const toggleContactBlocked = useCallback(async () => {
    if (!activeContact?.id || !activeConversationId) return;

    const currentTags = Array.isArray(activeContact.tags) ? activeContact.tags : [];
    const isBlocked = currentTags.includes('blocked');
    const nextTags = isBlocked
      ? currentTags.filter((tag: string) => tag !== 'blocked')
      : [...new Set([...currentTags, 'blocked'])];

    const { error } = await supabase
      .from('contacts')
      .update({ tags: nextTags })
      .eq('id', activeContact.id);

    if (error) {
      toast({
        variant: 'destructive',
        title: isBlocked ? 'Erro ao desbloquear contato' : 'Erro ao bloquear contato',
        description: error.message,
      });
      return;
    }

    if (!isBlocked) {
      await supabase
        .from('conversations')
        .update({ status: 'resolved', unread_count: 0 })
        .eq('id', activeConversationId);
    }

    setActiveContact((current: any) => current ? { ...current, tags: nextTags } : current);
    toast({
      title: isBlocked ? 'Contato desbloqueado' : 'Contato bloqueado',
      description: isBlocked
        ? 'Novas mensagens voltarão a aparecer normalmente.'
        : 'Novas mensagens desse contato serão ignoradas pelo sistema.',
    });

    await fetchActiveConversationDetails(activeConversationId);
  }, [activeContact?.id, activeContact?.tags, activeConversationId, fetchActiveConversationDetails, toast]);

  useEffect(() => {
    if (activeConversationId) {
      setActiveContact(null);
      setActiveConvData(null);
      setReplyTarget(null);
      fetchActiveConversationDetails(activeConversationId);
    }
  }, [activeConversationId, fetchActiveConversationDetails]);

  useEffect(() => {
    const fetchAgents = async () => {
      if (!user) return;

      const { data } = await supabase
        .from('profiles')
        .select('id, name, display_name, email')
        .order('name');

      if (data) {
        setAgents(
          data.map((profile: any) => ({
            id: profile.id,
            name:
              profile.display_name?.trim() ||
              profile.name?.trim() ||
              (typeof profile.email === 'string' ? profile.email.split('@')[0] : 'Sem nome'),
            email: profile.email ?? null,
          }))
        );
      }
    };

    fetchAgents();
  }, [user]);

  useEffect(() => {
    if (conversationIdParam && conversationIdParam !== activeConversationId) {
      setActiveConversationId(conversationIdParam);
    }
  }, [conversationIdParam, activeConversationId]);

  const handleSelectConversation = useCallback((id: string) => {
    setReplyTarget(null);
    setActiveConversationId(id);
    const selectedConversation = conversations.find((conversation) => conversation.id === id);
    if (shouldMarkConversationAsRead(selectedConversation)) {
      markConversationAsRead(id);
      void supabase
        .from('conversations')
        .update({ unread_count: 0, marked_unread: false })
        .eq('id', id);
    }
    navigate(`/inbox/${id}`);
  }, [conversations, markConversationAsRead, navigate, shouldMarkConversationAsRead]);

  const handleClearSelection = useCallback(() => {
    setReplyTarget(null);
    setActiveConversationId(null);
    setActiveContact(null);
    setActiveConvData(null);
    navigate('/inbox');
  }, [navigate]);

  const handleSendMessage = async (content: string) => {
    if (!user) {
      toast({ variant: 'destructive', title: 'Sessão ausente', description: 'Faça login novamente.' });
      return;
    }
    if (!activeConversationId) {
      toast({ variant: 'destructive', title: 'Nenhuma conversa selecionada' });
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) throw new Error('Sessão perdida. Faça login novamente.');

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zapi-send-message`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversation_id: activeConversationId,
          content,
          message_type: 'text',
          reply_to_message_id: replyTarget?.id ?? null,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 402) {
          toast({
            variant: 'destructive',
            title: 'Limite atingido ou assinatura pendente',
            description: 'Regularize o plano para continuar enviando mensagens.',
          });
          navigate('/settings/billing');
          return;
        }
        throw new Error(`Erro HTTP ${response.status}: ${errorText}`);
      }

      setReplyTarget(null);
    } catch (error: any) {
      console.error('Erro ao enviar:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao enviar mensagem',
        description: error.message || 'Erro desconhecido',
      });
    }
  };

  const handleSendFile = useCallback(async (file: File) => {
    if (!user) {
      toast({ variant: 'destructive', title: 'Sessão ausente', description: 'Faça login novamente.' });
      return;
    }
    if (!activeConversationId) {
      toast({ variant: 'destructive', title: 'Nenhuma conversa selecionada' });
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'Arquivo muito grande',
        description: 'Envie arquivos de até 15 MB.',
      });
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) throw new Error('Sessão perdida. Faça login novamente.');

      const fileBase64 = await fileToDataUrl(file);

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zapi-send-file`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversation_id: activeConversationId,
          file_name: file.name,
          file_type: file.type || 'application/octet-stream',
          file_base64: fileBase64,
          sender_id: user.id,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        if (response.status === 402) {
          toast({
            variant: 'destructive',
            title: 'Limite atingido ou assinatura pendente',
            description: 'Regularize o plano para continuar enviando arquivos.',
          });
          navigate('/settings/billing');
          return;
        }
        throw new Error(`Erro HTTP ${response.status}: ${errorText}`);
      }

      toast({
        title: 'Arquivo enviado',
        description: `${file.name} foi enviado com sucesso.`,
      });
    } catch (error: any) {
      console.error('Erro ao enviar arquivo:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao enviar arquivo',
        description: error.message || 'Erro desconhecido',
      });
    }
  }, [activeConversationId, fileToDataUrl, navigate, toast, user]);

  const handleMarkUnread = useCallback(async () => {
    if (!activeConversationId) return;
    markConversationAsUnread(activeConversationId);
    void supabase.from('conversations').update({ marked_unread: true }).eq('id', activeConversationId);
    setActiveConversationId(null);
    navigate('/inbox');
  }, [activeConversationId, markConversationAsUnread, navigate]);

  const handleResolveConversation = async () => {
    if (!activeConversationId) return;

    try {
      const { error } = await supabase
        .from('conversations')
        .update({ status: 'resolved' })
        .eq('id', activeConversationId);

      if (error) throw error;

      console.log('Conversa marcada como resolvida');
    } catch (error: any) {
      console.error('Erro ao resolver conversa:', error);
      alert(`Erro ao concluir conversa: ${error.message || 'Erro desconhecido'}`);
    }
  };

  const handleReopenConversation = async () => {
    if (!activeConversationId) return;

    try {
      const { error } = await supabase
        .from('conversations')
        .update({
          status: 'open',
          resolved_at: null,
          resolved_by: null,
        })
        .eq('id', activeConversationId);

      if (error) throw error;

      await fetchActiveConversationDetails(activeConversationId);
      toast({
        title: 'Conversa reaberta',
        description: 'A conversa voltou para a caixa de entrada.',
      });
    } catch (error: any) {
      console.error('Erro ao reabrir conversa:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao reabrir conversa',
        description: error.message || 'Erro desconhecido',
      });
    }
  };

  const handleAssignAgent = useCallback(async (agentId: string) => {
    if (!activeConversationId) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      if (!token) throw new Error('Sessão perdida. Faça login novamente.');

      const { error } = await supabase.functions.invoke('assign-conversation', {
        body: {
          conversation_id: activeConversationId,
          agent_id: agentId,
        },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (error) {
        console.error('Erro ao atribuir agente:', error);
        alert(`Erro ao atribuir agente: ${await parseFunctionError(error)}`);
      } else {
        await fetchActiveConversationDetails(activeConversationId);
        console.log('Agente atribuído com sucesso');
      }
    } catch (error: any) {
      console.error('Erro ao atribuir agente:', error);
      alert(`Erro ao atribuir agente: ${await parseFunctionError(error)}`);
    }
  }, [activeConversationId, fetchActiveConversationDetails, parseFunctionError]);

  if (authLoading) return null;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <AppLayout>
      <div className="h-full overflow-hidden bg-background">
        {isMobile ? (
          activeConversationId ? (
            <div className="flex-1 flex flex-col min-w-0 h-full">
              {loadingMessages && !messages.length ? (
                <ChatSkeleton />
              ) : (
                <ChatArea
                  key={activeConversationId}
                  contact={activeContact}
                  messages={messages as any}
                  profiles={agents}
                  conversationId={activeConversationId}
                  conversationStatus={activeConvData?.status}
                  onSendMessage={handleSendMessage}
                  onSendFile={handleSendFile}
                  onReplyMessage={setReplyTarget}
                  replyTarget={replyTarget}
                  onCancelReply={() => setReplyTarget(null)}
                  onResolveConversation={handleResolveConversation}
                  onReopenConversation={handleReopenConversation}
                  onMarkUnread={handleMarkUnread}
                  onAssignAgent={handleAssignAgent}
                  onToggleBlockContact={toggleContactBlocked}
                  aiMode={activeConvData?.ai_mode}
                  aiPausedUntil={activeConvData?.ai_paused_until}
                  assignedTo={activeConvData?.assigned_to}
                  humanControl={activeConvData?.human_control}
                  loading={loadingMessages}
                  currentUserId={user.id}
                  isMobile={true}
                  onBack={() => {
                    setActiveConversationId(null);
                    navigate('/inbox');
                  }}
                />
              )}
            </div>
          ) : (
            <ConversationList
              conversations={conversations}
              activeConversationId={activeConversationId}
              userId={user.id}
              onSelectConversation={handleSelectConversation}
              onClearSelection={handleClearSelection}
              isMobile={isMobile}
            />
          )
        ) : (
          <PanelGroup direction="horizontal" className="h-full">
            <Panel defaultSize={30} minSize={20} maxSize={50}>
              <ConversationList
                conversations={conversations}
                activeConversationId={activeConversationId}
                userId={user.id}
                onSelectConversation={handleSelectConversation}
                onClearSelection={handleClearSelection}
                isMobile={isMobile}
              />
            </Panel>

            <PanelResizeHandle className="w-1 bg-border hover:bg-primary/50 transition-colors cursor-col-resize" />

            <Panel defaultSize={70} minSize={50}>
              <div className="flex-1 flex flex-col min-w-0 h-full">
                {activeConversationId ? (
                  loadingMessages && !messages.length ? (
                    <ChatSkeleton />
                  ) : (
                    <ChatArea
                      key={activeConversationId}
                      contact={activeContact}
                      messages={messages as any}
                      profiles={agents}
                      conversationId={activeConversationId}
                      conversationStatus={activeConvData?.status}
                      onSendMessage={handleSendMessage}
                      onSendFile={handleSendFile}
                      onReplyMessage={setReplyTarget}
                      replyTarget={replyTarget}
                      onCancelReply={() => setReplyTarget(null)}
                      onResolveConversation={handleResolveConversation}
                      onReopenConversation={handleReopenConversation}
                      onMarkUnread={handleMarkUnread}
                      onAssignAgent={handleAssignAgent}
                      onToggleBlockContact={toggleContactBlocked}
                      aiMode={activeConvData?.ai_mode}
                      aiPausedUntil={activeConvData?.ai_paused_until}
                      assignedTo={activeConvData?.assigned_to}
                      humanControl={activeConvData?.human_control}
                      loading={loadingMessages}
                      currentUserId={user.id}
                    />
                  )
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-muted/10">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                      <ChatSkeleton />
                    </div>
                    <p className="text-lg font-medium">Suas conversas aparecem aqui</p>
                    <p className="text-sm">Selecione um contato na lista para iniciar o atendimento.</p>
                  </div>
                )}
              </div>
            </Panel>
          </PanelGroup>
        )}
      </div>
    </AppLayout>
  );
}
