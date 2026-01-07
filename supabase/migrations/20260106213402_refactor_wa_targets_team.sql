-- Refactor wa_targets to use team_id and support manual entries
-- Changes:
-- 1. Rename tenant_id to team_id
-- 2. Add phone_e164, source, last_seen_at columns
-- 3. Update constraints and indexes
-- 4. Update RLS policies

-- Drop existing unique constraint
ALTER TABLE public.wa_targets DROP CONSTRAINT IF EXISTS wa_targets_tenant_id_jid_key;

-- Rename tenant_id to team_id
ALTER TABLE public.wa_targets RENAME COLUMN tenant_id TO team_id;

-- Update foreign key
ALTER TABLE public.wa_targets DROP CONSTRAINT IF EXISTS wa_targets_tenant_id_fkey;
ALTER TABLE public.wa_targets 
  ADD CONSTRAINT wa_targets_team_id_fkey 
  FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;

-- Add new columns for manual entry support
ALTER TABLE public.wa_targets ADD COLUMN IF NOT EXISTS phone_e164 text;
ALTER TABLE public.wa_targets ADD COLUMN IF NOT EXISTS source text not null default 'sync' check (source in ('sync', 'manual'));
ALTER TABLE public.wa_targets ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

-- Add unique constraint with team_id
ALTER TABLE public.wa_targets 
  ADD CONSTRAINT wa_targets_team_jid_unique UNIQUE(team_id, jid);

-- Drop old indexes
DROP INDEX IF EXISTS idx_wa_targets_tenant;
DROP INDEX IF EXISTS idx_wa_targets_search;
DROP INDEX IF EXISTS idx_wa_targets_type;

-- Create new indexes
CREATE INDEX IF NOT EXISTS idx_wa_targets_team 
ON public.wa_targets(team_id);

CREATE INDEX IF NOT EXISTS idx_wa_targets_team_type 
ON public.wa_targets(team_id, type);

CREATE INDEX IF NOT EXISTS idx_wa_targets_search 
ON public.wa_targets(team_id, display_name);

CREATE INDEX IF NOT EXISTS idx_wa_targets_phone 
ON public.wa_targets(phone_e164) WHERE phone_e164 IS NOT NULL;

-- Enable pg_trgm extension for fuzzy search (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create trigram index for better search performance
CREATE INDEX IF NOT EXISTS idx_wa_targets_display_name_trgm 
ON public.wa_targets USING gin(display_name gin_trgm_ops);

-- Drop old RLS policies
DROP POLICY IF EXISTS tenant_select_wa_targets ON public.wa_targets;
DROP POLICY IF EXISTS tenant_insert_wa_targets ON public.wa_targets;
DROP POLICY IF EXISTS tenant_update_wa_targets ON public.wa_targets;
DROP POLICY IF EXISTS tenant_delete_wa_targets ON public.wa_targets;

-- Create new team-based RLS policies
CREATE POLICY "team_select_wa_targets"
ON public.wa_targets FOR SELECT
USING (team_id IN (SELECT team_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "team_insert_wa_targets"
ON public.wa_targets FOR INSERT
WITH CHECK (team_id IN (SELECT team_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "team_update_wa_targets"
ON public.wa_targets FOR UPDATE
USING (team_id IN (SELECT team_id FROM public.profiles WHERE id = auth.uid()))
WITH CHECK (team_id IN (SELECT team_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "team_delete_wa_targets"
ON public.wa_targets FOR DELETE
USING (team_id IN (SELECT team_id FROM public.profiles WHERE id = auth.uid()));

-- Update comments
COMMENT ON COLUMN public.wa_targets.team_id IS 'Team that owns this target';
COMMENT ON COLUMN public.wa_targets.phone_e164 IS 'Phone number in E.164 format (only for person type), e.g., 5511999999999';
COMMENT ON COLUMN public.wa_targets.source IS 'Source of target: sync (from Evolution API) or manual (user input)';
COMMENT ON COLUMN public.wa_targets.last_seen_at IS 'Last time this target was seen in Evolution sync (null for manual entries)';
