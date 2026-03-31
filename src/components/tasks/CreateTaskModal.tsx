import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { CalendarClock, MessageSquarePlus } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useTenant } from '@/contexts/TenantContext'
import { useToast } from '@/hooks/use-toast'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

interface WorkspaceMember {
  id: string
  name: string
  email?: string | null
  role: string
}

interface CreateTaskModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  conversationId?: string | null
  sourceMessageId?: string | null
  contactId?: string | null
  contactName?: string | null
}

function toInputDateTime(date: Date) {
  return format(date, "yyyy-MM-dd'T'HH:mm")
}

export function CreateTaskModal({
  open,
  onOpenChange,
  onSuccess,
  conversationId,
  sourceMessageId,
  contactId,
  contactName,
}: CreateTaskModalProps) {
  const { user } = useAuth()
  const { activeTenant } = useTenant()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [members, setMembers] = useState<WorkspaceMember[]>([])
  const [form, setForm] = useState({
    title: '',
    description: '',
    assignedTo: '',
    priority: 'normal',
    dueAt: toInputDateTime(new Date(Date.now() + 60 * 60 * 1000)),
    reminderEnabled: true,
    reminderEveryMinutes: 10,
  })

  useEffect(() => {
    if (!open || !activeTenant?.id) return

    const loadMembers = async () => {
      const sb = supabase as any
      const { data: memberships } = await sb
        .from('tenant_members')
        .select('user_id, role, is_active')
        .eq('tenant_id', activeTenant.id)
        .eq('is_active', true)

      const userIds = (memberships || []).map((item: any) => item.user_id).filter(Boolean)
      if (!userIds.length) {
        setMembers([])
        return
      }

      const { data: profiles } = await sb
        .from('profiles')
        .select('id, name, display_name, email')
        .in('id', userIds)

      const nextMembers = (profiles || []).map((profile: any) => {
        const membership = memberships.find((item: any) => item.user_id === profile.id)
        return {
          id: profile.id,
          name: profile.display_name || profile.name || profile.email?.split('@')[0] || 'Sem nome',
          email: profile.email ?? null,
          role: membership?.role || 'agent',
        }
      })

      setMembers(nextMembers)
      setForm((current) => ({
        ...current,
        assignedTo: current.assignedTo || nextMembers[0]?.id || '',
      }))
    }

    void loadMembers()
  }, [activeTenant?.id, open])

  useEffect(() => {
    if (!open) return
    setForm((current) => ({
      ...current,
      title: current.title || (contactName ? `Retorno para ${contactName}` : 'Nova tarefa'),
    }))
  }, [contactName, open])

  const assignee = useMemo(
    () => members.find((member) => member.id === form.assignedTo),
    [form.assignedTo, members],
  )

  const handleSubmit = async () => {
    if (!user?.id || !activeTenant?.id) return
    if (!form.title.trim()) {
      toast({ variant: 'destructive', title: 'Informe o título da tarefa' })
      return
    }
    if (!form.assignedTo) {
      toast({ variant: 'destructive', title: 'Selecione o responsável' })
      return
    }

    setLoading(true)

    try {
      const sb = supabase as any
      const nowIso = new Date().toISOString()
      const dueIso = new Date(form.dueAt).toISOString()

      const { data: task, error: taskError } = await sb
        .from('workspace_tasks')
        .insert({
          tenant_id: activeTenant.id,
          workspace_id: activeTenant.id,
          title: form.title.trim(),
          description: form.description.trim() || null,
          status: 'pending',
          priority: form.priority,
          source: conversationId ? (sourceMessageId ? 'message' : 'conversation') : 'manual',
          source_conversation_id: conversationId || null,
          source_message_id: sourceMessageId || null,
          source_contact_id: contactId || null,
          assigned_to: form.assignedTo,
          assigned_by: user.id,
          original_assignee_id: form.assignedTo,
          created_by: user.id,
          due_at: dueIso,
          reminder_enabled: form.reminderEnabled,
          reminder_every_minutes: Number(form.reminderEveryMinutes || 10),
          metadata: {
            contact_name: contactName || null,
          },
        })
        .select()
        .single()

      if (taskError) throw taskError

      await sb.from('workspace_task_history').insert({
        tenant_id: activeTenant.id,
        workspace_id: activeTenant.id,
        task_id: task.id,
        actor_id: user.id,
        event_type: 'created',
        message: `Tarefa criada e atribuída para ${assignee?.name || 'responsável'}.`,
        metadata: {
          assigned_to: form.assignedTo,
          due_at: dueIso,
          source_conversation_id: conversationId || null,
        },
      })

      const { data: calendarEvent } = await sb
        .from('calendar_events')
        .insert({
          tenant_id: activeTenant.id,
          workspace_id: activeTenant.id,
          title: `Tarefa: ${form.title.trim()}`,
          description: form.description?.trim()
            ? `${form.description.trim()}\n\nResponsável: ${assignee?.name || '-'}`
            : `Responsável: ${assignee?.name || '-'}`,
          start_at: dueIso,
          timezone: 'America/Fortaleza',
          status: 'scheduled',
          created_by: user.id,
        })
        .select()
        .single()

      if (calendarEvent?.id) {
        await sb
          .from('workspace_tasks')
          .update({ calendar_event_id: calendarEvent.id })
          .eq('id', task.id)
      }

      if (conversationId) {
        const pauseUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString()
        await sb
          .from('conversations')
          .update({
            assigned_to: form.assignedTo,
            assigned_at: nowIso,
            assigned_by: user.id,
            status: 'open',
            unread_count: 1,
            human_control: true,
            ai_paused_until: pauseUntil,
          })
          .eq('id', conversationId)

        await sb.from('messages').insert({
          workspace_id: activeTenant.id,
          tenant_id: activeTenant.id,
          conversation_id: conversationId,
          sender_type: 'system',
          message_type: 'system',
          content: `📌 Tarefa criada para ${assignee?.name || 'responsável'} com prazo ${new Date(dueIso).toLocaleString('pt-BR')}.`,
          sent_at: nowIso,
        })
      }

      toast({
        title: 'Tarefa criada',
        description: 'A tarefa já entrou na agenda e ficou vinculada ao responsável.',
      })

      onOpenChange(false)
      onSuccess?.()
      setForm({
        title: contactName ? `Retorno para ${contactName}` : 'Nova tarefa',
        description: '',
        assignedTo: members[0]?.id || '',
        priority: 'normal',
        dueAt: toInputDateTime(new Date(Date.now() + 60 * 60 * 1000)),
        reminderEnabled: true,
        reminderEveryMinutes: 10,
      })
    } catch (error: any) {
      console.error('[CreateTaskModal] error', error)
      toast({
        variant: 'destructive',
        title: 'Erro ao criar tarefa',
        description: error.message || 'Não foi possível registrar a tarefa.',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquarePlus className="w-5 h-5" />
            Criar tarefa operacional
          </DialogTitle>
          <DialogDescription>
            A tarefa fica vinculada ao responsável, entra na agenda e pode ser acompanhada pelos KPIs.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Título</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))}
              placeholder="Ex: Retornar cotação com urgência"
            />
          </div>

          <div className="grid gap-2">
            <Label>Descrição</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))}
              placeholder="Contexto da tarefa, próximo passo e observações."
              rows={4}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label>Responsável</Label>
              <Select
                value={form.assignedTo}
                onValueChange={(value) => setForm((current) => ({ ...current, assignedTo: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {members.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Prioridade</Label>
              <Select
                value={form.priority}
                onValueChange={(value) => setForm((current) => ({ ...current, priority: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="urgent">Urgente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Prazo</Label>
              <div className="relative">
                <CalendarClock className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                <Input
                  type="datetime-local"
                  className="pl-9"
                  value={form.dueAt}
                  onChange={(e) => setForm((current) => ({ ...current, dueAt: e.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_140px] gap-4 items-end rounded-lg border p-4">
            <div className="space-y-2">
              <Label className="flex items-center justify-between">
                <span>Lembrete recorrente</span>
                <Switch
                  checked={form.reminderEnabled}
                  onCheckedChange={(checked) => setForm((current) => ({ ...current, reminderEnabled: checked }))}
                />
              </Label>
              <p className="text-xs text-muted-foreground">
                Enquanto a tarefa estiver pendente, o responsável recebe um pop-up recorrente.
              </p>
            </div>
            <div className="grid gap-2">
              <Label>Intervalo (min)</Label>
              <Input
                type="number"
                min={5}
                value={form.reminderEveryMinutes}
                onChange={(e) => setForm((current) => ({ ...current, reminderEveryMinutes: Number(e.target.value || 10) }))}
                disabled={!form.reminderEnabled}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Criando...' : 'Criar tarefa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
