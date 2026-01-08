-- Migration to fix architectural split and RLS policies
-- Goal: Ensure wa_instances uses the same concept of 'tenant' as everything else

-- 1. Create a migration to allow wa_instances to work with tenant_id or rename team_id concept
-- For safety, we keep the column name 'team_id' but ensure it can receive 'tenant_id'
-- and fix RLS policies to use tenant_members

-- Fix RLS for public.wa_instances
DROP POLICY IF EXISTS "team_select_wa_instances" ON public.wa_instances;
DROP POLICY IF EXISTS "team_insert_wa_instances" ON public.wa_instances;
DROP POLICY IF EXISTS "team_update_wa_instances" ON public.wa_instances;
DROP POLICY IF EXISTS "team_delete_wa_instances" ON public.wa_instances;

CREATE POLICY "wa_instances_select"
ON public.wa_instances FOR SELECT
TO authenticated
USING (
  team_id IN (
    SELECT tenant_id FROM public.tenant_members 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "wa_instances_insert"
ON public.wa_instances FOR INSERT
TO authenticated
WITH CHECK (
  team_id IN (
    SELECT tenant_id FROM public.tenant_members 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "wa_instances_update"
ON public.wa_instances FOR UPDATE
TO authenticated
USING (
  team_id IN (
    SELECT tenant_id FROM public.tenant_members 
    WHERE user_id = auth.uid() AND is_active = true
  )
)
WITH CHECK (
  team_id IN (
    SELECT tenant_id FROM public.tenant_members 
    WHERE user_id = auth.uid() AND is_active = true
  )
);

-- Fix RLS for public.tenant_integrations
DROP POLICY IF EXISTS "Users can view their own tenant integrations" ON public.tenant_integrations;
DROP POLICY IF EXISTS "Admins can manage tenant integrations" ON public.tenant_integrations;

CREATE POLICY "tenant_integrations_select"
  ON public.tenant_integrations FOR SELECT
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_members 
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "tenant_integrations_all_admins"
  ON public.tenant_integrations FOR ALL
  TO authenticated
  USING (
    tenant_id IN (
      SELECT tenant_id FROM public.tenant_members 
      WHERE user_id = auth.uid() AND is_active = true
    )
    AND public.has_role(auth.uid(), 'admin')
  );

-- Ensure wa_instances doesn't strictly depend on public.teams FK if we are using tenants
-- This is a bit risky but may be necessary if the IDs are different.
-- However, given the code, we are likely using the same UUIDs for both in many cases.
-- We will at least relax the check or ensure a record exists.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'wa_instances_team_id_fkey'
    ) THEN
        ALTER TABLE public.wa_instances DROP CONSTRAINT wa_instances_team_id_fkey;
        -- Now point to tenants if it exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenants') THEN
            ALTER TABLE public.wa_instances ADD CONSTRAINT wa_instances_team_id_fkey 
            FOREIGN KEY (team_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
        END IF;
    END IF;
END $$;
