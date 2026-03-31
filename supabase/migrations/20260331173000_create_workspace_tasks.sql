CREATE TABLE IF NOT EXISTS public.workspace_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'canceled')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'conversation', 'message')),
  source_conversation_id uuid REFERENCES public.conversations(id) ON DELETE SET NULL,
  source_message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
  source_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  original_assignee_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  due_at timestamptz NOT NULL,
  completed_at timestamptz,
  completed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  first_response_at timestamptz,
  first_response_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  last_response_at timestamptz,
  last_response_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reminder_enabled boolean NOT NULL DEFAULT true,
  reminder_every_minutes int NOT NULL DEFAULT 10,
  calendar_event_id uuid REFERENCES public.calendar_events(id) ON DELETE SET NULL,
  last_reminder_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workspace_task_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  task_id uuid NOT NULL REFERENCES public.workspace_tasks(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  message text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspace_tasks_workspace_status_due
ON public.workspace_tasks (workspace_id, status, due_at);

CREATE INDEX IF NOT EXISTS idx_workspace_tasks_assigned_status
ON public.workspace_tasks (assigned_to, status, due_at);

CREATE INDEX IF NOT EXISTS idx_workspace_tasks_conversation
ON public.workspace_tasks (source_conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_workspace_task_history_task
ON public.workspace_task_history (task_id, created_at DESC);

ALTER TABLE public.workspace_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_task_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS workspace_tasks_select ON public.workspace_tasks;
DROP POLICY IF EXISTS workspace_tasks_insert ON public.workspace_tasks;
DROP POLICY IF EXISTS workspace_tasks_update ON public.workspace_tasks;
DROP POLICY IF EXISTS workspace_tasks_delete ON public.workspace_tasks;

CREATE POLICY workspace_tasks_select
ON public.workspace_tasks
FOR SELECT
USING (public.is_workspace_member(workspace_id));

CREATE POLICY workspace_tasks_insert
ON public.workspace_tasks
FOR INSERT
WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY workspace_tasks_update
ON public.workspace_tasks
FOR UPDATE
USING (public.is_workspace_member(workspace_id))
WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY workspace_tasks_delete
ON public.workspace_tasks
FOR DELETE
USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS workspace_task_history_select ON public.workspace_task_history;
DROP POLICY IF EXISTS workspace_task_history_insert ON public.workspace_task_history;
DROP POLICY IF EXISTS workspace_task_history_delete ON public.workspace_task_history;

CREATE POLICY workspace_task_history_select
ON public.workspace_task_history
FOR SELECT
USING (public.is_workspace_member(workspace_id));

CREATE POLICY workspace_task_history_insert
ON public.workspace_task_history
FOR INSERT
WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY workspace_task_history_delete
ON public.workspace_task_history
FOR DELETE
USING (public.is_workspace_member(workspace_id));

DROP TRIGGER IF EXISTS workspace_tasks_sync_workspace_tenant ON public.workspace_tasks;
CREATE TRIGGER workspace_tasks_sync_workspace_tenant
BEFORE INSERT OR UPDATE ON public.workspace_tasks
FOR EACH ROW
EXECUTE FUNCTION public.sync_workspace_and_tenant_id();

DROP TRIGGER IF EXISTS workspace_task_history_sync_workspace_tenant ON public.workspace_task_history;
CREATE TRIGGER workspace_task_history_sync_workspace_tenant
BEFORE INSERT OR UPDATE ON public.workspace_task_history
FOR EACH ROW
EXECUTE FUNCTION public.sync_workspace_and_tenant_id();

CREATE OR REPLACE FUNCTION public.update_workspace_tasks_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS workspace_tasks_set_updated_at ON public.workspace_tasks;
CREATE TRIGGER workspace_tasks_set_updated_at
BEFORE UPDATE ON public.workspace_tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_workspace_tasks_updated_at();

COMMENT ON TABLE public.workspace_tasks IS 'Operational tasks linked to conversations, deadlines and accountability.';
COMMENT ON TABLE public.workspace_task_history IS 'Audit trail for task creation, response, reassignment and completion.';
