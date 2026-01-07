-- Create SAC (Customer Service) tickets table
-- Supports multi-tenant ticket management with unique codes per tenant

CREATE TABLE IF NOT EXISTS public.sac_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Ticket identification
  code TEXT NOT NULL,                           -- ex: SAC-2026-000123
  title TEXT NOT NULL,                          -- short summary
  description TEXT,                             -- detailed description
  
  -- Classification
  category TEXT NOT NULL DEFAULT 'SAC',         -- SAC | Comercial | Suporte | Financeiro etc.
  priority TEXT NOT NULL DEFAULT 'normal',      -- low | normal | high | urgent
  status TEXT NOT NULL DEFAULT 'open',          -- open | pending | resolved | canceled

  -- Contact information
  contact_name TEXT,                            -- customer/requester name
  contact_channel TEXT,                         -- whatsapp | email | phone | web
  contact_ref TEXT,                             -- phone/email/identifier
  related_entity TEXT,                          -- company/customer/condominium (simple text for now)

  -- Assignment
  assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL,  -- responsible agent
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,   -- creator

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

-- Unique constraint: code must be unique per tenant
CREATE UNIQUE INDEX IF NOT EXISTS sac_tickets_tenant_code_uq
ON public.sac_tickets(tenant_id, code);

-- Index for filtering by status within tenant
CREATE INDEX IF NOT EXISTS sac_tickets_tenant_status_idx
ON public.sac_tickets(tenant_id, status);

-- Index for sorting by creation date within tenant
CREATE INDEX IF NOT EXISTS sac_tickets_tenant_created_at_idx
ON public.sac_tickets(tenant_id, created_at DESC);

-- Index for assigned tickets
CREATE INDEX IF NOT EXISTS sac_tickets_assigned_to_idx
ON public.sac_tickets(assigned_to) WHERE assigned_to IS NOT NULL;

-- Enable RLS
ALTER TABLE public.sac_tickets ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only see tickets from their tenant(s)
CREATE POLICY "tenant_isolation_select" ON public.sac_tickets
FOR SELECT USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "tenant_isolation_insert" ON public.sac_tickets
FOR INSERT WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "tenant_isolation_update" ON public.sac_tickets
FOR UPDATE USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "tenant_isolation_delete" ON public.sac_tickets
FOR DELETE USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_sac_tickets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER trg_sac_tickets_updated_at
BEFORE UPDATE ON public.sac_tickets
FOR EACH ROW
EXECUTE FUNCTION public.update_sac_tickets_updated_at();

-- Comments
COMMENT ON TABLE public.sac_tickets IS 'Customer service tickets with multi-tenant support';
COMMENT ON COLUMN public.sac_tickets.code IS 'Unique ticket code per tenant (e.g., SAC-2026-000123)';
COMMENT ON COLUMN public.sac_tickets.category IS 'Ticket category: SAC, Comercial, Suporte, Financeiro, etc.';
COMMENT ON COLUMN public.sac_tickets.priority IS 'Priority level: low, normal, high, urgent';
COMMENT ON COLUMN public.sac_tickets.status IS 'Ticket status: open, pending, resolved, canceled';
COMMENT ON COLUMN public.sac_tickets.contact_channel IS 'Communication channel: whatsapp, email, phone, web';
COMMENT ON COLUMN public.sac_tickets.related_entity IS 'Related company/customer/condominium (simple text reference)';
