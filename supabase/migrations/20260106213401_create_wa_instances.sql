-- Create wa_instances table: 1 Evolution instance per team
-- This centralizes Evolution API configuration at the team level

CREATE TABLE IF NOT EXISTS public.wa_instances (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  
  -- Evolution API configuration
  evolution_instance_key text not null, -- e.g., "team_abc123" or custom slug
  evolution_base_url text not null,
  evolution_api_key text not null,
  
  -- Connection status
  status text not null default 'disconnected' check (status in ('connected', 'disconnected', 'error')),
  qr_code text, -- temporary QR code for initial connection
  last_sync_at timestamptz,
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  -- Ensure one instance per team
  UNIQUE(team_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_wa_instances_team 
ON public.wa_instances(team_id);

CREATE INDEX IF NOT EXISTS idx_wa_instances_status 
ON public.wa_instances(team_id, status);

-- Enable RLS
ALTER TABLE public.wa_instances ENABLE ROW LEVEL SECURITY;

-- RLS Policies (team-based)
CREATE POLICY "team_select_wa_instances"
ON public.wa_instances FOR SELECT
USING (team_id IN (SELECT team_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "team_insert_wa_instances"
ON public.wa_instances FOR INSERT
WITH CHECK (team_id IN (SELECT team_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "team_update_wa_instances"
ON public.wa_instances FOR UPDATE
USING (team_id IN (SELECT team_id FROM public.profiles WHERE id = auth.uid()))
WITH CHECK (team_id IN (SELECT team_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "team_delete_wa_instances"
ON public.wa_instances FOR DELETE
USING (team_id IN (SELECT team_id FROM public.profiles WHERE id = auth.uid()));

-- Updated at trigger
CREATE OR REPLACE FUNCTION public.update_wa_instances_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_wa_instances_updated_at
BEFORE UPDATE ON public.wa_instances
FOR EACH ROW
EXECUTE FUNCTION public.update_wa_instances_updated_at();

-- Comments
COMMENT ON TABLE public.wa_instances IS 'Evolution API instances, one per team';
COMMENT ON COLUMN public.wa_instances.team_id IS 'Team that owns this Evolution instance';
COMMENT ON COLUMN public.wa_instances.evolution_instance_key IS 'Unique Evolution instance identifier (e.g., team_<teamId>)';
COMMENT ON COLUMN public.wa_instances.evolution_base_url IS 'Evolution API base URL';
COMMENT ON COLUMN public.wa_instances.evolution_api_key IS 'Evolution API key for authentication';
COMMENT ON COLUMN public.wa_instances.status IS 'Connection status: connected, disconnected, error';
COMMENT ON COLUMN public.wa_instances.qr_code IS 'Temporary QR code for initial WhatsApp connection';
COMMENT ON COLUMN public.wa_instances.last_sync_at IS 'Last time contacts/groups were synced from Evolution';
