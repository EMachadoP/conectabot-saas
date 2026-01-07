-- Enable RLS and create policies for all tenant-isolated tables
-- This ensures data isolation between tenants

-- Helper function to get user's active tenant(s)
CREATE OR REPLACE FUNCTION public.get_user_tenant_ids()
RETURNS SETOF UUID
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT tenant_id 
  FROM public.tenant_members 
  WHERE user_id = auth.uid() 
  AND is_active = true;
$$;

-- ============================================================================
-- CONTACTS
-- ============================================================================
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON public.contacts
FOR SELECT USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "tenant_isolation_insert" ON public.contacts
FOR INSERT WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "tenant_isolation_update" ON public.contacts
FOR UPDATE USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "tenant_isolation_delete" ON public.contacts
FOR DELETE USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

-- ============================================================================
-- CONVERSATIONS
-- ============================================================================
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON public.conversations
FOR SELECT USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "tenant_isolation_insert" ON public.conversations
FOR INSERT WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "tenant_isolation_update" ON public.conversations
FOR UPDATE USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "tenant_isolation_delete" ON public.conversations
FOR DELETE USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

-- ============================================================================
-- MESSAGES
-- ============================================================================
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON public.messages
FOR SELECT USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "tenant_isolation_insert" ON public.messages
FOR INSERT WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "tenant_isolation_update" ON public.messages
FOR UPDATE USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "tenant_isolation_delete" ON public.messages
FOR DELETE USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

-- ============================================================================
-- PROTOCOLS
-- ============================================================================
ALTER TABLE public.protocols ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON public.protocols
FOR SELECT USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "tenant_isolation_insert" ON public.protocols
FOR INSERT WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "tenant_isolation_update" ON public.protocols
FOR UPDATE USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "tenant_isolation_delete" ON public.protocols
FOR DELETE USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

-- ============================================================================
-- PROFILES
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON public.profiles
FOR SELECT USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "tenant_isolation_insert" ON public.profiles
FOR INSERT WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "tenant_isolation_update" ON public.profiles
FOR UPDATE USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

-- ============================================================================
-- LABELS
-- ============================================================================
ALTER TABLE public.labels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON public.labels
FOR SELECT USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "tenant_isolation_insert" ON public.labels
FOR INSERT WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "tenant_isolation_update" ON public.labels
FOR UPDATE USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "tenant_isolation_delete" ON public.labels
FOR DELETE USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

-- ============================================================================
-- TEAMS
-- ============================================================================
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON public.teams
FOR SELECT USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "tenant_isolation_insert" ON public.teams
FOR INSERT WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "tenant_isolation_update" ON public.teams
FOR UPDATE USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "tenant_isolation_delete" ON public.teams
FOR DELETE USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

-- ============================================================================
-- AGENTS
-- ============================================================================
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON public.agents
FOR SELECT USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "tenant_isolation_insert" ON public.agents
FOR INSERT WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "tenant_isolation_update" ON public.agents
FOR UPDATE USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "tenant_isolation_delete" ON public.agents
FOR DELETE USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

-- ============================================================================
-- CONDOMINIUMS
-- ============================================================================
ALTER TABLE public.condominiums ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON public.condominiums
FOR SELECT USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "tenant_isolation_insert" ON public.condominiums
FOR INSERT WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "tenant_isolation_update" ON public.condominiums
FOR UPDATE USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "tenant_isolation_delete" ON public.condominiums
FOR DELETE USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

-- ============================================================================
-- KB_SNIPPETS
-- ============================================================================
ALTER TABLE public.kb_snippets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON public.kb_snippets
FOR SELECT USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "tenant_isolation_insert" ON public.kb_snippets
FOR INSERT WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "tenant_isolation_update" ON public.kb_snippets
FOR UPDATE USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "tenant_isolation_delete" ON public.kb_snippets
FOR DELETE USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

-- ============================================================================
-- AI_SETTINGS
-- ============================================================================
ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON public.ai_settings
FOR SELECT USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "tenant_isolation_insert" ON public.ai_settings
FOR INSERT WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "tenant_isolation_update" ON public.ai_settings
FOR UPDATE USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

-- ============================================================================
-- AI_TEAM_SETTINGS
-- ============================================================================
ALTER TABLE public.ai_team_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON public.ai_team_settings
FOR SELECT USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "tenant_isolation_insert" ON public.ai_team_settings
FOR INSERT WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "tenant_isolation_update" ON public.ai_team_settings
FOR UPDATE USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "tenant_isolation_delete" ON public.ai_team_settings
FOR DELETE USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

-- ============================================================================
-- INTEGRATIONS_SETTINGS
-- ============================================================================
ALTER TABLE public.integrations_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON public.integrations_settings
FOR SELECT USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "tenant_isolation_insert" ON public.integrations_settings
FOR INSERT WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "tenant_isolation_update" ON public.integrations_settings
FOR UPDATE USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

-- ============================================================================
-- ZAPI_SETTINGS
-- ============================================================================
ALTER TABLE public.zapi_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_select" ON public.zapi_settings
FOR SELECT USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "tenant_isolation_insert" ON public.zapi_settings
FOR INSERT WITH CHECK (tenant_id IN (SELECT public.get_user_tenant_ids()));

CREATE POLICY "tenant_isolation_update" ON public.zapi_settings
FOR UPDATE USING (tenant_id IN (SELECT public.get_user_tenant_ids()));

-- Add comment
COMMENT ON FUNCTION public.get_user_tenant_ids() IS 'Returns all tenant IDs that the current user is an active member of';
