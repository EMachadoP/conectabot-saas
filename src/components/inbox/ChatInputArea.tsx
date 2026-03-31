"use client";

import React, { useState, useRef } from 'react';
import { Send, Paperclip, Reply, X, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const handleSend = () => {
    if (message.trim()) {
      onSendMessage(message.trim());
      setMessage('');
    }
  };

  const handleSelectedFile = (file: File | null | undefined) => {
    if (!file || !onSendFile) return;
    onSendFile(file);
  };

  const insertLineBreak = () => {
    setMessage((current) => `${current}\n`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      handleSend();
      return;
    }

    if (e.key === 'Enter' && (e.shiftKey || e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      insertLineBreak();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData?.items || []);
    const fileItem = items.find((item) => item.kind === 'file');

    if (fileItem) {
      e.preventDefault();
      handleSelectedFile(fileItem.getAsFile());
    }
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer?.types.includes('Files')) {
      setIsDragActive(true);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragActive(false);
    const file = e.dataTransfer?.files?.[0];
    handleSelectedFile(file);
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
    <div
      className={`p-3 border-t border-border bg-card transition-colors ${isMobile ? 'pb-safe' : ''} ${isDragActive ? 'bg-primary/5' : ''}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
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

      {isDragActive && (
        <div className="mb-3 flex items-center gap-2 rounded-lg border border-dashed border-primary bg-primary/5 px-3 py-2 text-sm text-primary">
          <Upload className="h-4 w-4" />
          Solte o arquivo aqui para anexar
        </div>
      )}

      <div className="flex items-end gap-2">
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
            handleSelectedFile(file);
            if (fileInputRef.current) fileInputRef.current.value = '';
          }}
        />
        <Textarea
          placeholder="Digite uma mensagem..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          className="min-h-[44px] max-h-40 flex-1 resize-none"
          autoComplete="off"
        />
        <Button onClick={handleSend} disabled={!message.trim()} className="shrink-0">
          <Send className="w-5 h-5" />
        </Button>
      </div>

      <div className="mt-2 text-xs text-muted-foreground">
        `Enter` envia. `Ctrl + Enter` ou `Shift + Enter` quebra linha. Arraste ou cole um arquivo para anexar.
      </div>
    </div>
  );
}
