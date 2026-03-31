import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { CalendarClock, MessageSquarePlus, Plus, Trash2 } from 'lucide-react'
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
import { WATargetSelector } from '@/components/calendar/WATargetSelector'
import type { WATarget } from '@/hooks/useWATargets'

interface WorkspaceMember {
  id: string
  name: string
  email?: string | null
  role: string
}

interface ReminderTargetEntry {
  id: string
  waTarget?: WATarget
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
  const [targets, setTargets] = useState<ReminderTargetEntry[]>([{ id: crypto.randomUUID() }])
  const [form, setForm] = useState({
    title: '',
    description: '',
    assignedTo: '',
    priority: 'normal',
    dueAt: toInputDateTime(new Date(Date.now() + 60 * 60 * 1000)),
    reminderEnabled: true,
    reminderEveryMinutes: 10,
    whatsappReminderEnabled: false,
    reminderLeadMinutes: 30,
    recurrenceMode: 'none',
    customRecurrenceMinutes: 1440,
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

  const addTarget = () => setTargets((current) => [...current, { id: crypto.randomUUID() }])

  const removeTarget = (id: string) => {
    setTargets((current) => (current.length > 1 ? current.filter((target) => target.id !== id) : current))
  }

  const updateTarget = (id: string, waTarget: WATarget | undefined) => {
    setTargets((current) => current.map((target) => (target.id === id ? { ...target, waTarget } : target)))
  }

  const getRepeatEveryMinutes = () => {
    if (form.recurrenceMode === 'daily') return 24 * 60
    if (form.recurrenceMode === 'weekly') return 7 * 24 * 60
    if (form.recurrenceMode === 'custom') return Math.max(10, Number(form.customRecurrenceMinutes || 10))
    return Math.max(5, Number(form.reminderEveryMinutes || 10))
  }

  const resetState = () => {
    setTargets([{ id: crypto.randomUUID() }])
    setForm({
      title: contactName ? `Retorno para ${contactName}` : 'Nova tarefa',
      description: '',
      assignedTo: members[0]?.id || '',
      priority: 'normal',
      dueAt: toInputDateTime(new Date(Date.now() + 60 * 60 * 1000)),
      reminderEnabled: true,
      reminderEveryMinutes: 10,
      whatsappReminderEnabled: false,
      reminderLeadMinutes: 30,
      recurrenceMode: 'none',
      customRecurrenceMinutes: 1440,
    })
  }

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
      const validTargets = targets.map((target) => target.waTarget).filter(Boolean) as WATarget[]

      if (form.whatsappReminderEnabled && validTargets.length === 0) {
        toast({
          variant: 'destructive',
          title: 'Selecione pelo menos um destino',
          description: 'Escolha um contato ou grupo para o lembrete via WhatsApp.',
        })
        setLoading(false)
        return
      }

      const { data: profile } = await sb
        .from('profiles')
        .select('team_id')
        .eq('id', user.id)
        .single()

      const teamId = profile?.team_id
      if (form.whatsappReminderEnabled && !teamId) {
        throw new Error('Não foi possível identificar o time para envio do lembrete.')
      }

      const reminderMetadata = {
        popup_interval_minutes: Number(form.reminderEveryMinutes || 10),
        whatsapp_enabled: form.whatsappReminderEnabled,
        reminder_lead_minutes: Number(form.reminderLeadMinutes || 30),
        recurrence_mode: form.recurrenceMode,
        recurrence_interval_minutes: getRepeatEveryMinutes(),
        reminder_targets: validTargets.map((target) => ({
          id: target.id,
          type: target.type,
          display_name: target.display_name,
          jid: target.jid,
          phone_e164: target.phone_e164 || null,
        })),
      }

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
            ...reminderMetadata,
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

      const recurrenceText =
        form.recurrenceMode === 'none'
          ? 'Lembrete único.'
          : form.recurrenceMode === 'daily'
            ? 'Recorrência diária.'
            : form.recurrenceMode === 'weekly'
              ? 'Recorrência semanal.'
              : `Recorrência a cada ${getRepeatEveryMinutes()} minutos.`

      const notificationText = form.whatsappReminderEnabled
        ? `\nNotificações WhatsApp: ${validTargets.map((target) => target.display_name).join(', ')}. ${recurrenceText}`
        : ''

      const { data: calendarEvent, error: calendarError } = await sb
        .from('calendar_events')
        .insert({
          tenant_id: activeTenant.id,
          workspace_id: activeTenant.id,
          title: `Tarefa: ${form.title.trim()}`,
          description: form.description?.trim()
            ? `${form.description.trim()}\n\nResponsável: ${assignee?.name || '-'}${notificationText}`
            : `Responsável: ${assignee?.name || '-'}${notificationText}`,
          start_at: dueIso,
          timezone: 'America/Fortaleza',
          status: 'scheduled',
          created_by: user.id,
        })
        .select()
        .single()

      if (calendarError) throw calendarError

      let reminderJobId: string | null = null
      if (form.whatsappReminderEnabled && calendarEvent?.id && validTargets.length > 0) {
        const leadMinutes = Math.max(0, Number(form.reminderLeadMinutes || 0))
        const firstFire = new Date(new Date(dueIso).getTime() - leadMinutes * 60 * 1000)
        const safeFirstFire = firstFire.getTime() > Date.now() ? firstFire : new Date(Date.now() + 60 * 1000)
        const repeatEveryMinutes = getRepeatEveryMinutes()
        const maxAttempts = form.recurrenceMode === 'none' ? 1 : 180

        const { data: reminderJob, error: reminderJobError } = await sb
          .from('reminder_jobs')
          .insert({
            tenant_id: activeTenant.id,
            event_id: calendarEvent.id,
            first_fire_at: safeFirstFire.toISOString(),
            next_attempt_at: safeFirstFire.toISOString(),
            repeat_every_minutes: repeatEveryMinutes,
            max_attempts: maxAttempts,
            ack_required: false,
            status: 'scheduled',
          })
          .select()
          .single()

        if (reminderJobError) throw reminderJobError
        reminderJobId = reminderJob.id

        const { error: recipientsError } = await sb
          .from('reminder_recipients')
          .insert(
            validTargets.map((target) => ({
              reminder_id: reminderJob.id,
              team_id: teamId,
              type: target.type,
              jid: target.jid,
              display_name: target.display_name,
              phone_e164: target.phone_e164 || null,
              status: 'pending',
              next_attempt_at: safeFirstFire.toISOString(),
            })),
          )

        if (recipientsError) throw recipientsError
      }

      await sb
        .from('workspace_tasks')
        .update({
          calendar_event_id: calendarEvent?.id || null,
          metadata: {
            ...(task.metadata || {}),
            ...reminderMetadata,
            reminder_job_id: reminderJobId,
          },
        })
        .eq('id', task.id)

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

      if (reminderJobId) {
        await sb.from('workspace_task_history').insert({
          tenant_id: activeTenant.id,
          workspace_id: activeTenant.id,
          task_id: task.id,
          actor_id: user.id,
          event_type: 'reminder_configured',
          message: `Lembrete via WhatsApp configurado com recorrência ${form.recurrenceMode === 'none' ? 'única' : form.recurrenceMode}.`,
          metadata: {
            reminder_job_id: reminderJobId,
            targets: validTargets.map((target) => target.display_name),
          },
        })
      }

      toast({
        title: 'Tarefa criada',
        description: form.whatsappReminderEnabled
          ? 'A tarefa entrou na agenda, ficou com o responsável e já teve o lembrete externo configurado.'
          : 'A tarefa já entrou na agenda e ficou vinculada ao responsável.',
      })

      onOpenChange(false)
      onSuccess?.()
      resetState()
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
      <DialogContent className="sm:max-w-[760px] max-h-[90vh] overflow-y-auto">
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
                <span>Lembrete no app</span>
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

          <div className="rounded-lg border p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium">Lembrete via WhatsApp</Label>
                <p className="text-xs text-muted-foreground">
                  Selecione um contato, grupo ou digite um número manualmente para receber a notificação.
                </p>
              </div>
              <Switch
                checked={form.whatsappReminderEnabled}
                onCheckedChange={(checked) => setForm((current) => ({ ...current, whatsappReminderEnabled: checked }))}
              />
            </div>

            {form.whatsappReminderEnabled && (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="grid gap-2">
                    <Label>Primeiro aviso antes do prazo</Label>
                    <Input
                      type="number"
                      min={0}
                      value={form.reminderLeadMinutes}
                      onChange={(e) => setForm((current) => ({ ...current, reminderLeadMinutes: Number(e.target.value || 0) }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Recorrência</Label>
                    <Select
                      value={form.recurrenceMode}
                      onValueChange={(value) => setForm((current) => ({ ...current, recurrenceMode: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Uma vez</SelectItem>
                        <SelectItem value="daily">Diária</SelectItem>
                        <SelectItem value="weekly">Semanal</SelectItem>
                        <SelectItem value="custom">Outro intervalo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Intervalo customizado (min)</Label>
                    <Input
                      type="number"
                      min={10}
                      disabled={form.recurrenceMode !== 'custom'}
                      value={form.customRecurrenceMinutes}
                      onChange={(e) => setForm((current) => ({ ...current, customRecurrenceMinutes: Number(e.target.value || 10) }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Destinos da notificação</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addTarget}>
                      <Plus className="w-4 h-4 mr-2" />
                      Adicionar destino
                    </Button>
                  </div>

                  <div className="space-y-2">
                    {targets.map((target) => (
                      <div key={target.id} className="flex gap-2 items-center">
                        <div className="flex-1">
                          <WATargetSelector
                            value={target.waTarget}
                            onChange={(waTarget) => updateTarget(target.id, waTarget)}
                            placeholder="Contato, grupo ou número manual"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={targets.length === 1}
                          onClick={() => removeTarget(target.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
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
