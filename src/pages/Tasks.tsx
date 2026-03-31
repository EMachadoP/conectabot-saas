import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Clock3, Plus, Save, Timer, Users, Zap } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useTenant } from '@/contexts/TenantContext'
import { AppLayout } from '@/components/layout/AppLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { CreateTaskModal } from '@/components/tasks/CreateTaskModal'
import { TaskDetailSheet } from '@/components/tasks/TaskDetailSheet'

function avg(values: number[]) {
  if (!values.length) return 0
  return values.reduce((total, value) => total + value, 0) / values.length
}

function toInputDateTime(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value)
  const pad = (num: number) => String(num).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export default function TasksPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, loading: authLoading } = useAuth()
  const { activeTenant } = useTenant()
  const [tab, setTab] = useState('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<any | null>(null)
  const [editingTask, setEditingTask] = useState<any | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    assignedTo: '',
    priority: 'normal',
    dueAt: '',
    status: 'pending',
    reminderEnabled: true,
    reminderEveryMinutes: 10,
  })

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['workspace_tasks', activeTenant?.id],
    enabled: !!activeTenant?.id,
    refetchInterval: 30000,
    queryFn: async () => {
      const sb = supabase as any
      const { data, error } = await sb
        .from('workspace_tasks')
        .select('*')
        .eq('workspace_id', activeTenant.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    },
  })

  const { data: histories = [] } = useQuery({
    queryKey: ['workspace_task_history', activeTenant?.id],
    enabled: !!activeTenant?.id,
    queryFn: async () => {
      const sb = supabase as any
      const { data, error } = await sb
        .from('workspace_task_history')
        .select('*')
        .eq('workspace_id', activeTenant.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    },
  })

  const { data: members = [] } = useQuery({
    queryKey: ['workspace_task_members', activeTenant?.id],
    enabled: !!activeTenant?.id,
    queryFn: async () => {
      const sb = supabase as any
      const { data: memberships } = await sb
        .from('tenant_members')
        .select('user_id, role, is_active')
        .eq('tenant_id', activeTenant.id)
        .eq('is_active', true)

      const ids = (memberships || []).map((item: any) => item.user_id).filter(Boolean)
      if (!ids.length) return []

      const { data: profiles } = await sb
        .from('profiles')
        .select('id, name, display_name, email')
        .in('id', ids)

      return (profiles || []).map((profile: any) => ({
        id: profile.id,
        name: profile.display_name || profile.name || profile.email?.split('@')[0] || 'Sem nome',
      }))
    },
  })

  const usersById = useMemo(
    () => Object.fromEntries(members.map((member: any) => [member.id, member.name])),
    [members],
  )

  const now = Date.now()

  const metrics = useMemo(() => {
    const responded = tasks.filter((task: any) => task.first_response_at || task.completed_at)
    const onTime = responded.filter((task: any) => {
      const responseTime = task.first_response_at || task.completed_at
      return responseTime && new Date(responseTime).getTime() <= new Date(task.due_at).getTime()
    })
    const pending = tasks.filter((task: any) => !['completed', 'canceled'].includes(task.status))
    const overdue = pending.filter((task: any) => new Date(task.due_at).getTime() < now)
    const dueSoon = pending.filter((task: any) => {
      const due = new Date(task.due_at).getTime()
      return due >= now && due <= now + 24 * 60 * 60 * 1000
    })
    const responseTimes = responded
      .map((task: any) => {
        const responseAt = task.first_response_at || task.completed_at
        if (!responseAt) return null
        return (new Date(responseAt).getTime() - new Date(task.created_at).getTime()) / 60000
      })
      .filter((value: number | null): value is number => value !== null)

    return {
      total: tasks.length,
      responded: responded.length,
      onTime: onTime.length,
      pending: pending.length,
      overdue: overdue.length,
      dueSoon: dueSoon.length,
      avgResponseMinutes: avg(responseTimes),
    }
  }, [now, tasks])

  const agentRows = useMemo(() => {
    return members
      .map((member: any) => {
        const assigned = tasks.filter((task: any) => task.assigned_to === member.id)
        const completed = assigned.filter((task: any) => task.status === 'completed')
        const onTime = assigned.filter((task: any) => {
          const responseAt = task.first_response_at || task.completed_at
          return responseAt && new Date(responseAt).getTime() <= new Date(task.due_at).getTime()
        })
        const pending = assigned.filter((task: any) => !['completed', 'canceled'].includes(task.status))
        const overdue = pending.filter((task: any) => new Date(task.due_at).getTime() < now)
        const avgMinutes = avg(
          assigned
            .map((task: any) => {
              const responseAt = task.first_response_at || task.completed_at
              if (!responseAt) return null
              return (new Date(responseAt).getTime() - new Date(task.created_at).getTime()) / 60000
            })
            .filter((value: number | null): value is number => value !== null),
        )
        const slaScore = assigned.length ? Math.round((onTime.length / assigned.length) * 100) : 0

        return {
          ...member,
          assigned: assigned.length,
          completed: completed.length,
          pending: pending.length,
          overdue: overdue.length,
          onTime: onTime.length,
          avgMinutes,
          slaScore,
        }
      })
      .sort((a, b) => {
        if (b.slaScore !== a.slaScore) return b.slaScore - a.slaScore
        return b.completed - a.completed
      })
  }, [members, now, tasks])

  const riskTasks = useMemo(() => {
    return tasks
      .filter((task: any) => !['completed', 'canceled'].includes(task.status))
      .map((task: any) => {
        const due = new Date(task.due_at).getTime()
        const diff = due - now
        return {
          ...task,
          isOverdue: diff < 0,
          minutesLeft: Math.round(diff / 60000),
        }
      })
      .filter((task: any) => task.isOverdue || task.minutesLeft <= 24 * 60)
      .sort((a: any, b: any) => a.minutesLeft - b.minutesLeft)
      .slice(0, 6)
  }, [now, tasks])

  const filteredTasks = useMemo(() => {
    if (tab === 'mine') return tasks.filter((task: any) => task.assigned_to === user?.id)
    if (tab === 'pending') return tasks.filter((task: any) => !['completed', 'canceled'].includes(task.status))
    if (tab === 'overdue') return tasks.filter((task: any) => !['completed', 'canceled'].includes(task.status) && new Date(task.due_at).getTime() < now)
    if (tab === 'completed') return tasks.filter((task: any) => task.status === 'completed')
    return tasks
  }, [now, tab, tasks, user?.id])

  const selectedHistory = useMemo(
    () => histories.filter((entry: any) => entry.task_id === selectedTask?.id),
    [histories, selectedTask?.id],
  )

  useEffect(() => {
    if (!editingTask) return
    setEditForm({
      title: editingTask.title || '',
      description: editingTask.description || '',
      assignedTo: editingTask.assigned_to || '',
      priority: editingTask.priority || 'normal',
      dueAt: toInputDateTime(editingTask.due_at || new Date()),
      status: editingTask.status || 'pending',
      reminderEnabled: Boolean(editingTask.reminder_enabled),
      reminderEveryMinutes: Number(editingTask.reminder_every_minutes || 10),
    })
  }, [editingTask])

  const invalidateTaskQueries = async () => {
    await queryClient.invalidateQueries({ queryKey: ['workspace_tasks', activeTenant?.id] })
    await queryClient.invalidateQueries({ queryKey: ['workspace_task_history', activeTenant?.id] })
  }

  const mutateTask = async (taskId: string, updates: Record<string, unknown>, historyMessage: string, eventType: string) => {
    const sb = supabase as any
    const currentTask = tasks.find((task: any) => task.id === taskId)

    await sb.from('workspace_tasks').update(updates).eq('id', taskId)
    await sb.from('workspace_task_history').insert({
      tenant_id: activeTenant?.id,
      workspace_id: activeTenant?.id,
      task_id: taskId,
      actor_id: user?.id,
      event_type: eventType,
      message: historyMessage,
      metadata: updates,
    })

    const reminderJobId = currentTask?.metadata?.reminder_job_id
    if (reminderJobId && ['completed', 'canceled'].includes(String(updates.status || ''))) {
      await sb
        .from('reminder_jobs')
        .update({
          status: updates.status === 'completed' ? 'done' : 'canceled',
        })
        .eq('id', reminderJobId)
    }

    await invalidateTaskQueries()
  }

  const handleSaveEdit = async () => {
    if (!editingTask || !activeTenant?.id || !user?.id) return
    setSavingEdit(true)

    try {
      const sb = supabase as any
      const previousAssignee = editingTask.assigned_to
      const nextDueAt = new Date(editForm.dueAt).toISOString()
      const updates: Record<string, unknown> = {
        title: editForm.title.trim(),
        description: editForm.description.trim() || null,
        assigned_to: editForm.assignedTo,
        priority: editForm.priority,
        due_at: nextDueAt,
        status: editForm.status,
        reminder_enabled: editForm.reminderEnabled,
        reminder_every_minutes: Number(editForm.reminderEveryMinutes || 10),
      }

      await sb.from('workspace_tasks').update(updates).eq('id', editingTask.id)

      const changes: string[] = []
      if (editingTask.title !== updates.title) changes.push('título')
      if ((editingTask.description || '') !== (updates.description || '')) changes.push('descrição')
      if (editingTask.assigned_to !== updates.assigned_to) changes.push('responsável')
      if (editingTask.priority !== updates.priority) changes.push('prioridade')
      if (editingTask.status !== updates.status) changes.push('status')
      if (new Date(editingTask.due_at).toISOString() !== nextDueAt) changes.push('prazo')
      if (Boolean(editingTask.reminder_enabled) !== Boolean(updates.reminder_enabled)) changes.push('lembrete')
      if (Number(editingTask.reminder_every_minutes || 10) !== Number(updates.reminder_every_minutes || 10)) changes.push('intervalo do lembrete')

      const assigneeChanged = previousAssignee !== editForm.assignedTo
      if (editingTask.source_conversation_id && assigneeChanged) {
        const pauseUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString()
        await sb
          .from('conversations')
          .update({
            assigned_to: editForm.assignedTo,
            assigned_at: new Date().toISOString(),
            assigned_by: user.id,
            status: 'open',
            unread_count: 1,
            human_control: true,
            ai_paused_until: pauseUntil,
          })
          .eq('id', editingTask.source_conversation_id)

        await sb.from('messages').insert({
          workspace_id: activeTenant.id,
          tenant_id: activeTenant.id,
          conversation_id: editingTask.source_conversation_id,
          sender_type: 'system',
          message_type: 'system',
          content: `📌 Tarefa reatribuída para ${usersById[editForm.assignedTo] || 'responsável'} com prazo ${new Date(nextDueAt).toLocaleString('pt-BR')}.`,
          sent_at: new Date().toISOString(),
        })
      }

      await sb.from('workspace_task_history').insert({
        tenant_id: activeTenant.id,
        workspace_id: activeTenant.id,
        task_id: editingTask.id,
        actor_id: user.id,
        event_type: assigneeChanged ? 'reassigned' : 'updated',
        message: assigneeChanged
          ? `Tarefa reatribuída de ${usersById[previousAssignee] || 'responsável anterior'} para ${usersById[editForm.assignedTo] || 'novo responsável'}.`
          : `Tarefa atualizada: ${changes.join(', ') || 'ajustes gerais'}.`,
        metadata: {
          previous_assigned_to: previousAssignee,
          ...updates,
        },
      })

      if (selectedTask?.id === editingTask.id) {
        setSelectedTask({ ...editingTask, ...updates })
      }

      setEditingTask(null)
      await invalidateTaskQueries()
    } finally {
      setSavingEdit(false)
    }
  }

  if (authLoading) return null
  if (!user) return <Navigate to="/auth" replace />

  return (
    <AppLayout>
      <div className="p-6 space-y-6 overflow-auto h-full">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Tarefas & KPIs</h1>
            <p className="text-muted-foreground">
              Atribuições, prazo, backlog, resposta e responsabilidade operacional.
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Nova tarefa
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Tarefas criadas</CardTitle></CardHeader><CardContent className="text-3xl font-bold">{metrics.total}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Respondidas</CardTitle></CardHeader><CardContent className="text-3xl font-bold">{metrics.responded}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Dentro do prazo</CardTitle></CardHeader><CardContent className="text-3xl font-bold">{metrics.onTime}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Pendentes</CardTitle></CardHeader><CardContent className="text-3xl font-bold">{metrics.pending}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Em atraso</CardTitle></CardHeader><CardContent className="text-3xl font-bold text-destructive">{metrics.overdue}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Tempo médio</CardTitle></CardHeader><CardContent className="text-3xl font-bold">{Math.round(metrics.avgResponseMinutes || 0)}m</CardContent></Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
          <Card className="border-destructive/30 bg-destructive/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                Radar de SLA
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {riskTasks.length === 0 && (
                <div className="rounded-lg border border-dashed bg-background p-4 text-sm text-muted-foreground">
                  Nenhuma tarefa vencendo ou em atraso neste momento.
                </div>
              )}
              {riskTasks.map((task: any) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => setSelectedTask(task)}
                  className="w-full rounded-lg border bg-background p-4 text-left transition hover:border-primary"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{task.title}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {usersById[task.assigned_to] || 'Sem responsável'}
                      </div>
                    </div>
                    <Badge variant={task.isOverdue ? 'destructive' : 'secondary'}>
                      {task.isOverdue ? 'Atrasada' : 'Vence em breve'}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{new Date(task.due_at).toLocaleString('pt-BR')}</span>
                    <span>
                      {task.isOverdue
                        ? `${Math.abs(task.minutesLeft)} min de atraso`
                        : `${task.minutesLeft} min restantes`}
                    </span>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Visão executiva por agente
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {agentRows.slice(0, 5).map((row, index) => (
                <div key={row.id} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">#{index + 1} {row.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.completed} concluídas • {row.pending} pendentes • {row.overdue} em atraso
                      </div>
                    </div>
                    <Badge variant={row.slaScore >= 80 ? 'default' : row.slaScore >= 50 ? 'secondary' : 'destructive'}>
                      {row.slaScore}% SLA
                    </Badge>
                  </div>
                  <Progress value={row.slaScore} />
                  <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                    <div className="rounded-md bg-muted/60 p-2">
                      <div className="font-medium text-foreground">{row.assigned}</div>
                      <div>Recebidas</div>
                    </div>
                    <div className="rounded-md bg-muted/60 p-2">
                      <div className="font-medium text-foreground">{row.onTime}</div>
                      <div>No prazo</div>
                    </div>
                    <div className="rounded-md bg-muted/60 p-2">
                      <div className="font-medium text-foreground">{Math.round(row.avgMinutes || 0)}m</div>
                      <div>Tempo médio</div>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Aba de tarefas</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList>
                <TabsTrigger value="all">Todas</TabsTrigger>
                <TabsTrigger value="mine">Minhas</TabsTrigger>
                <TabsTrigger value="pending">Pendentes</TabsTrigger>
                <TabsTrigger value="overdue">Em atraso</TabsTrigger>
                <TabsTrigger value="completed">Concluídas</TabsTrigger>
              </TabsList>

              <TabsContent value={tab} className="mt-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tarefa</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead>Prazo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Indicadores</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTasks.map((task: any) => {
                      const overdue = !['completed', 'canceled'].includes(task.status) && new Date(task.due_at).getTime() < now
                      const dueSoon = !overdue && !['completed', 'canceled'].includes(task.status) && new Date(task.due_at).getTime() <= now + 24 * 60 * 60 * 1000
                      return (
                        <TableRow key={task.id} className="cursor-pointer" onClick={() => setSelectedTask(task)}>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="font-medium">{task.title}</div>
                              <div className="text-xs text-muted-foreground line-clamp-1">{task.description || 'Sem descrição'}</div>
                            </div>
                          </TableCell>
                          <TableCell>{usersById[task.assigned_to] || '-'}</TableCell>
                          <TableCell>{new Date(task.due_at).toLocaleString('pt-BR')}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-2 items-center">
                              <Badge variant={overdue ? 'destructive' : dueSoon ? 'secondary' : 'outline'}>
                                {overdue ? 'overdue' : task.status}
                              </Badge>
                              <Badge variant="secondary">{task.priority}</Badge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs text-muted-foreground">
                              <div>1ª resposta: {task.first_response_at ? 'sim' : 'não'}</div>
                              <div>Respondido por: {usersById[task.last_response_by] || '-'}</div>
                              {task.source_conversation_id && (
                                <Button
                                  variant="link"
                                  className="p-0 h-auto text-xs"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    navigate(`/inbox/${task.source_conversation_id}`)
                                  }}
                                >
                                  Abrir mensagem original
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    {!isLoading && filteredTasks.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                          Nenhuma tarefa encontrada neste filtro.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <CreateTaskModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSuccess={() => {
          void invalidateTaskQueries()
        }}
      />

      <TaskDetailSheet
        open={!!selectedTask}
        onOpenChange={(nextOpen) => !nextOpen && setSelectedTask(null)}
        task={selectedTask}
        history={selectedHistory}
        usersById={usersById}
        onEdit={(task) => setEditingTask(task)}
        onComplete={async (task) => {
          const completedByOther = task.assigned_to && task.assigned_to !== user.id
          await mutateTask(
            task.id,
            {
              status: 'completed',
              completed_at: new Date().toISOString(),
              completed_by: user.id,
            },
            completedByOther
              ? `${usersById[user.id] || 'Outro usuário'} concluiu a tarefa no lugar do responsável original.`
              : 'Tarefa concluída.',
            completedByOther ? 'completed_by_other' : 'completed',
          )
          setSelectedTask(null)
        }}
        onCancel={async (task) => {
          await mutateTask(task.id, { status: 'canceled' }, 'Tarefa cancelada.', 'canceled')
          setSelectedTask(null)
        }}
      />

      <Dialog open={!!editingTask} onOpenChange={(nextOpen) => !nextOpen && setEditingTask(null)}>
        <DialogContent className="sm:max-w-[640px]">
          <DialogHeader>
            <DialogTitle>Editar tarefa</DialogTitle>
            <DialogDescription>
              Reatribua o responsável, ajuste prazo e mantenha a auditoria no mesmo fluxo.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Título</Label>
              <Input
                value={editForm.title}
                onChange={(e) => setEditForm((current) => ({ ...current, title: e.target.value }))}
              />
            </div>

            <div className="grid gap-2">
              <Label>Descrição</Label>
              <Textarea
                rows={4}
                value={editForm.description}
                onChange={(e) => setEditForm((current) => ({ ...current, description: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Responsável</Label>
                <Select value={editForm.assignedTo} onValueChange={(value) => setEditForm((current) => ({ ...current, assignedTo: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((member: any) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label>Status</Label>
                <Select value={editForm.status} onValueChange={(value) => setEditForm((current) => ({ ...current, status: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="in_progress">Em andamento</SelectItem>
                    <SelectItem value="completed">Concluída</SelectItem>
                    <SelectItem value="canceled">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label>Prioridade</Label>
                <Select value={editForm.priority} onValueChange={(value) => setEditForm((current) => ({ ...current, priority: value }))}>
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

              <div className="grid gap-2 md:col-span-2">
                <Label>Prazo</Label>
                <Input
                  type="datetime-local"
                  value={editForm.dueAt}
                  onChange={(e) => setEditForm((current) => ({ ...current, dueAt: e.target.value }))}
                />
              </div>
            </div>

            <div className="rounded-lg border p-4 space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="font-medium text-sm">Lembrete no app</div>
                  <div className="text-xs text-muted-foreground">Mantém o pop-up recorrente enquanto a tarefa estiver pendente.</div>
                </div>
                <Switch
                  checked={editForm.reminderEnabled}
                  onCheckedChange={(checked) => setEditForm((current) => ({ ...current, reminderEnabled: checked }))}
                />
              </div>
              <div className="grid gap-2 max-w-[180px]">
                <Label>Intervalo (min)</Label>
                <Input
                  type="number"
                  min={5}
                  disabled={!editForm.reminderEnabled}
                  value={editForm.reminderEveryMinutes}
                  onChange={(e) => setEditForm((current) => ({ ...current, reminderEveryMinutes: Number(e.target.value || 10) }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTask(null)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={savingEdit}>
              <Save className="w-4 h-4 mr-2" />
              {savingEdit ? 'Salvando...' : 'Salvar ajustes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
