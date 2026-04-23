import { useEffect, useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConversationItem } from './ConversationItem';

interface Conversation {
  id: string;
  contact: {
    name: string;
    profile_picture_url?: string | null;
  };
  last_message?: string | null;
  last_message_type?: string;
  last_message_at?: string | null;
  unread_count: number;
  marked_unread?: boolean;
  assigned_to?: string | null;
  status: string;
}

interface ConversationListProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  userId: string;
  onSelectConversation: (id: string) => void;
  onClearSelection?: () => void;
  isMobile?: boolean;
}

type TabValue = 'mine' | 'inbox' | 'resolved';

export function ConversationList({
  conversations,
  activeConversationId,
  userId,
  onSelectConversation,
  onClearSelection,
  isMobile = false,
}: ConversationListProps) {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<TabValue>('inbox');

  const filteredConversations = useMemo(() => conversations.filter((conv) => {
    if (!conv.contact) return false;
    const contactName = conv.contact.name || '';
    const lastMessage = conv.last_message || '';
    const normalizedSearch = search.toLowerCase();
    const matchesSearch =
      contactName.toLowerCase().includes(normalizedSearch) ||
      lastMessage.toLowerCase().includes(normalizedSearch);

    if (!matchesSearch) return false;

    switch (activeTab) {
      case 'mine':
        return conv.status === 'open' && conv.assigned_to === userId;
      case 'inbox':
        return conv.status === 'open' && conv.assigned_to !== userId;
      case 'resolved':
        return conv.status === 'resolved';
      default:
        return true;
    }
  }), [conversations, activeTab, search, userId]);

  const countByTab = useMemo(() => ({
    mine: conversations.filter(c => c.status === 'open' && c.assigned_to === userId).length,
    inbox: conversations.filter(c => c.status === 'open' && c.assigned_to !== userId).length,
    resolved: conversations.filter(c => c.status === 'resolved').length,
  }), [conversations, userId]);

  // Sync active tab to match the active conversation's current status/assignment.
  // Runs when conversations data changes so the tab switch happens in the same
  // render batch as the status update — eliminating the "flash of empty list".
  useEffect(() => {
    if (!activeConversationId) return;

    const activeConv = conversations.find((c) => c.id === activeConversationId);
    if (!activeConv) {
      onClearSelection?.();
      return;
    }

    let targetTab: TabValue;
    if (activeConv.status === 'resolved') {
      targetTab = 'resolved';
    } else if (activeConv.assigned_to === userId) {
      targetTab = 'mine';
    } else {
      targetTab = 'inbox';
    }

    setActiveTab(targetTab);
  }, [activeConversationId, conversations, userId, onClearSelection]);

  return (
    <div className="w-full md:border-r border-border flex flex-col bg-card h-full overflow-hidden min-w-0">
      <div className="shrink-0 p-3 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar conversas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 text-sm md:text-base"
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)} className="shrink-0 border-b border-border">
        <TabsList className="w-full h-auto p-0 bg-transparent grid grid-cols-3">
          <TabsTrigger value="mine" className="text-xs px-1.5 md:px-2 py-3 h-auto min-w-0 truncate">Minhas ({countByTab.mine})</TabsTrigger>
          <TabsTrigger value="inbox" className="text-xs px-1.5 md:px-2 py-3 h-auto min-w-0 truncate">Entrada ({countByTab.inbox})</TabsTrigger>
          <TabsTrigger value="resolved" className="text-xs px-1.5 md:px-2 py-3 h-auto min-w-0 truncate">Resolvidos ({countByTab.resolved})</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex-1 overflow-y-auto">
        {filteredConversations.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground text-sm">
            Nenhuma conversa encontrada
          </div>
        ) : (
          filteredConversations.map((conv) => (
            <ConversationItem
              key={conv.id}
              id={conv.id}
              contactName={conv.contact.name || 'Sem Nome'}
              contactImageUrl={conv.contact.profile_picture_url}
              lastMessage={conv.last_message}
              lastMessageType={conv.last_message_type}
              lastMessageAt={conv.last_message_at}
              unreadCount={conv.unread_count}
              markedUnread={conv.marked_unread}
              isActive={conv.id === activeConversationId}
              onClick={() => onSelectConversation(conv.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
