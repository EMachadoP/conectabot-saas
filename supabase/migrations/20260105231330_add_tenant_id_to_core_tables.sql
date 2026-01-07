-- Add tenant_id to core tables
-- This migration adds tenant_id column to essential tables and sets default tenant

-- 1. CONTACTS
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_contacts_tenant_id ON public.contacts(tenant_id);

UPDATE public.contacts 
SET tenant_id = '00000000-0000-0000-0000-000000000001' 
WHERE tenant_id IS NULL;

ALTER TABLE public.contacts 
ALTER COLUMN tenant_id SET NOT NULL;

-- 2. CONVERSATIONS
ALTER TABLE public.conversations 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_conversations_tenant_id ON public.conversations(tenant_id);

UPDATE public.conversations 
SET tenant_id = '00000000-0000-0000-0000-000000000001' 
WHERE tenant_id IS NULL;

ALTER TABLE public.conversations 
ALTER COLUMN tenant_id SET NOT NULL;

-- 3. MESSAGES
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_messages_tenant_id ON public.messages(tenant_id);

UPDATE public.messages 
SET tenant_id = '00000000-0000-0000-0000-000000000001' 
WHERE tenant_id IS NULL;

ALTER TABLE public.messages 
ALTER COLUMN tenant_id SET NOT NULL;

-- 4. PROTOCOLS
ALTER TABLE public.protocols 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_protocols_tenant_id ON public.protocols(tenant_id);

UPDATE public.protocols 
SET tenant_id = '00000000-0000-0000-0000-000000000001' 
WHERE tenant_id IS NULL;

ALTER TABLE public.protocols 
ALTER COLUMN tenant_id SET NOT NULL;

-- 5. PROFILES
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_profiles_tenant_id ON public.profiles(tenant_id);

UPDATE public.profiles 
SET tenant_id = '00000000-0000-0000-0000-000000000001' 
WHERE tenant_id IS NULL;

ALTER TABLE public.profiles 
ALTER COLUMN tenant_id SET NOT NULL;

-- 6. LABELS
ALTER TABLE public.labels 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_labels_tenant_id ON public.labels(tenant_id);

UPDATE public.labels 
SET tenant_id = '00000000-0000-0000-0000-000000000001' 
WHERE tenant_id IS NULL;

ALTER TABLE public.labels 
ALTER COLUMN tenant_id SET NOT NULL;

-- 7. TEAMS
ALTER TABLE public.teams 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_teams_tenant_id ON public.teams(tenant_id);

UPDATE public.teams 
SET tenant_id = '00000000-0000-0000-0000-000000000001' 
WHERE tenant_id IS NULL;

ALTER TABLE public.teams 
ALTER COLUMN tenant_id SET NOT NULL;

-- 8. AGENTS
ALTER TABLE public.agents 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_agents_tenant_id ON public.agents(tenant_id);

UPDATE public.agents 
SET tenant_id = '00000000-0000-0000-0000-000000000001' 
WHERE tenant_id IS NULL;

ALTER TABLE public.agents 
ALTER COLUMN tenant_id SET NOT NULL;

-- 9. CONDOMINIUMS
ALTER TABLE public.condominiums 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_condominiums_tenant_id ON public.condominiums(tenant_id);

UPDATE public.condominiums 
SET tenant_id = '00000000-0000-0000-0000-000000000001' 
WHERE tenant_id IS NULL;

ALTER TABLE public.condominiums 
ALTER COLUMN tenant_id SET NOT NULL;

-- 10. KB_SNIPPETS
ALTER TABLE public.kb_snippets 
ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_kb_snippets_tenant_id ON public.kb_snippets(tenant_id);

UPDATE public.kb_snippets 
SET tenant_id = '00000000-0000-0000-0000-000000000001' 
WHERE tenant_id IS NULL;

ALTER TABLE public.kb_snippets 
ALTER COLUMN tenant_id SET NOT NULL;

-- Add comments
COMMENT ON COLUMN public.contacts.tenant_id IS 'Multi-tenant: isolates contacts by tenant';
COMMENT ON COLUMN public.conversations.tenant_id IS 'Multi-tenant: isolates conversations by tenant';
COMMENT ON COLUMN public.messages.tenant_id IS 'Multi-tenant: isolates messages by tenant';
COMMENT ON COLUMN public.protocols.tenant_id IS 'Multi-tenant: isolates protocols by tenant';
COMMENT ON COLUMN public.profiles.tenant_id IS 'Multi-tenant: associates user profile with tenant';
COMMENT ON COLUMN public.labels.tenant_id IS 'Multi-tenant: isolates labels by tenant';
COMMENT ON COLUMN public.teams.tenant_id IS 'Multi-tenant: isolates teams by tenant';
COMMENT ON COLUMN public.agents.tenant_id IS 'Multi-tenant: isolates agents by tenant';
COMMENT ON COLUMN public.condominiums.tenant_id IS 'Multi-tenant: isolates condominiums by tenant';
COMMENT ON COLUMN public.kb_snippets.tenant_id IS 'Multi-tenant: isolates knowledge base snippets by tenant';
