"use client";

import React, { useState, useRef } from 'react';
import { Send, Paperclip, Reply, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmojiPicker } from './EmojiPicker';

interface ChatInputAreaProps {
  onSendMessage: (content: string) => void;
  onSendFile?: (file: File) => void;
  isResolved: boolean;
  isMobile: boolean;
  replyTarget?: {
    senderName?: string | null;
    content?: string | null;
    messageType?: string | null;
  } | null;
  onCancelReply?: () => void;
}

export function ChatInputArea({ onSendMessage, onSendFile, isResolved, isMobile, replyTarget, onCancelReply }: ChatInputAreaProps) {
  const [message, setMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    if (message.trim()) {
      onSendMessage(message.trim());
      setMessage('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isResolved) {
    return (
      <div className={`p-3 border-t border-border bg-card ${isMobile ? 'pb-safe' : ''}`}>
        <div className="text-center text-muted-foreground text-sm py-2">
          Conversa resolvida. {!isMobile && 'Use o menu para reabrir.'}
        </div>
      </div>
    );
  }

  return (
    <div className={`p-3 border-t border-border bg-card ${isMobile ? 'pb-safe' : ''}`}>
      {replyTarget && (
        <div className="mb-3 flex items-start justify-between gap-3 rounded-lg border bg-muted/50 px-3 py-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-medium text-primary">
              <Reply className="h-3.5 w-3.5" />
              Respondendo a {replyTarget.senderName || 'mensagem'}
            </div>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {replyTarget.content || `[${replyTarget.messageType || 'mensagem'}]`}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onCancelReply}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="flex items-center gap-2">
        <EmojiPicker onEmojiSelect={(emoji) => setMessage(prev => prev + emoji)} />
        <Button variant="ghost" size="icon" className="shrink-0" onClick={() => fileInputRef.current?.click()}>
          <Paperclip className="w-5 h-5" />
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file && onSendFile) onSendFile(file);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }}
        />
        <Input
          placeholder="Digite uma mensagem..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex-1"
          autoComplete="off"
        />
        <Button onClick={handleSend} disabled={!message.trim()} className="shrink-0">
          <Send className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}
