-- Phase 1: Workspace isolation foundation
-- Keeps backward compatibility with existing tenant_id columns while making
-- workspace_id the canonical isolation field for the main business tables.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.current_workspace_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH jwt_claims AS (
    SELECT COALESCE(
      auth.jwt() -> 'app_metadata' -> 'workspace_ids',
      auth.jwt() -> 'user_metadata' -> 'workspace_ids',
      '[]'::jsonb
    ) AS ids
  )
  SELECT value::uuid
  FROM jwt_claims, jsonb_array_elements_text(jwt_claims.ids)

  UNION

  SELECT tm.tenant_id
  FROM public.tenant_members tm
  WHERE tm.user_id = auth.uid()
    AND tm.is_active = true;
$$;

CREATE OR REPLACE FUNCTION public.current_workspace_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(auth.jwt() -> 'app_metadata' ->> 'workspace_id', '')::uuid,
    NULLIF(auth.jwt() -> 'user_metadata' ->> 'workspace_id', '')::uuid,
    (
      SELECT tm.tenant_id
      FROM public.tenant_members tm
      WHERE tm.user_id = auth.uid()
        AND tm.is_active = true
      ORDER BY
        CASE tm.role
          WHEN 'owner' THEN 0
          WHEN 'admin' THEN 1
          ELSE 2
        END,
        tm.created_at
      LIMIT 1
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.is_workspace_member(p_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.current_workspace_ids() workspace_ids
    WHERE workspace_ids = p_workspace_id
  );
$$;

CREATE OR REPLACE FUNCTION public.generate_workspace_slug(p_name text, p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_slug_base text;
BEGIN
  v_slug_base := lower(trim(regexp_replace(COALESCE(p_name, ''), '[^a-zA-Z0-9]+', '-', 'g')));
  v_slug_base := trim(both '-' from v_slug_base);

  IF v_slug_base = '' THEN
    v_slug_base := 'workspace';
  END IF;

  RETURN left(v_slug_base, 48) || '-' || left(replace(p_user_id::text, '-', ''), 8);
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_workspace_and_tenant_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF to_jsonb(NEW) ? 'workspace_id' AND to_jsonb(NEW) ? 'tenant_id' THEN
    IF NEW.workspace_id IS NULL AND NEW.tenant_id IS NOT NULL THEN
      NEW.workspace_id := NEW.tenant_id;
    ELSIF NEW.tenant_id IS NULL AND NEW.workspace_id IS NOT NULL THEN
      NEW.tenant_id := NEW.workspace_id;
    ELSIF NEW.workspace_id IS NOT NULL
      AND NEW.tenant_id IS NOT NULL
      AND NEW.workspace_id <> NEW.tenant_id THEN
      RAISE EXCEPTION 'workspace_id and tenant_id must match';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_user_workspace_claims(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_primary_workspace_id uuid;
  v_workspace_ids jsonb := '[]'::jsonb;
BEGIN
  WITH ordered_memberships AS (
    SELECT tm.tenant_id
    FROM public.tenant_members tm
    WHERE tm.user_id = p_user_id
      AND tm.is_active = true
    ORDER BY
      CASE tm.role
        WHEN 'owner' THEN 0
        WHEN 'admin' THEN 1
        ELSE 2
      END,
      tm.created_at
  )
  SELECT
    COALESCE(jsonb_agg(tenant_id), '[]'::jsonb),
    (
      SELECT tenant_id
      FROM ordered_memberships
      LIMIT 1
    )
  INTO v_workspace_ids, v_primary_workspace_id
  FROM ordered_memberships;

  v_workspace_ids := COALESCE(v_workspace_ids, '[]'::jsonb);

  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object(
      'workspace_id', v_primary_workspace_id,
      'workspace_ids', v_workspace_ids,
      'tenant_id', v_primary_workspace_id,
      'tenant_ids', v_workspace_ids
    )
  WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_tenant_membership_claims()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.sync_user_workspace_claims(OLD.user_id);
    RETURN OLD;
  END IF;

  PERFORM public.sync_user_workspace_claims(NEW.user_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS sync_tenant_membership_claims ON public.tenant_members;
CREATE TRIGGER sync_tenant_membership_claims
AFTER INSERT OR UPDATE OR DELETE ON public.tenant_members
FOR EACH ROW
EXECUTE FUNCTION public.handle_tenant_membership_claims();

CREATE OR REPLACE VIEW public.workspaces AS
SELECT
  t.id,
  t.name,
  t.slug,
  t.settings,
  t.is_active,
  t.created_at,
  t.updated_at
FROM public.tenants t;

CREATE OR REPLACE VIEW public.workspace_members AS
SELECT
  tm.id,
  tm.tenant_id AS workspace_id,
  tm.user_id,
  tm.role,
  tm.is_active,
  tm.created_at,
  tm.updated_at
FROM public.tenant_members tm;

GRANT SELECT ON public.workspaces TO authenticated;
GRANT SELECT ON public.workspace_members TO authenticated;

ALTER TABLE public.contacts
ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.conversations
ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.protocols
ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.participants
ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE;

UPDATE public.contacts
SET workspace_id = tenant_id
WHERE workspace_id IS NULL
  AND tenant_id IS NOT NULL;

UPDATE public.conversations
SET workspace_id = tenant_id
WHERE workspace_id IS NULL
  AND tenant_id IS NOT NULL;

UPDATE public.messages
SET workspace_id = tenant_id
WHERE workspace_id IS NULL
  AND tenant_id IS NOT NULL;

UPDATE public.protocols
SET workspace_id = tenant_id
WHERE workspace_id IS NULL
  AND tenant_id IS NOT NULL;

UPDATE public.profiles
SET workspace_id = tenant_id
WHERE workspace_id IS NULL
  AND tenant_id IS NOT NULL;

UPDATE public.participants p
SET workspace_id = COALESCE(c.workspace_id, c.tenant_id)
FROM public.contacts c
WHERE p.contact_id = c.id
  AND p.workspace_id IS NULL;

ALTER TABLE public.contacts
ALTER COLUMN workspace_id SET NOT NULL;

ALTER TABLE public.conversations
ALTER COLUMN workspace_id SET NOT NULL;

ALTER TABLE public.messages
ALTER COLUMN workspace_id SET NOT NULL;

ALTER TABLE public.protocols
ALTER COLUMN workspace_id SET NOT NULL;

ALTER TABLE public.participants
ALTER COLUMN workspace_id SET NOT NULL;

ALTER TABLE public.profiles
ALTER COLUMN workspace_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_workspace_id ON public.contacts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_conversations_workspace_id ON public.conversations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_messages_workspace_id ON public.messages(workspace_id);
CREATE INDEX IF NOT EXISTS idx_protocols_workspace_id ON public.protocols(workspace_id);
CREATE INDEX IF NOT EXISTS idx_participants_workspace_id ON public.participants(workspace_id);
CREATE INDEX IF NOT EXISTS idx_profiles_workspace_id ON public.profiles(workspace_id);

DROP TRIGGER IF EXISTS contacts_sync_workspace_tenant ON public.contacts;
CREATE TRIGGER contacts_sync_workspace_tenant
BEFORE INSERT OR UPDATE ON public.contacts
FOR EACH ROW
EXECUTE FUNCTION public.sync_workspace_and_tenant_id();

DROP TRIGGER IF EXISTS conversations_sync_workspace_tenant ON public.conversations;
CREATE TRIGGER conversations_sync_workspace_tenant
BEFORE INSERT OR UPDATE ON public.conversations
FOR EACH ROW
EXECUTE FUNCTION public.sync_workspace_and_tenant_id();

DROP TRIGGER IF EXISTS messages_sync_workspace_tenant ON public.messages;
CREATE TRIGGER messages_sync_workspace_tenant
BEFORE INSERT OR UPDATE ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.sync_workspace_and_tenant_id();

DROP TRIGGER IF EXISTS protocols_sync_workspace_tenant ON public.protocols;
CREATE TRIGGER protocols_sync_workspace_tenant
BEFORE INSERT OR UPDATE ON public.protocols
FOR EACH ROW
EXECUTE FUNCTION public.sync_workspace_and_tenant_id();

DROP TRIGGER IF EXISTS profiles_sync_workspace_tenant ON public.profiles;
CREATE TRIGGER profiles_sync_workspace_tenant
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_workspace_and_tenant_id();

DROP POLICY IF EXISTS tenant_isolation_select ON public.contacts;
DROP POLICY IF EXISTS tenant_isolation_insert ON public.contacts;
DROP POLICY IF EXISTS tenant_isolation_update ON public.contacts;
DROP POLICY IF EXISTS tenant_isolation_delete ON public.contacts;

CREATE POLICY contacts_workspace_select
ON public.contacts
FOR SELECT
USING (public.is_workspace_member(workspace_id));

CREATE POLICY contacts_workspace_insert
ON public.contacts
FOR INSERT
WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY contacts_workspace_update
ON public.contacts
FOR UPDATE
USING (public.is_workspace_member(workspace_id))
WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY contacts_workspace_delete
ON public.contacts
FOR DELETE
USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS tenant_isolation_select ON public.conversations;
DROP POLICY IF EXISTS tenant_isolation_insert ON public.conversations;
DROP POLICY IF EXISTS tenant_isolation_update ON public.conversations;
DROP POLICY IF EXISTS tenant_isolation_delete ON public.conversations;

CREATE POLICY conversations_workspace_select
ON public.conversations
FOR SELECT
USING (public.is_workspace_member(workspace_id));

CREATE POLICY conversations_workspace_insert
ON public.conversations
FOR INSERT
WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY conversations_workspace_update
ON public.conversations
FOR UPDATE
USING (public.is_workspace_member(workspace_id))
WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY conversations_workspace_delete
ON public.conversations
FOR DELETE
USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS tenant_isolation_select ON public.messages;
DROP POLICY IF EXISTS tenant_isolation_insert ON public.messages;
DROP POLICY IF EXISTS tenant_isolation_update ON public.messages;
DROP POLICY IF EXISTS tenant_isolation_delete ON public.messages;

CREATE POLICY messages_workspace_select
ON public.messages
FOR SELECT
USING (public.is_workspace_member(workspace_id));

CREATE POLICY messages_workspace_insert
ON public.messages
FOR INSERT
WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY messages_workspace_update
ON public.messages
FOR UPDATE
USING (public.is_workspace_member(workspace_id))
WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY messages_workspace_delete
ON public.messages
FOR DELETE
USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS tenant_isolation_select ON public.protocols;
DROP POLICY IF EXISTS tenant_isolation_insert ON public.protocols;
DROP POLICY IF EXISTS tenant_isolation_update ON public.protocols;
DROP POLICY IF EXISTS tenant_isolation_delete ON public.protocols;

CREATE POLICY protocols_workspace_select
ON public.protocols
FOR SELECT
USING (public.is_workspace_member(workspace_id));

CREATE POLICY protocols_workspace_insert
ON public.protocols
FOR INSERT
WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY protocols_workspace_update
ON public.protocols
FOR UPDATE
USING (public.is_workspace_member(workspace_id))
WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY protocols_workspace_delete
ON public.protocols
FOR DELETE
USING (public.is_workspace_member(workspace_id));

ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS participants_workspace_select ON public.participants;
DROP POLICY IF EXISTS participants_workspace_insert ON public.participants;
DROP POLICY IF EXISTS participants_workspace_update ON public.participants;
DROP POLICY IF EXISTS participants_workspace_delete ON public.participants;

CREATE POLICY participants_workspace_select
ON public.participants
FOR SELECT
USING (public.is_workspace_member(workspace_id));

CREATE POLICY participants_workspace_insert
ON public.participants
FOR INSERT
WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY participants_workspace_update
ON public.participants
FOR UPDATE
USING (public.is_workspace_member(workspace_id))
WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY participants_workspace_delete
ON public.participants
FOR DELETE
USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS tenant_isolation_select ON public.profiles;
DROP POLICY IF EXISTS tenant_isolation_insert ON public.profiles;
DROP POLICY IF EXISTS tenant_isolation_update ON public.profiles;

CREATE POLICY profiles_workspace_select
ON public.profiles
FOR SELECT
USING (public.is_workspace_member(workspace_id));

CREATE POLICY profiles_workspace_insert
ON public.profiles
FOR INSERT
WITH CHECK (public.is_workspace_member(workspace_id));

CREATE POLICY profiles_workspace_update
ON public.profiles
FOR UPDATE
USING (public.is_workspace_member(workspace_id))
WITH CHECK (public.is_workspace_member(workspace_id));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_workspace_name text;
  v_workspace_slug text;
  v_workspace_id uuid;
BEGIN
  v_name := COALESCE(
    NEW.raw_user_meta_data ->> 'name',
    NEW.raw_user_meta_data ->> 'full_name',
    split_part(NEW.email, '@', 1)
  );

  v_workspace_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data ->> 'workspace_name', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'company_name', ''),
    v_name
  );

  v_workspace_slug := public.generate_workspace_slug(v_workspace_name, NEW.id);

  INSERT INTO public.tenants (name, slug, settings, is_active)
  VALUES (
    v_workspace_name,
    v_workspace_slug,
    jsonb_build_object('app_name', 'G7 Client Connector'),
    true
  )
  RETURNING id INTO v_workspace_id;

  INSERT INTO public.profiles (id, email, name, tenant_id, workspace_id)
  VALUES (NEW.id, NEW.email, v_name, v_workspace_id, v_workspace_id)
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    tenant_id = EXCLUDED.tenant_id,
    workspace_id = EXCLUDED.workspace_id;

  INSERT INTO public.tenant_members (tenant_id, user_id, role, is_active)
  VALUES (v_workspace_id, NEW.id, 'owner', true)
  ON CONFLICT (tenant_id, user_id) DO UPDATE SET
    role = EXCLUDED.role,
    is_active = true,
    updated_at = now();

  PERFORM public.sync_user_workspace_claims(NEW.id);

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'handle_new_user failed for %: % (SQLSTATE: %)', NEW.id, SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$;

COMMENT ON VIEW public.workspaces IS 'Canonical workspace naming over the existing tenants table.';
COMMENT ON VIEW public.workspace_members IS 'Canonical workspace membership naming over tenant_members.';
COMMENT ON COLUMN public.contacts.workspace_id IS 'Canonical workspace isolation key.';
COMMENT ON COLUMN public.conversations.workspace_id IS 'Canonical workspace isolation key.';
COMMENT ON COLUMN public.messages.workspace_id IS 'Canonical workspace isolation key.';
COMMENT ON COLUMN public.protocols.workspace_id IS 'Canonical workspace isolation key.';
COMMENT ON COLUMN public.participants.workspace_id IS 'Canonical workspace isolation key.';
COMMENT ON COLUMN public.profiles.workspace_id IS 'Canonical workspace isolation key.';

DO $$
DECLARE
  membership_record record;
BEGIN
  FOR membership_record IN
    SELECT DISTINCT user_id
    FROM public.tenant_members
    WHERE user_id IS NOT NULL
  LOOP
    PERFORM public.sync_user_workspace_claims(membership_record.user_id);
  END LOOP;
END;
$$;
