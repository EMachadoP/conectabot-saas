-- Create reminder_attempt_logs table
-- Audit log for every reminder delivery attempt

CREATE TABLE IF NOT EXISTS public.reminder_attempt_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,

  job_id uuid not null references public.reminder_jobs(id) on delete cascade,
  event_id uuid not null references public.calendar_events(id) on delete cascade,

  attempt_no int not null,
  fired_at timestamptz not null default now(),

  result text not null, -- success | error
  provider text not null default 'mock', -- mock | evolution | zapi
  response_json jsonb,
  error text
);

-- Performance Index for auditing
CREATE INDEX IF NOT EXISTS idx_reminder_attempt_logs_job
ON public.reminder_attempt_logs(job_id);

-- Standard tenant index
CREATE INDEX IF NOT EXISTS idx_reminder_attempt_logs_tenant
ON public.reminder_attempt_logs(tenant_id);

-- Enable RLS
ALTER TABLE public.reminder_attempt_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "tenant_select_reminder_attempt_logs"
ON public.reminder_attempt_logs FOR SELECT
USING (tenant_id = public.current_tenant_id());

CREATE POLICY "tenant_insert_reminder_attempt_logs"
ON public.reminder_attempt_logs FOR INSERT
WITH CHECK (tenant_id = public.current_tenant_id());

-- Attempt logs should usually not be updated or deleted for audit purposes
-- But we allow system level management if needed via tenant isolation
CREATE POLICY "tenant_delete_reminder_attempt_logs"
ON public.reminder_attempt_logs FOR DELETE
USING (tenant_id = public.current_tenant_id());

-- Comments
COMMENT ON TABLE public.reminder_attempt_logs IS 'Audit trails for every automated reminder attempt';
COMMENT ON COLUMN public.reminder_attempt_logs.result IS 'Outcome: success or error';
COMMENT ON COLUMN public.reminder_attempt_logs.provider IS 'Messaging provider used for this attempt';
