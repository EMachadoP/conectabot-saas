-- Create wa_targets table for WhatsApp contacts/groups cache
-- This table stores synchronized contacts and groups from Evolution API

CREATE TABLE IF NOT EXISTS public.wa_targets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  
  type text not null check (type in ('person', 'group')),
  jid text not null, -- WhatsApp JID (ex: 5511999999999@s.whatsapp.net or groupid@g.us)
  display_name text not null,
  phone text, -- only for person type
  
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  
  -- Ensure unique JID per tenant
  UNIQUE(tenant_id, jid)
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_wa_targets_tenant 
ON public.wa_targets(tenant_id);

CREATE INDEX IF NOT EXISTS idx_wa_targets_search 
ON public.wa_targets(tenant_id, display_name);

CREATE INDEX IF NOT EXISTS idx_wa_targets_type 
ON public.wa_targets(tenant_id, type);

-- Enable RLS
ALTER TABLE public.wa_targets ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "tenant_select_wa_targets"
ON public.wa_targets FOR SELECT
USING (tenant_id = public.current_tenant_id());

CREATE POLICY "tenant_insert_wa_targets"
ON public.wa_targets FOR INSERT
WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "tenant_update_wa_targets"
ON public.wa_targets FOR UPDATE
USING (tenant_id = public.current_tenant_id())
WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "tenant_delete_wa_targets"
ON public.wa_targets FOR DELETE
USING (tenant_id = public.current_tenant_id());

-- Updated at trigger
CREATE OR REPLACE FUNCTION public.update_wa_targets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_wa_targets_updated_at
BEFORE UPDATE ON public.wa_targets
FOR EACH ROW
EXECUTE FUNCTION public.update_wa_targets_updated_at();

-- Comments
COMMENT ON TABLE public.wa_targets IS 'Cache of WhatsApp contacts and groups synchronized from Evolution API';
COMMENT ON COLUMN public.wa_targets.type IS 'Type of target: person or group';
COMMENT ON COLUMN public.wa_targets.jid IS 'WhatsApp JID identifier (e.g., 5511999999999@s.whatsapp.net or groupid@g.us)';
COMMENT ON COLUMN public.wa_targets.display_name IS 'Display name for UI (contact name or group subject)';
COMMENT ON COLUMN public.wa_targets.phone IS 'Phone number in E.164 format (only for person type)';
