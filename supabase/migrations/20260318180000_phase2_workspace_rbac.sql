DO $$
BEGIN
  ALTER TABLE public.tenant_members
    ALTER COLUMN role SET DEFAULT 'agent';
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

UPDATE public.tenant_members
SET role = CASE role
  WHEN 'member' THEN 'agent'
  WHEN 'super_admin' THEN 'admin'
  ELSE role
END
WHERE role IN ('member', 'super_admin');

DO $$
BEGIN
  ALTER TABLE public.tenant_members
    DROP CONSTRAINT IF EXISTS tenant_members_role_check;

  ALTER TABLE public.tenant_members
    ADD CONSTRAINT tenant_members_role_check
    CHECK (role IS NULL OR role IN ('owner', 'admin', 'agent'));
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

WITH ranked_memberships AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY tenant_id, user_id
      ORDER BY
        CASE COALESCE(role, 'agent')
          WHEN 'owner' THEN 0
          WHEN 'admin' THEN 1
          ELSE 2
        END,
        is_active DESC,
        created_at,
        id
    ) AS membership_rank
  FROM public.tenant_members
)
DELETE FROM public.tenant_members tm
USING ranked_memberships rm
WHERE tm.id = rm.id
  AND rm.membership_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS tenant_members_tenant_user_key
  ON public.tenant_members (tenant_id, user_id);

CREATE OR REPLACE FUNCTION public.workspace_membership_role(
  p_workspace_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  IF p_workspace_id IS NULL OR p_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(tm.role, 'agent')
  INTO v_role
  FROM public.tenant_members tm
  WHERE tm.tenant_id = p_workspace_id
    AND tm.user_id = p_user_id
    AND tm.is_active = true
  ORDER BY
    CASE COALESCE(tm.role, 'agent')
      WHEN 'owner' THEN 0
      WHEN 'admin' THEN 1
      ELSE 2
    END,
    tm.created_at
  LIMIT 1;

  RETURN v_role;
END;
$$;

CREATE OR REPLACE FUNCTION public.current_workspace_role()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_claim_role text;
  v_claim_workspace_id uuid;
  v_current_workspace_id uuid;
BEGIN
  v_claim_role := auth.jwt() ->> 'workspace_role';
  v_current_workspace_id := public.current_workspace_id();

  BEGIN
    v_claim_workspace_id := NULLIF(auth.jwt() ->> 'workspace_id', '')::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      v_claim_workspace_id := NULL;
  END;

  IF v_claim_role IS NOT NULL
     AND v_claim_workspace_id IS NOT NULL
     AND v_claim_workspace_id = v_current_workspace_id THEN
    RETURN v_claim_role;
  END IF;

  RETURN public.workspace_membership_role(v_current_workspace_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_workspace_members(
  p_workspace_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    public.workspace_membership_role(p_workspace_id, p_user_id) IN ('owner', 'admin'),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.sync_user_workspace_claims(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_primary_workspace_id uuid;
  v_primary_workspace_role text;
  v_workspace_ids jsonb := '[]'::jsonb;
  v_workspace_roles jsonb := '{}'::jsonb;
BEGIN
  WITH ordered_memberships AS (
    SELECT
      tm.tenant_id,
      COALESCE(tm.role, 'agent') AS role
    FROM public.tenant_members tm
    WHERE tm.user_id = p_user_id
      AND tm.is_active = true
    ORDER BY
      CASE COALESCE(tm.role, 'agent')
        WHEN 'owner' THEN 0
        WHEN 'admin' THEN 1
        ELSE 2
      END,
      tm.created_at
  )
  SELECT
    COALESCE(jsonb_agg(tenant_id), '[]'::jsonb),
    COALESCE(
      (
        SELECT jsonb_object_agg(tenant_id::text, role)
        FROM ordered_memberships
      ),
      '{}'::jsonb
    ),
    (
      SELECT tenant_id
      FROM ordered_memberships
      LIMIT 1
    ),
    (
      SELECT role
      FROM ordered_memberships
      LIMIT 1
    )
  INTO v_workspace_ids, v_workspace_roles, v_primary_workspace_id, v_primary_workspace_role
  FROM ordered_memberships;

  v_workspace_ids := COALESCE(v_workspace_ids, '[]'::jsonb);
  v_workspace_roles := COALESCE(v_workspace_roles, '{}'::jsonb);

  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object(
      'workspace_id', v_primary_workspace_id,
      'workspace_ids', v_workspace_ids,
      'workspace_role', v_primary_workspace_role,
      'workspace_roles', v_workspace_roles,
      'tenant_id', v_primary_workspace_id,
      'tenant_ids', v_workspace_ids,
      'tenant_role', v_primary_workspace_role,
      'tenant_roles', v_workspace_roles
    )
  WHERE id = p_user_id;
END;
$$;

DO $$
DECLARE
  policy_record record;
BEGIN
  FOR policy_record IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tenant_members'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.tenant_members', policy_record.policyname);
  END LOOP;
END $$;

ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_members_workspace_select
ON public.tenant_members
FOR SELECT
TO authenticated
USING (
  current_setting('role', true) = 'service_role'
  OR public.is_workspace_member(tenant_id)
);

CREATE POLICY tenant_members_workspace_insert
ON public.tenant_members
FOR INSERT
TO authenticated
WITH CHECK (
  current_setting('role', true) = 'service_role'
  OR public.can_manage_workspace_members(tenant_id)
);

CREATE POLICY tenant_members_workspace_update
ON public.tenant_members
FOR UPDATE
TO authenticated
USING (
  current_setting('role', true) = 'service_role'
  OR public.can_manage_workspace_members(tenant_id)
)
WITH CHECK (
  current_setting('role', true) = 'service_role'
  OR public.can_manage_workspace_members(tenant_id)
);

CREATE POLICY tenant_members_workspace_delete
ON public.tenant_members
FOR DELETE
TO authenticated
USING (
  current_setting('role', true) = 'service_role'
  OR public.can_manage_workspace_members(tenant_id)
);

DO $$
DECLARE
  membership_record record;
BEGIN
  FOR membership_record IN
    SELECT DISTINCT user_id
    FROM public.tenant_members
  LOOP
    PERFORM public.sync_user_workspace_claims(membership_record.user_id);
  END LOOP;
END $$;
