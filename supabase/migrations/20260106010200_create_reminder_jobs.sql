-- Create reminder_jobs table
-- Engine for reminder state, repetition, and delivery tracking

CREATE TABLE IF NOT EXISTS public.reminder_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,

  event_id uuid not null references public.calendar_events(id) on delete cascade,

  -- quando disparar o primeiro lembrete
  first_fire_at timestamptz not null,

  -- repetir até finalizar
  repeat_every_minutes int not null default 10,
  max_attempts int not null default 12, -- ex: 2h repetindo a cada 10min

  attempts int not null default 0,
  last_attempt_at timestamptz,
  next_attempt_at timestamptz not null,

  status text not null default 'scheduled',
  -- scheduled | running | waiting_ack | done | canceled | failed

  ack_required boolean not null default true,
  ack_received_at timestamptz,

  last_error text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Optimization Index for the background worker
-- Efficiently find jobs that need processing
CREATE INDEX IF NOT EXISTS idx_reminder_jobs_worker
ON public.reminder_jobs(tenant_id, next_attempt_at)
WHERE status IN ('scheduled', 'running', 'waiting_ack');

-- Standard tenant index
CREATE INDEX IF NOT EXISTS idx_reminder_jobs_tenant
ON public.reminder_jobs(tenant_id);

-- Enable RLS
ALTER TABLE public.reminder_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "tenant_select_reminder_jobs"
ON public.reminder_jobs FOR SELECT
USING (tenant_id = public.current_tenant_id());

CREATE POLICY "tenant_insert_reminder_jobs"
ON public.reminder_jobs FOR INSERT
WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "tenant_update_reminder_jobs"
ON public.reminder_jobs FOR UPDATE
USING (tenant_id = public.current_tenant_id())
WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "tenant_delete_reminder_jobs"
ON public.reminder_jobs FOR DELETE
USING (tenant_id = public.current_tenant_id());

-- Updated at trigger
CREATE OR REPLACE FUNCTION public.update_reminder_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_reminder_jobs_updated_at
BEFORE UPDATE ON public.reminder_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_reminder_jobs_updated_at();

-- Comments
COMMENT ON TABLE public.reminder_jobs IS 'State engine for reminder delivery and repetition logic';
COMMENT ON COLUMN public.reminder_jobs.status IS 'Job status: scheduled, running, waiting_ack, done, canceled, failed';
COMMENT ON COLUMN public.reminder_jobs.ack_required IS 'Whether the reminder requires a positive acknowledgement to stop repeating';
