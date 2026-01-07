-- Update reminder_targets to use team_id instead of tenant_id
-- This aligns with the team-based architecture

-- First, rename tenant_id to team_id
ALTER TABLE public.reminder_targets RENAME COLUMN tenant_id TO team_id;

-- Update foreign key
ALTER TABLE public.reminder_targets DROP CONSTRAINT IF EXISTS reminder_targets_tenant_id_fkey;

-- Clean up any orphaned data before adding new foreign key
DELETE FROM public.reminder_targets
WHERE team_id NOT IN (SELECT id FROM public.teams);

-- Add new foreign key constraint
ALTER TABLE public.reminder_targets 
  ADD CONSTRAINT reminder_targets_team_id_fkey 
  FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;
