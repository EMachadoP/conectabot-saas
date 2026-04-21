"use client";

import { useRef, useState, type PointerEvent } from 'react';
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { ChatInputArea } from './ChatInputArea';
import { ParticipantHeader } from './ParticipantHeader';
import { IdentifyParticipantModal } from './IdentifyParticipantModal';
import { AIControlBar } from './AIControlBar';
import { HumanActionBar } from './HumanActionBar';
import { GenerateProtocolModal } from './GenerateProtocolModal';
import { CreateTaskModal } from '@/components/tasks/CreateTaskModal';
import { CondominiumChips } from './CondominiumSelector';
import { ContactMemoryPanel } from './ContactMemoryPanel';
import { useParticipantInfo } from '@/hooks/useParticipantInfo';
import { useContactCondominiums } from '@/hooks/useContactCondominiums';
import { toast } from 'sonner';

interface ChatAreaProps {
  contact: any | null;
  messages: any[];
  profiles: any[];
  teams?: any[];
  labels?: any[];
  conversationId?: string | null;
  conversationStatus?: string;
  conversationPriority?: string;
  assignedTo?: string | null;
  aiMode?: 'AUTO' | 'COPILOT' | 'OFF';
  aiPausedUntil?: string | null;
  humanControl?: boolean;
  activeCondominiumId?: string | null;
  activeCondominiumSetBy?: string | null;
  audioEnabled?: boolean;
  audioAutoTranscribe?: boolean;
  currentUserId?: string;
  onSendMessage: (content: string) => void;
  onReplyMessage?: (message: any) => void;
  replyTarget?: any | null;
  onCancelReply?: () => void;
  onSendFile?: (file: File) => void;
  onResolveConversation?: () => void;
  onReopenConversation?: () => void;
  onMarkUnread?: () => void;
  onSetPriority?: (priority: string) => void;
  onSnooze?: (until: Date) => void;
  onAssignAgent?: (agentId: string) => void;
  onAssignTeam?: (teamId: string) => void;
  onAddLabel?: (labelId: string) => void;
  onAiModeChange?: (mode: 'AUTO' | 'COPILOT' | 'OFF') => void;
  onSelectCondominium?: (condominiumId: string) => void;
  onProtocolCreated?: (code: string) => void;
  onAudioSettingsChange?: () => void;
  onToggleBlockContact?: () => void;
  loading?: boolean;
  connectionStatus?: 'connecting' | 'connected' | 'reconnecting' | 'error';
  isMobile?: boolean;
  onBack?: () => void;
}

