import { useMemo } from 'react'
import { CheckCircle2, ExternalLink, TimerReset } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'

interface TaskDetailSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: any | null
  history: any[]
  usersById: Record<string, string>
  onComplete: (task: any) => void
  onCancel: (task: any) => void
}

export function TaskDetailSheet({
  open,
  onOpenChange,
  task,
  history,
  usersById,
  onComplete,
  onCancel,
}: TaskDetailSheetProps) {
  const navigate = useNavigate()

  const auditLabel = useMemo(() => {
    if (!task?.completed_by || !task?.assigned_to) return null
    if (task.completed_by === task.assigned_to) return null
    return `${usersById[task.completed_by] || 'Outro usuário'} concluiu no lugar do responsável original.`
  }, [task?.assigned_to, task?.completed_by, usersById])

  const reminderTargets = task?.metadata?.reminder_targets || []
  const recurrenceLabel =
    task?.metadata?.recurrence_mode === 'daily'
      ? 'Diária'
      : task?.metadata?.recurrence_mode === 'weekly'
        ? 'Semanal'
        : task?.metadata?.recurrence_mode === 'custom'
          ? `A cada ${task?.metadata?.recurrence_interval_minutes || '-'} min`
          : 'Uma vez'

  if (!task) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{task.title}</SheetTitle>
          <SheetDescription>
            Controle de execução, prazo, histórico e vínculo com a conversa original.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-6">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{task.status}</Badge>
            <Badge variant="secondary">{task.priority}</Badge>
            {auditLabel && <Badge variant="destructive">{auditLabel}</Badge>}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border p-4 space-y-2">
              <div className="text-xs uppercase text-muted-foreground">Responsável</div>
              <div className="font-medium">{usersById[task.assigned_to] || 'Não atribuído'}</div>
            </div>
            <div className="rounded-lg border p-4 space-y-2">
              <div className="text-xs uppercase text-muted-foreground">Prazo</div>
              <div className="font-medium">{new Date(task.due_at).toLocaleString('pt-BR')}</div>
            </div>
            <div className="rounded-lg border p-4 space-y-2">
              <div className="text-xs uppercase text-muted-foreground">Primeira resposta</div>
              <div className="font-medium">
                {task.first_response_at ? new Date(task.first_response_at).toLocaleString('pt-BR') : 'Ainda não houve resposta'}
              </div>
            </div>
            <div className="rounded-lg border p-4 space-y-2">
              <div className="text-xs uppercase text-muted-foreground">Último operador</div>
              <div className="font-medium">{usersById[task.last_response_by] || '-'}</div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border p-4 space-y-2">
              <div className="text-xs uppercase text-muted-foreground">Lembrete no app</div>
              <div className="font-medium">
                {task.reminder_enabled ? `Ativo a cada ${task.reminder_every_minutes || '-'} min` : 'Desligado'}
              </div>
            </div>
            <div className="rounded-lg border p-4 space-y-2">
              <div className="text-xs uppercase text-muted-foreground">Lembrete WhatsApp</div>
              <div className="font-medium">
                {task?.metadata?.whatsapp_enabled ? recurrenceLabel : 'Não configurado'}
              </div>
            </div>
          </div>

          {reminderTargets.length > 0 && (
            <div className="rounded-lg border p-4 space-y-2">
              <div className="text-xs uppercase text-muted-foreground">Destinos de notificação</div>
              <div className="flex flex-wrap gap-2">
                {reminderTargets.map((target: any) => (
                  <Badge key={`${target.jid}-${target.display_name}`} variant="outline">
                    {target.display_name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {task.description && (
            <div className="rounded-lg border p-4 space-y-2">
              <div className="text-xs uppercase text-muted-foreground">Descrição</div>
              <div className="whitespace-pre-wrap text-sm">{task.description}</div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {task.source_conversation_id && (
              <Button variant="outline" onClick={() => navigate(`/inbox/${task.source_conversation_id}`)}>
                <ExternalLink className="w-4 h-4 mr-2" />
                Abrir conversa original
              </Button>
            )}
            {task.status !== 'completed' && task.status !== 'canceled' && (
              <>
                <Button onClick={() => onComplete(task)}>
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Concluir tarefa
                </Button>
                <Button variant="destructive" onClick={() => onCancel(task)}>
                  <TimerReset className="w-4 h-4 mr-2" />
                  Cancelar tarefa
                </Button>
              </>
            )}
          </div>

          <Separator />

          <div className="space-y-3">
            <h3 className="font-semibold">Histórico de auditoria</h3>
            <div className="space-y-3">
              {history.length === 0 && (
                <div className="text-sm text-muted-foreground">Nenhum evento registrado.</div>
              )}
              {history.map((entry) => (
                <div key={entry.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-sm">{entry.message}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {usersById[entry.actor_id] || 'Sistema'}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(entry.created_at).toLocaleString('pt-BR')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <SheetFooter />
      </SheetContent>
    </Sheet>
  )
}
