-- Enable Row Level Security for SAC tables
-- This migration ensures proper tenant isolation for sac_tickets and sac_counters

-- Enable RLS (already enabled in previous migrations, but ensuring it's on)
ALTER TABLE public.sac_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sac_counters ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (from previous migrations)
DROP POLICY IF EXISTS "tenant_isolation_select" ON public.sac_tickets;
DROP POLICY IF EXISTS "tenant_isolation_insert" ON public.sac_tickets;
DROP POLICY IF EXISTS "tenant_isolation_update" ON public.sac_tickets;
DROP POLICY IF EXISTS "tenant_isolation_delete" ON public.sac_tickets;

DROP POLICY IF EXISTS "tenant_isolation_select" ON public.sac_counters;
DROP POLICY IF EXISTS "system_only_modify" ON public.sac_counters;

-- ============================================================================
-- SAC TICKETS POLICIES
-- ============================================================================

-- Users can SELECT tickets from their tenant
CREATE POLICY "tenant_select_sac_tickets"
ON public.sac_tickets FOR SELECT
USING (tenant_id = public.current_tenant_id());

-- Users can INSERT tickets into their tenant
CREATE POLICY "tenant_insert_sac_tickets"
ON public.sac_tickets FOR INSERT
WITH CHECK (tenant_id = public.current_tenant_id());

-- Users can UPDATE tickets in their tenant
CREATE POLICY "tenant_update_sac_tickets"
ON public.sac_tickets FOR UPDATE
USING (tenant_id = public.current_tenant_id())
WITH CHECK (tenant_id = public.current_tenant_id());

-- Users can DELETE tickets in their tenant
CREATE POLICY "tenant_delete_sac_tickets"
ON public.sac_tickets FOR DELETE
USING (tenant_id = public.current_tenant_id());

-- ============================================================================
-- SAC COUNTERS POLICIES
-- ============================================================================

-- Users can SELECT counters from their tenant
CREATE POLICY "tenant_select_sac_counters"
ON public.sac_counters FOR SELECT
USING (tenant_id = public.current_tenant_id());

-- Users can INSERT counters for their tenant
CREATE POLICY "tenant_insert_sac_counters"
ON public.sac_counters FOR INSERT
WITH CHECK (tenant_id = public.current_tenant_id());

-- Users can UPDATE counters in their tenant
CREATE POLICY "tenant_update_sac_counters"
ON public.sac_counters FOR UPDATE
USING (tenant_id = public.current_tenant_id())
WITH CHECK (tenant_id = public.current_tenant_id());

-- Comments
COMMENT ON POLICY "tenant_select_sac_tickets" ON public.sac_tickets IS 'Users can only view SAC tickets from their active tenant';
COMMENT ON POLICY "tenant_insert_sac_tickets" ON public.sac_tickets IS 'Users can only create SAC tickets in their active tenant';
COMMENT ON POLICY "tenant_update_sac_tickets" ON public.sac_tickets IS 'Users can only update SAC tickets in their active tenant';
COMMENT ON POLICY "tenant_delete_sac_tickets" ON public.sac_tickets IS 'Users can only delete SAC tickets in their active tenant';

COMMENT ON POLICY "tenant_select_sac_counters" ON public.sac_counters IS 'Users can only view counters from their active tenant';
COMMENT ON POLICY "tenant_insert_sac_counters" ON public.sac_counters IS 'Users can only create counters for their active tenant';
COMMENT ON POLICY "tenant_update_sac_counters" ON public.sac_counters IS 'Users can only update counters in their active tenant';
