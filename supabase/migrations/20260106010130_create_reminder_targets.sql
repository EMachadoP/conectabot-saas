-- Create reminder_targets table
-- Manages recipients (persons or groups) for calendar event reminders

CREATE TABLE IF NOT EXISTS public.reminder_targets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,

  event_id uuid not null references public.calendar_events(id) on delete cascade,

  target_type text not null,  -- 'person' | 'group'
  target_name text,
  target_ref text not null,   -- telefone / group_id / identificador

  created_at timestamptz not null default now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_reminder_targets_event
ON public.reminder_targets(event_id);

CREATE INDEX IF NOT EXISTS idx_reminder_targets_tenant
ON public.reminder_targets(tenant_id);

-- Enable RLS
ALTER TABLE public.reminder_targets ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "tenant_select_reminder_targets"
ON public.reminder_targets FOR SELECT
USING (tenant_id = public.current_tenant_id());

CREATE POLICY "tenant_insert_reminder_targets"
ON public.reminder_targets FOR INSERT
WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "tenant_update_reminder_targets"
ON public.reminder_targets FOR UPDATE
USING (tenant_id = public.current_tenant_id())
WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "tenant_delete_reminder_targets"
ON public.reminder_targets FOR DELETE
USING (tenant_id = public.current_tenant_id());

-- Comments
COMMENT ON TABLE public.reminder_targets IS 'Recipients for reminders associated with calendar events';
COMMENT ON COLUMN public.reminder_targets.target_type IS 'Type of recipient: person or group';
COMMENT ON COLUMN public.reminder_targets.target_ref IS 'Reference identifier (phone number or group id)';
