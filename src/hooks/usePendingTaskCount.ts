import { useEffect, useState } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/hooks/useAuth'
import { useTenant } from '@/contexts/TenantContext'

interface PendingTaskCount {
  total: number
  overdue: number
}

export function usePendingTaskCount(): PendingTaskCount {
  const { user } = useAuth()
  const { activeTenant } = useTenant()
  const [counts, setCounts] = useState<PendingTaskCount>({ total: 0, overdue: 0 })

  useEffect(() => {
    if (!user?.id || !activeTenant?.id) return

    let cancelled = false

    const fetch = async () => {
      const { data, error } = await (supabase as any)
        .from('workspace_tasks')
        .select('id, due_at')
        .eq('workspace_id', activeTenant.id)
        .eq('assigned_to', user.id)
        .in('status', ['pending', 'in_progress'])

      if (cancelled || error || !Array.isArray(data)) return

      const now = Date.now()
      const overdue = data.filter((t: any) => new Date(t.due_at).getTime() < now).length

      setCounts({ total: data.length, overdue })
    }

    void fetch()
    const interval = window.setInterval(() => void fetch(), 60 * 1000)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [user?.id, activeTenant?.id])

  return counts
}
