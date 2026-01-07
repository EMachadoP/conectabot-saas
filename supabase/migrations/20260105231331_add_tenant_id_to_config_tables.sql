-- Add tenant_id to configuration tables
-- Settings tables that need tenant isolation

-- 1. AI_SETTINGS (singleton per tenant)
ALTER TABLE public.ai_settings 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_ai_settings_tenant_id ON public.ai_settings(tenant_id);

UPDATE public.ai_settings 
SET tenant_id = '00000000-0000-0000-0000-000000000001' 
WHERE tenant_id IS NULL;

ALTER TABLE public.ai_settings 
ALTER COLUMN tenant_id SET NOT NULL;

-- 2. AI_TEAM_SETTINGS
ALTER TABLE public.ai_team_settings 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_ai_team_settings_tenant_id ON public.ai_team_settings(tenant_id);

UPDATE public.ai_team_settings 
SET tenant_id = '00000000-0000-0000-0000-000000000001' 
WHERE tenant_id IS NULL;

ALTER TABLE public.ai_team_settings 
ALTER COLUMN tenant_id SET NOT NULL;

-- 3. INTEGRATIONS_SETTINGS (singleton per tenant)
ALTER TABLE public.integrations_settings 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_integrations_settings_tenant_id ON public.integrations_settings(tenant_id);

UPDATE public.integrations_settings 
SET tenant_id = '00000000-0000-0000-0000-000000000001' 
WHERE tenant_id IS NULL;

ALTER TABLE public.integrations_settings 
ALTER COLUMN tenant_id SET NOT NULL;

-- 4. ZAPI_SETTINGS (singleton per tenant)
ALTER TABLE public.zapi_settings 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_zapi_settings_tenant_id ON public.zapi_settings(tenant_id);

UPDATE public.zapi_settings 
SET tenant_id = '00000000-0000-0000-0000-000000000001' 
WHERE tenant_id IS NULL;

ALTER TABLE public.zapi_settings 
ALTER COLUMN tenant_id SET NOT NULL;

-- Add comments
COMMENT ON COLUMN public.ai_settings.tenant_id IS 'Multi-tenant: isolates AI settings by tenant';
COMMENT ON COLUMN public.ai_team_settings.tenant_id IS 'Multi-tenant: isolates AI team settings by tenant';
COMMENT ON COLUMN public.integrations_settings.tenant_id IS 'Multi-tenant: isolates integration settings by tenant';
COMMENT ON COLUMN public.zapi_settings.tenant_id IS 'Multi-tenant: isolates Z-API settings by tenant';
