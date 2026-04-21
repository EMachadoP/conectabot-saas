"use client";

import React from 'react';
import { Users, FileText, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConversationAvatar } from './ConversationAvatar';
import { ConversationActionsMenu } from './ConversationActionsMenu';
import { AudioSettingsMenu } from './AudioSettingsMenu';
import { cn } from '@/lib/utils';

type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'error';

interface ChatHeaderProps {
  conversationId: string;
  contact: any;
  isMobile: boolean;
  isResolved: boolean;
  conversationPriority: string;
  audioEnabled?: boolean;
  audioAutoTranscribe?: boolean;
  profiles: any[];
  teams: any[];
  labels: any[];
  assignedTo?: string | null;
  isContactBlocked?: boolean;
  connectionStatus?: ConnectionStatus;
  onResolveConversation?: () => void;
  onReopenConversation?: () => void;
  onMarkUnread?: () => void;
  onSetPriority?: (priority: string) => void;
  onSnooze?: (until: Date) => void;
  onAssignAgent?: (agentId: string) => void;
  onAssignTeam?: (teamId: string) => void;
  onAddLabel?: (labelId: string) => void;
  onGenerateProtocol?: () => void;
  onCreateTask?: () => void;
  onAudioSettingsChange?: () => void;
  onToggleBlockContact?: () => void;
  onBack?: () => void;
}

export function ChatHeader({
  conversationId,
  contact,
  isMobile,
  isResolved,
  conversationPriority,
  audioEnabled = true,
  audioAutoTranscribe = true,
  profiles,
  teams,
  labels,
  assignedTo,
  isContactBlocked = false,
  connectionStatus = 'connected',
  onResolveConversation,
  onReopenConversation,
  onMarkUnread,
  onSetPriority,
  onSnooze,
  onAssignAgent,
  onAssignTeam,
  onAddLabel,
  onGenerateProtocol,
  onCreateTask,
  onAudioSettingsChange,
  onToggleBlockContact,
  onBack,
}: ChatHeaderProps) {
  const showConnectionStatus = connectionStatus === 'reconnecting' || connectionStatus === 'error';
  const connectionLabel = connectionStatus === 'error' ? 'Sem conexão' : 'Reconectando';

  return (
    <div className="h-14 md:h-14 shrink-0 border-b border-border flex items-center justify-between gap-2 px-3 md:px-4 min-w-0">
      <div className="flex items-center gap-3 min-w-0">
        {isMobile && onBack && (
          <Button variant="ghost" size="icon" className="-ml-3 shrink-0" onClick={onBack} aria-label="Voltar">
            <ArrowLeft />
          </Button>
        )}
        {contact.is_group ? (
          <div className="size-10 shrink-0 rounded-full bg-primary/20 flex items-center justify-center">
            <Users className="text-primary" />
          </div>
        ) : (
          <ConversationAvatar name={contact.name} imageUrl={contact.profile_picture_url} />
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <p className="font-medium truncate text-sm md:text-base">{contact.name}</p>
            {contact.is_group && (
              <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded shrink-0">Grupo</span>
            )}
            {isContactBlocked && (
              <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded shrink-0">Bloqueado</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {contact.phone || contact.lid || 'Sem identificação'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 md:gap-2 shrink-0">
        {showConnectionStatus && (
          <span
            title={connectionLabel}
            className={cn(
              'inline-flex items-center gap-1 text-xs font-medium',
              connectionStatus === 'error' ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            <span className="size-2 rounded-full bg-current" aria-hidden="true" />
            <span className="sr-only sm:not-sr-only">{connectionLabel}</span>
          </span>
        )}

        {onGenerateProtocol && (
          <Button
            size={isMobile ? 'icon' : 'sm'}
            variant="outline"
            onClick={onGenerateProtocol}
            aria-label="Gerar protocolo"
            title="Gerar protocolo"
          >
            <FileText data-icon={isMobile ? undefined : 'inline-start'} />
            <span className="hidden md:inline">Gerar Protocolo</span>
          </Button>
        )}

        {onCreateTask && (
          <Button
            size={isMobile ? 'icon' : 'sm'}
            variant="outline"
            onClick={onCreateTask}
            aria-label="Criar tarefa"
            title="Criar tarefa"
          >
            <FileText data-icon={isMobile ? undefined : 'inline-start'} />
            <span className="hidden md:inline">Criar tarefa</span>
          </Button>
        )}

        <AudioSettingsMenu
          conversationId={conversationId}
          audioEnabled={audioEnabled}
          audioAutoTranscribe={audioAutoTranscribe}
          onSettingsChange={onAudioSettingsChange}
        />

        <ConversationActionsMenu
          isResolved={isResolved}
          priority={conversationPriority}
          profiles={profiles}
          teams={teams}
          labels={labels}
          assignedTo={assignedTo}
          isContactBlocked={isContactBlocked}
          onResolve={onResolveConversation}
          onReopen={onReopenConversation}
          onMarkUnread={onMarkUnread}
          onSetPriority={onSetPriority}
          onSnooze={onSnooze}
          onAssignAgent={onAssignAgent}
          onAssignTeam={onAssignTeam}
          onAddLabel={onAddLabel}
          onToggleBlockContact={onToggleBlockContact}
        />
      </div>
    </div>
  );
}