export function ChatArea(props: ChatAreaProps) {
  const { contact, messages, conversationId, loading, isMobile } = props;
  const [identifyModalOpen, setIdentifyModalOpen] = useState(false);
  const [protocolModalOpen, setProtocolModalOpen] = useState(false);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [participantHeaderRefreshKey, setParticipantHeaderRefreshKey] = useState(0);
  const swipeStartRef = useRef<{ x: number; y: number; pointerId: number } | null>(null);

  const { participant, contactInfo, displayNameType, refetch: refetchParticipant } =
    useParticipantInfo(contact?.id, conversationId ?? undefined);

  const { condominiums, loading: loadingCondos } = useContactCondominiums(contact?.id ?? null);

  if (!contact) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/30">
        <div className="text-center text-muted-foreground p-6">
          <p className="text-lg font-medium">Selecione uma conversa</p>
          <p className="text-sm">Escolha um contato para ver o histórico</p>
        </div>
      </div>
    );
  }

  const isResolved = props.conversationStatus === 'resolved';
  const isContactBlocked = Array.isArray(contact.tags) && contact.tags.includes('blocked');
  const latestInboundMessage = [...messages]
    .reverse()
    .find((message) => message.sender_type !== 'agent' && message.message_type !== 'system');
  const canSwipeBack = Boolean(isMobile && props.onBack);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!canSwipeBack || event.pointerType === 'mouse') return;

    const target = event.target as HTMLElement;
    if (target.closest('button,a,input,textarea,[role="button"],[contenteditable="true"]')) return;

    swipeStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
    };
  };

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start || start.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - start.x;
    const deltaY = Math.abs(event.clientY - start.y);

    if (deltaX > 90 && deltaY < 60) {
      props.onBack?.();
    }
  };

  return (
    <div
      className="flex-1 flex flex-col bg-background h-full overflow-hidden touch-pan-y"
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => {
        swipeStartRef.current = null;
      }}
    >
      <ChatHeader
        conversationId={conversationId || ''}
        contact={contact}
        isMobile={!!isMobile}
        isResolved={isResolved}
        conversationPriority={props.conversationPriority || 'normal'}
        audioEnabled={props.audioEnabled}
        audioAutoTranscribe={props.audioAutoTranscribe}
        profiles={props.profiles}
        teams={props.teams || []}
        labels={props.labels || []}
        assignedTo={props.assignedTo}
        isContactBlocked={isContactBlocked}
        connectionStatus={props.connectionStatus}
        onResolveConversation={props.onResolveConversation}
        onReopenConversation={props.onReopenConversation}
        onMarkUnread={props.onMarkUnread}
        onSetPriority={props.onSetPriority}
        onSnooze={props.onSnooze}
        onAssignAgent={props.onAssignAgent}
        onAssignTeam={props.onAssignTeam}
        onAddLabel={props.onAddLabel}
        onGenerateProtocol={() => setProtocolModalOpen(true)}
        onCreateTask={() => setTaskModalOpen(true)}
        onAudioSettingsChange={props.onAudioSettingsChange}
        onToggleBlockContact={props.onToggleBlockContact}
        onBack={props.onBack}
      />

      {conversationId && (
        <AIControlBar
          conversationId={conversationId}
          aiMode={props.aiMode || 'AUTO'}
          aiPausedUntil={props.aiPausedUntil ?? null}
          humanControl={props.humanControl || false}
          onModeChange={props.onAiModeChange}
        />
      )}

      {!contact.is_group && (
        <ParticipantHeader
          refreshKey={participantHeaderRefreshKey}
          contactId={contact.id}
          phone={contact.phone}
          whatsappDisplayName={contactInfo?.whatsapp_display_name || contact.whatsapp_display_name}
          participant={participant}
          displayNameType={displayNameType}
          conversationId={conversationId ?? undefined}
          condominiums={condominiums}
          activeCondominiumId={props.activeCondominiumId}
          activeCondominiumSetBy={props.activeCondominiumSetBy}
          onIdentify={() => setIdentifyModalOpen(true)}
          onSelectCondominium={props.onSelectCondominium}
        />
      )}

      {!contact.is_group && contact?.id && (
        <ContactMemoryPanel
          contact={contact}
          currentUserId={props.currentUserId}
        />
      )}

      {!props.activeCondominiumId && condominiums.length > 1 && props.onSelectCondominium && (
        <div className="px-4 py-2">
          <CondominiumChips condominiums={condominiums} onSelect={props.onSelectCondominium} />
        </div>
      )}

      <MessageList
        messages={messages}
        loading={loading}
        conversationId={conversationId}
        profiles={props.profiles}
        contactName={participant?.name || contact?.name}
        onReplyMessage={props.onReplyMessage}
      />

      {conversationId && (
        <HumanActionBar
          conversationId={conversationId}
          humanControl={props.humanControl || false}
          aiMode={props.aiMode || 'AUTO'}
          onResolveConversation={props.onResolveConversation}
          onGenerateProtocol={() => setProtocolModalOpen(true)}
          onCreateTask={() => setTaskModalOpen(true)}
          onAiModeChange={props.onAiModeChange}
        />
      )}

      <ChatInputArea
        onSendMessage={props.onSendMessage}
        onSendFile={props.onSendFile}
        isResolved={isResolved}
        isMobile={!!isMobile}
        replyTarget={props.replyTarget ? {
          senderName: props.replyTarget.agent_name || props.replyTarget.sender_name,
          content: props.replyTarget.content,
          messageType: props.replyTarget.message_type,
        } : null}
        onCancelReply={props.onCancelReply}
      />

      {contact?.id && conversationId && (
        <IdentifyParticipantModal
          open={identifyModalOpen}
          onOpenChange={setIdentifyModalOpen}
          contactId={contact.id}
          conversationId={conversationId}
          workspaceId={contact.workspace_id ?? null}
          tenantId={contact.tenant_id ?? contact.workspace_id ?? null}
          contactName={contact.name ?? null}
          existingParticipant={participant}
          onSaved={() => {
            void refetchParticipant();
            setParticipantHeaderRefreshKey((current) => current + 1);
          }}
        />
      )}

      {conversationId && (
        <GenerateProtocolModal
          open={protocolModalOpen}
          onOpenChange={setProtocolModalOpen}
          conversationId={conversationId}
          contactId={contact?.id}
          condominiums={condominiums}
          activeCondominiumId={props.activeCondominiumId}
          participant={participant}
          currentUserId={props.currentUserId}
          onProtocolCreated={(code) => {
            props.onProtocolCreated?.(code);
            toast.success(`Protocolo ${code} criado`);
          }}
        />
      )}

      {conversationId && (
        <CreateTaskModal
          open={taskModalOpen}
          onOpenChange={setTaskModalOpen}
          conversationId={conversationId}
          sourceMessageId={latestInboundMessage?.id ?? null}
          contactId={contact?.id ?? null}
          contactName={participant?.name || contact?.name || null}
        />
      )}
    </div>
  );
}
