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
  v_invited_workspace_id uuid;
  v_invited_role text;
BEGIN
  v_name := COALESCE(
    NEW.raw_user_meta_data ->> 'name',
    NEW.raw_user_meta_data ->> 'full_name',
    split_part(NEW.email, '@', 1)
  );

  BEGIN
    v_invited_workspace_id := NULLIF(NEW.raw_user_meta_data ->> 'workspace_id', '')::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      v_invited_workspace_id := NULL;
  END;

  v_invited_role := COALESCE(NULLIF(NEW.raw_user_meta_data ->> 'workspace_role', ''), 'agent');
  IF v_invited_role NOT IN ('owner', 'admin', 'agent') THEN
    v_invited_role := 'agent';
  END IF;

  IF v_invited_workspace_id IS NOT NULL THEN
    INSERT INTO public.profiles (id, email, name, tenant_id, workspace_id)
    VALUES (NEW.id, NEW.email, v_name, v_invited_workspace_id, v_invited_workspace_id)
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      name = EXCLUDED.name,
      tenant_id = EXCLUDED.tenant_id,
      workspace_id = EXCLUDED.workspace_id;

    INSERT INTO public.tenant_members (tenant_id, user_id, role, is_active)
    VALUES (v_invited_workspace_id, NEW.id, v_invited_role, true)
    ON CONFLICT (tenant_id, user_id) DO UPDATE SET
      role = EXCLUDED.role,
      is_active = true,
      updated_at = now();

    PERFORM public.sync_user_workspace_claims(NEW.id);
    RETURN NEW;
  END IF;

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
