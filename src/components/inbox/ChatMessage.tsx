"use client";

import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Check, CheckCheck, FileText, Camera, Video, Mic, File } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { AudioPlayer } from './AudioPlayer';
import { MessageFeedback } from './MessageFeedback';
import { MessageActionsMenu } from './MessageActionsMenu';
import { EditMessageModal } from './EditMessageModal';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ChatMessageProps {
  messageId: string;
  conversationId?: string | null;
  content?: string | null;
  messageType: string;
  mediaUrl?: string | null;
  sentAt: string;
  isOutgoing: boolean;
  isSystem?: boolean;
  deliveredAt?: string | null;
  readAt?: string | null;
  senderName?: string | null;
  isAIGenerated?: boolean;
  transcript?: string | null;
  replyPreview?: string | null;
  replySenderName?: string | null;
  onReply?: () => void;
  onMessageDeleted?: (messageId: string) => void;
  onMessageUpdated?: (messageId: string, newContent: string) => void;
}

export function ChatMessage({
  messageId,
  conversationId,
  content,
  messageType,
  mediaUrl,
  sentAt,
  isOutgoing,
  isSystem = false,
  deliveredAt,
  readAt,
  senderName,
  isAIGenerated,
  transcript,
  replyPreview,
  replySenderName,
  onReply,
  onMessageDeleted,
  onMessageUpdated,
}: ChatMessageProps) {
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [localContent, setLocalContent] = useState(content);
  const [isDeleted, setIsDeleted] = useState(false);

  const time = format(new Date(sentAt), 'HH:mm');

  const handleDelete = async () => {
    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('id', messageId);

      if (error) throw error;

      setIsDeleted(true);
      onMessageDeleted?.(messageId);
      toast.success('Mensagem excluída');
    } catch (error) {
      console.error('Error deleting message:', error);
      toast.error('Erro ao excluir mensagem');
    }
  };

  const handleEditSaved = (newContent: string) => {
    setLocalContent(newContent);
    onMessageUpdated?.(messageId, newContent);
  };

  if (isDeleted) return null;

  if (isSystem || messageType === 'system') {
    return (
      <div className="flex justify-center my-3">
        <Badge variant="secondary" className="text-xs px-3 py-1 bg-muted text-muted-foreground font-normal">
          {localContent} • {time}
        </Badge>
      </div>
    );
  }

  const renderMedia = () => {
    if (!mediaUrl) return null;

    switch (messageType) {
      case 'image':
        return (
          <img
            src={mediaUrl}
            alt="Imagem"
            className="max-w-xs rounded-lg cursor-pointer hover:opacity-90 transition-opacity mb-2"
            onClick={() => window.open(mediaUrl, '_blank')}
          />
        );
      case 'video':
        return <video src={mediaUrl} controls className="max-w-xs rounded-lg mb-2" />;
      case 'audio':
        return (
          <div className="flex flex-col gap-2 mb-2">
            <AudioPlayer audioUrl={mediaUrl} />
            {transcript && (
              <div className={cn(
                "text-xs p-2 rounded-md max-w-xs",
                isOutgoing ? "bg-primary-foreground/10 text-primary-foreground/90" : "bg-muted text-muted-foreground"
              )}>
                <span className="font-medium">📝 Transcrição:</span>
                <p className="mt-1 whitespace-pre-wrap">{transcript}</p>
              </div>
            )}
          </div>
        );
      case 'document':
        return (
          <a
            href={mediaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 p-3 bg-background/50 rounded-lg hover:bg-background/70 transition-colors mb-2"
          >
            <FileText className="w-8 h-8" />
            <span className="text-sm">Documento</span>
          </a>
        );
      default:
        return null;
    }
  };

  const formatStatusTime = (dateStr: string) =>
    format(new Date(dateStr), "dd/MM 'às' HH:mm", { locale: ptBR });

  const renderStatus = () => {
    if (!isOutgoing) return null;

    if (readAt) {
      return (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <CheckCheck className="w-4 h-4 text-info cursor-default" />
            </TooltipTrigger>
            <TooltipContent side="top">
              <p className="text-xs">Lido {formatStatusTime(readAt)}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    if (deliveredAt) {
      return (
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <CheckCheck className="w-4 h-4 cursor-default" />
            </TooltipTrigger>
            <TooltipContent side="top">
              <p className="text-xs">Entregue {formatStatusTime(deliveredAt)}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return <Check className="w-4 h-4" />;
  };

  const canEdit = isOutgoing && messageType === 'text';
  const canDelete = ['text', 'image', 'video', 'audio', 'document'].includes(messageType);

  return (
    <div className={cn('flex mb-2 group', isOutgoing ? 'justify-end' : 'justify-start')}>
      {canDelete && (
        <div className={cn('flex items-center', isOutgoing ? 'mr-1' : 'ml-1 order-2')}>
          <MessageActionsMenu
            canEdit={canEdit}
            onEdit={canEdit ? () => setEditModalOpen(true) : undefined}
            onReply={onReply}
            onDelete={handleDelete}
          />
        </div>
      )}

      <div
        className={cn(
          'max-w-[70%] rounded-lg px-3 py-2',
          isOutgoing
            ? 'bg-chat-outgoing text-chat-outgoing-foreground rounded-br-none'
            : 'bg-chat-incoming text-chat-incoming-foreground rounded-bl-none'
        )}
      >
        {senderName && (
          <p className={cn(
            'text-[11px] font-bold mb-1 truncate',
            isOutgoing ? 'text-primary-foreground/80' : 'text-primary'
          )}>
            {senderName}
          </p>
        )}

        {(replyPreview || replySenderName) && (
          <div
            className={cn(
              'mb-2 rounded-md border-l-2 px-2 py-1 text-xs',
              isOutgoing
                ? 'border-primary-foreground/70 bg-primary-foreground/10 text-primary-foreground/90'
                : 'border-primary bg-muted/80 text-muted-foreground'
            )}
          >
            <p className="font-semibold truncate">{replySenderName || 'Mensagem respondida'}</p>
            <p className="truncate">{replyPreview || 'Mensagem sem texto'}</p>
          </div>
        )}

        {renderMedia()}

        {localContent && (
          <p className="text-sm whitespace-pre-wrap break-words">{localContent}</p>
        )}

        <div className={cn('flex items-center gap-1 mt-1', isOutgoing ? 'justify-end' : 'justify-start')}>
          <span className={cn('text-[10px]', isOutgoing ? 'text-primary-foreground/70' : 'text-muted-foreground')}>
            {time}
          </span>
          {renderStatus()}
        </div>

        {isOutgoing && isAIGenerated && localContent && conversationId && (
          <MessageFeedback messageId={messageId} conversationId={conversationId} messageContent={localContent} />
        )}
      </div>

      <EditMessageModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        messageId={messageId}
        currentContent={localContent || ''}
        onSaved={handleEditSaved}
      />
    </div>
  );
}
