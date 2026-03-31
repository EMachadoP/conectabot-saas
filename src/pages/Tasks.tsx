import { useMemo, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Clock3, Plus, Timer } from 'lucide-react'
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
import { CreateTaskModal } from '@/components/tasks/CreateTaskModal'
import { TaskDetailSheet } from '@/components/tasks/TaskDetailSheet'

function avg(values: number[]) {
  if (!values.length) return 0
  return values.reduce((total, value) => total + value, 0) / values.length
}

export default function TasksPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, loading: authLoading } = useAuth()
  const { activeTenant } = useTenant()
  const [tab, setTab] = useState('all')
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<any | null>(null)

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
    return members.map((member: any) => {
      const assigned = tasks.filter((task: any) => task.assigned_to === member.id)
      const completed = assigned.filter((task: any) => task.status === 'completed')
      const onTime = assigned.filter((task: any) => {
        const responseAt = task.first_response_at || task.completed_at
        return responseAt && new Date(responseAt).getTime() <= new Date(task.due_at).getTime()
      })
      const overdue = assigned.filter((task: any) => !['completed', 'canceled'].includes(task.status) && new Date(task.due_at).getTime() < now)

      return {
        ...member,
        assigned: assigned.length,
        completed: completed.length,
        onTime: onTime.length,
        overdue: overdue.length,
        score: assigned.length ? Math.round((onTime.length / assigned.length) * 100) : 0,
      }
    })
  }, [members, now, tasks])

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

  const mutateTask = async (taskId: string, updates: Record<string, unknown>, historyMessage: string, eventType: string) => {
    const sb = supabase as any
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

    await queryClient.invalidateQueries({ queryKey: ['workspace_tasks', activeTenant?.id] })
    await queryClient.invalidateQueries({ queryKey: ['workspace_task_history', activeTenant?.id] })
  }

  if (authLoading) return null
  if (!user) return <Navigate to="/auth" replace />

  return (
    <AppLayout>
      <div className="p-6 space-y-6 overflow-auto h-full">
        <div className="flex items-center justify-between">
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

        <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-6">
          <Card>
            <CardHeader>
              <CardTitle>KPI por agente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {agentRows.map((row) => (
                <div key={row.id} className="space-y-2 rounded-lg border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">{row.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.completed} concluídas • {row.overdue} atrasadas
                      </div>
                    </div>
                    <Badge variant={row.score >= 80 ? 'default' : row.score >= 50 ? 'secondary' : 'destructive'}>
                      {row.score}% SLA
                    </Badge>
                  </div>
                  <Progress value={row.score} />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Leituras rápidas de SLA</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-center gap-3 rounded-lg border p-4">
                <AlertTriangle className="w-4 h-4 text-destructive" />
                <div><div className="font-medium">{metrics.overdue} tarefas em atraso</div><div className="text-muted-foreground">Exigem ação imediata.</div></div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border p-4">
                <Clock3 className="w-4 h-4 text-yellow-500" />
                <div><div className="font-medium">{metrics.dueSoon} próximas do vencimento</div><div className="text-muted-foreground">Vencem nas próximas 24h.</div></div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border p-4">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <div><div className="font-medium">{metrics.onTime} respostas no prazo</div><div className="text-muted-foreground">Primeira resposta ou conclusão dentro do SLA.</div></div>
              </div>
              <div className="flex items-center gap-3 rounded-lg border p-4">
                <Timer className="w-4 h-4 text-primary" />
                <div><div className="font-medium">{Math.round(metrics.avgResponseMinutes || 0)} minutos</div><div className="text-muted-foreground">Tempo médio da primeira resposta.</div></div>
              </div>
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
                            <div className="flex gap-2 items-center">
                              <Badge variant={overdue ? 'destructive' : 'outline'}>{overdue ? 'overdue' : task.status}</Badge>
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
          void queryClient.invalidateQueries({ queryKey: ['workspace_tasks', activeTenant?.id] })
          void queryClient.invalidateQueries({ queryKey: ['workspace_task_history', activeTenant?.id] })
        }}
      />

      <TaskDetailSheet
        open={!!selectedTask}
        onOpenChange={(nextOpen) => !nextOpen && setSelectedTask(null)}
        task={selectedTask}
        history={selectedHistory}
        usersById={usersById}
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
    </AppLayout>
  )
}
