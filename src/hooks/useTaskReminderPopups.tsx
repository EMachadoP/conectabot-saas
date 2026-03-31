import { useEffect } from 'react'
import { toast } from 'sonner'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useTenant } from '@/contexts/TenantContext'

const STORAGE_PREFIX = 'task-reminder:'

function getLastReminderAt(taskId: string) {
  const raw = localStorage.getItem(`${STORAGE_PREFIX}${taskId}`)
  return raw ? Number(raw) : 0
}

function setLastReminderAt(taskId: string, value: number) {
  localStorage.setItem(`${STORAGE_PREFIX}${taskId}`, String(value))
}

export function useTaskReminderPopups() {
  const { user } = useAuth()
  const { activeTenant } = useTenant()

  useEffect(() => {
    if (!user?.id || !activeTenant?.id) return

    let cancelled = false

    const tick = async () => {
      const sb = supabase as any
      const { data, error } = await sb
        .from('workspace_tasks')
        .select('id, title, due_at, status, reminder_enabled, reminder_every_minutes, source_conversation_id')
        .eq('workspace_id', activeTenant.id)
        .eq('assigned_to', user.id)
        .in('status', ['pending', 'in_progress'])
        .order('due_at', { ascending: true })

      if (cancelled || error || !Array.isArray(data)) return

      const now = Date.now()

      data.forEach((task: any) => {
        if (!task.reminder_enabled) return

        const cadence = Math.max(Number(task.reminder_every_minutes || 10), 1) * 60 * 1000
        const lastReminderAt = getLastReminderAt(task.id)
        if (lastReminderAt && now - lastReminderAt < cadence) return

        setLastReminderAt(task.id, now)

        const dueAt = new Date(task.due_at)
        const overdue = dueAt.getTime() < now
        const dueLabel = overdue
          ? 'Prazo já vencido'
          : `Prazo: ${dueAt.toLocaleString('pt-BR')}`

        toast.warning(overdue ? 'Tarefa em atraso' : 'Lembrete de tarefa', {
          description: `${task.title}. ${dueLabel}`,
          action: task.source_conversation_id
            ? {
              label: 'Abrir conversa',
              onClick: () => {
                window.location.href = `/inbox/${task.source_conversation_id}`
              },
            }
            : {
              label: 'Abrir tarefas',
              onClick: () => {
                window.location.href = '/tasks'
              },
            },
          duration: 8000,
        })
      })
    }

    void tick()
    const interval = window.setInterval(() => {
      void tick()
    }, 60 * 1000)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [activeTenant?.id, user?.id])
}
