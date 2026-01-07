-- Create SAC ticket code sequence system
-- Generates unique sequential codes per tenant and year in format: SAC-YYYY-NNNNNN

-- Table to store counters per tenant and year
CREATE TABLE IF NOT EXISTS public.sac_counters (
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  year INT NOT NULL,
  seq INT NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, year)
);

-- Helper function to get current user's active tenant
-- Returns the first active tenant for the current user
CREATE OR REPLACE FUNCTION public.current_tenant_id()
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT tenant_id 
  FROM public.tenant_members 
  WHERE user_id = auth.uid() 
  AND is_active = true
  LIMIT 1;
$$;

-- Function to generate next SAC code for current tenant and year
CREATE OR REPLACE FUNCTION public.next_sac_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  y INT := EXTRACT(YEAR FROM now())::INT;
  tid UUID := public.current_tenant_id();
  new_seq INT;
BEGIN
  -- Ensure tenant_id is available
  IF tid IS NULL THEN
    RAISE EXCEPTION 'No active tenant found for current user';
  END IF;

  -- Insert counter for this tenant/year if it doesn't exist
  INSERT INTO public.sac_counters (tenant_id, year, seq)
  VALUES (tid, y, 0)
  ON CONFLICT (tenant_id, year) DO NOTHING;

  -- Increment and get new sequence number
  UPDATE public.sac_counters
  SET seq = seq + 1
  WHERE tenant_id = tid AND year = y
  RETURNING seq INTO new_seq;

  -- Return formatted code: SAC-2026-000001
  RETURN 'SAC-' || y::TEXT || '-' || lpad(new_seq::TEXT, 6, '0');
END;
$$;

-- Function to generate SAC code for a specific tenant (for admin/system use)
CREATE OR REPLACE FUNCTION public.next_sac_code_for_tenant(p_tenant_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  y INT := EXTRACT(YEAR FROM now())::INT;
  new_seq INT;
BEGIN
  -- Insert counter for this tenant/year if it doesn't exist
  INSERT INTO public.sac_counters (tenant_id, year, seq)
  VALUES (p_tenant_id, y, 0)
  ON CONFLICT (tenant_id, year) DO NOTHING;

  -- Increment and get new sequence number
  UPDATE public.sac_counters
  SET seq = seq + 1
  WHERE tenant_id = p_tenant_id AND year = y
  RETURNING seq INTO new_seq;

  -- Return formatted code: SAC-2026-000001
  RETURN 'SAC-' || y::TEXT || '-' || lpad(new_seq::TEXT, 6, '0');
END;
$$;

-- Enable RLS on sac_counters
ALTER TABLE public.sac_counters ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can only see counters from their tenant(s)
CREATE POLICY "tenant_isolation_select" ON public.sac_counters
FOR SELECT USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

-- Only allow system/functions to modify counters (not direct user access)
CREATE POLICY "system_only_modify" ON public.sac_counters
FOR ALL USING (false);

-- Comments
COMMENT ON TABLE public.sac_counters IS 'Stores sequential counters for SAC ticket codes per tenant and year';
COMMENT ON FUNCTION public.current_tenant_id() IS 'Returns the active tenant_id for the current authenticated user';
COMMENT ON FUNCTION public.next_sac_code() IS 'Generates next sequential SAC code for current user tenant (e.g., SAC-2026-000001)';
COMMENT ON FUNCTION public.next_sac_code_for_tenant(UUID) IS 'Generates next sequential SAC code for specified tenant (admin/system use)';
