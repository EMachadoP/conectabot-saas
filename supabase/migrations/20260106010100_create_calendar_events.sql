-- Create calendar_events table
-- Supports multi-tenant calendar management

CREATE TABLE IF NOT EXISTS public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,

  title text not null,
  description text,
  location text,

  start_at timestamptz not null,
  end_at timestamptz,
  timezone text not null default 'America/Recife',

  status text not null default 'scheduled', -- scheduled | canceled | done

  -- vínculo opcional com ticket SAC
  sac_ticket_id uuid references public.sac_tickets(id) on delete set null,

  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_calendar_events_tenant_start
ON public.calendar_events (tenant_id, start_at);

CREATE INDEX IF NOT EXISTS idx_calendar_events_tenant_status
ON public.calendar_events (tenant_id, status);

-- Enable RLS
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "tenant_select_calendar_events"
ON public.calendar_events FOR SELECT
USING (tenant_id = public.current_tenant_id());

CREATE POLICY "tenant_insert_calendar_events"
ON public.calendar_events FOR INSERT
WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "tenant_update_calendar_events"
ON public.calendar_events FOR UPDATE
USING (tenant_id = public.current_tenant_id())
WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "tenant_delete_calendar_events"
ON public.calendar_events FOR DELETE
USING (tenant_id = public.current_tenant_id());

-- Updated at trigger
CREATE OR REPLACE FUNCTION public.update_calendar_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calendar_events_updated_at
BEFORE UPDATE ON public.calendar_events
FOR EACH ROW
EXECUTE FUNCTION public.update_calendar_events_updated_at();

-- Comments
COMMENT ON TABLE public.calendar_events IS 'Multi-tenant calendar events for the platform';
COMMENT ON COLUMN public.calendar_events.status IS 'Event status: scheduled, canceled, done';
COMMENT ON COLUMN public.calendar_events.sac_ticket_id IS 'Optional link to a SAC ticket';
