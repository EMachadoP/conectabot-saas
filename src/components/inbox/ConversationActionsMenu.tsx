import { useState } from 'react';
import {
  MoreVertical,
  CheckCircle,
  RotateCcw,
  Mail,
  Clock,
  Flag,
  Tag,
  User,
  Users,
  Bot,
  Ban,
  ShieldOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Profile {
  id: string;
  name: string;
}

interface Team {
  id: string;
  name: string;
}

interface Label {
  id: string;
  name: string;
  color: string;
}

interface ConversationActionsMenuProps {
  isResolved: boolean;
  priority?: string;
  profiles: Profile[];
  teams: Team[];
  labels: Label[];
  assignedTo?: string | null;
  isContactBlocked?: boolean;
  onResolve?: () => void;
  onReopen?: () => void;
  onMarkUnread?: () => void;
  onSetPriority?: (priority: string) => void;
  onSnooze?: (until: Date) => void;
  onAssignAgent?: (agentId: string) => void;
  onAssignTeam?: (teamId: string) => void;
  onAddLabel?: (labelId: string) => void;
  onToggleBlockContact?: () => void;
}

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Baixa', color: 'text-muted-foreground' },
  { value: 'normal', label: 'Normal', color: 'text-foreground' },
  { value: 'high', label: 'Alta', color: 'text-yellow-500' },
  { value: 'urgent', label: 'Urgente', color: 'text-destructive' },
];

const SNOOZE_OPTIONS = [
  { label: '1 hora', hours: 1 },
  { label: '3 horas', hours: 3 },
  { label: 'Amanhã', hours: 24 },
  { label: '1 semana', hours: 168 },
];

export function ConversationActionsMenu({
  isResolved,
  priority = 'normal',
  profiles,
  teams,
  labels,
  assignedTo,
  isContactBlocked = false,
  onResolve,
  onReopen,
  onMarkUnread,
  onSetPriority,
  onSnooze,
  onAssignAgent,
  onAssignTeam,
  onAddLabel,
  onToggleBlockContact,
}: ConversationActionsMenuProps) {
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);

  const handleToggleBlock = () => {
    onToggleBlockContact?.();
    setBlockDialogOpen(false);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreVertical className="w-5 h-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={onMarkUnread}>
            <Mail className="w-4 h-4 mr-2" />
            Marcar como não lida
          </DropdownMenuItem>

          {isResolved ? (
            <DropdownMenuItem onClick={onReopen}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Reabrir
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={onResolve}>
              <CheckCircle className="w-4 h-4 mr-2" />
              Marcar como resolvido
            </DropdownMenuItem>
          )}

          <DropdownMenuItem disabled>
            <Bot className="w-4 h-4 mr-2" />
            Devolver ao chatbot
          </DropdownMenuItem>

          {onToggleBlockContact && (
            <DropdownMenuItem
              onClick={() => setBlockDialogOpen(true)}
              className="text-destructive focus:text-destructive"
            >
              {isContactBlocked ? <ShieldOff className="w-4 h-4 mr-2" /> : <Ban className="w-4 h-4 mr-2" />}
              {isContactBlocked ? 'Desbloquear contato' : 'Bloquear contato'}
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Clock className="w-4 h-4 mr-2" />
              Adiar
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {SNOOZE_OPTIONS.map((opt) => (
                <DropdownMenuItem
                  key={opt.hours}
                  onClick={() => {
                    const until = new Date();
                    until.setHours(until.getHours() + opt.hours);
                    onSnooze?.(until);
                  }}
                >
                  {opt.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Flag className="w-4 h-4 mr-2" />
              Prioridade
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {PRIORITY_OPTIONS.map((opt) => (
                <DropdownMenuItem
                  key={opt.value}
                  onClick={() => onSetPriority?.(opt.value)}
                  className={opt.color}
                >
                  {opt.label}
                  {priority === opt.value && <span className="ml-auto">✓</span>}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSeparator />

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Tag className="w-4 h-4 mr-2" />
              Atribuir etiqueta
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {labels.length === 0 ? (
                <DropdownMenuItem disabled>Nenhuma etiqueta</DropdownMenuItem>
              ) : (
                labels.map((label) => (
                  <DropdownMenuItem
                    key={label.id}
                    onClick={() => onAddLabel?.(label.id)}
                  >
                    <span
                      className="w-3 h-3 rounded-full mr-2"
                      style={{ backgroundColor: label.color }}
                    />
                    {label.name}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <User className="w-4 h-4 mr-2" />
              Atribuir Agente
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {profiles.length === 0 ? (
                <DropdownMenuItem disabled>Nenhum agente</DropdownMenuItem>
              ) : (
                profiles.map((profile) => (
                  <DropdownMenuItem
                    key={profile.id}
                    onSelect={() => onAssignAgent?.(profile.id)}
                  >
                    {profile.name}
                    {assignedTo === profile.id && <span className="ml-auto">✓</span>}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Users className="w-4 h-4 mr-2" />
              Atribuir equipe
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {teams.length === 0 ? (
                <DropdownMenuItem disabled>Nenhuma equipe</DropdownMenuItem>
              ) : (
                teams.map((team) => (
                  <DropdownMenuItem
                    key={team.id}
                    onSelect={() => onAssignTeam?.(team.id)}
                  >
                    {team.name}
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isContactBlocked ? 'Desbloquear contato?' : 'Bloquear contato?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isContactBlocked
                ? 'O contato voltará a aparecer normalmente e novas mensagens voltarão a alimentar o inbox.'
                : 'Novas mensagens desse contato serão ignoradas pelo sistema até ele ser desbloqueado.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleToggleBlock} className="bg-destructive hover:bg-destructive/90">
              {isContactBlocked ? 'Desbloquear' : 'Bloquear'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
