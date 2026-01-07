-- Create tenants table
CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  settings JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create tenant_members table
CREATE TABLE IF NOT EXISTS public.tenant_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_tenant_members_tenant_id ON public.tenant_members(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_members_user_id ON public.tenant_members(user_id);
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON public.tenants(slug);
CREATE INDEX IF NOT EXISTS idx_tenants_is_active ON public.tenants(is_active);

-- Enable RLS on new tables
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tenants table
-- Users can view tenants they are members of
CREATE POLICY "Users can view their tenants"
ON public.tenants
FOR SELECT
USING (
  id IN (
    SELECT tenant_id 
    FROM public.tenant_members 
    WHERE user_id = auth.uid() 
    AND is_active = true
  )
);

-- Only owners can update tenant settings
CREATE POLICY "Owners can update their tenant"
ON public.tenants
FOR UPDATE
USING (
  id IN (
    SELECT tenant_id 
    FROM public.tenant_members 
    WHERE user_id = auth.uid() 
    AND role = 'owner'
    AND is_active = true
  )
);

-- RLS Policies for tenant_members table
-- Users can view members of their tenants
CREATE POLICY "Users can view their tenant members"
ON public.tenant_members
FOR SELECT
USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM public.tenant_members 
    WHERE user_id = auth.uid() 
    AND is_active = true
  )
);

-- Only owners can manage members
CREATE POLICY "Owners can manage tenant members"
ON public.tenant_members
FOR ALL
USING (
  tenant_id IN (
    SELECT tenant_id 
    FROM public.tenant_members 
    WHERE user_id = auth.uid() 
    AND role = 'owner'
    AND is_active = true
  )
);

-- Create default tenant
INSERT INTO public.tenants (id, name, slug, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Tenant Padrão',
  'default',
  true
)
ON CONFLICT (id) DO NOTHING;

-- Associate all existing users with default tenant as owners
INSERT INTO public.tenant_members (tenant_id, user_id, role, is_active)
SELECT 
  '00000000-0000-0000-0000-000000000001',
  id,
  'owner',
  true
FROM auth.users
ON CONFLICT (tenant_id, user_id) DO NOTHING;

-- Add helpful comment
COMMENT ON TABLE public.tenants IS 'Multi-tenant support: stores company/organization information';
COMMENT ON TABLE public.tenant_members IS 'Multi-tenant support: maps users to tenants with roles';
COMMENT ON COLUMN public.tenant_members.role IS 'User role in tenant: owner, admin, or member';
