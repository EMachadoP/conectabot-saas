CREATE OR REPLACE FUNCTION public.is_platform_admin(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = p_user_id
      AND ur.role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.platform_list_workspaces()
RETURNS TABLE (
  workspace_id uuid,
  workspace_name text,
  workspace_slug text,
  owner_name text,
  owner_email text,
  members_count bigint,
  active_members_count bigint,
  subscription_status text,
  plan_name text,
  current_period_end timestamptz,
  messages_sent bigint,
  ai_replies bigint,
  ai_tokens bigint,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.id AS workspace_id,
    t.name AS workspace_name,
    t.slug AS workspace_slug,
    owner_profile.name AS owner_name,
    owner_profile.email AS owner_email,
    COALESCE(member_counts.total_members, 0) AS members_count,
    COALESCE(member_counts.active_members, 0) AS active_members_count,
    s.status AS subscription_status,
    p.name AS plan_name,
    s.current_period_end,
    COALESCE(usage.messages_sent, 0) AS messages_sent,
    COALESCE(usage.ai_replies, 0) AS ai_replies,
    COALESCE(usage.ai_tokens, 0) AS ai_tokens,
    t.created_at
  FROM public.tenants t
  LEFT JOIN LATERAL (
    SELECT
      count(*) AS total_members,
      count(*) FILTER (WHERE tm.is_active = true) AS active_members
    FROM public.tenant_members tm
    WHERE tm.tenant_id = t.id
  ) AS member_counts ON true
  LEFT JOIN LATERAL (
    SELECT
      pr.name,
      pr.email
    FROM public.tenant_members tm
    JOIN public.profiles pr ON pr.id = tm.user_id
    WHERE tm.tenant_id = t.id
      AND tm.is_active = true
      AND COALESCE(tm.role, 'agent') IN ('owner', 'admin')
    ORDER BY
      CASE COALESCE(tm.role, 'agent')
        WHEN 'owner' THEN 0
        WHEN 'admin' THEN 1
        ELSE 2
      END,
      pr.created_at
    LIMIT 1
  ) AS owner_profile ON true
  LEFT JOIN public.subscriptions s
    ON s.workspace_id = t.id
  LEFT JOIN public.plans p
    ON p.id = s.plan_id
  LEFT JOIN LATERAL (
    SELECT
      sum(CASE WHEN ur.metric_name = 'messages_sent' THEN ur.quantity ELSE 0 END) AS messages_sent,
      sum(CASE WHEN ur.metric_name = 'ai_replies' THEN ur.quantity ELSE 0 END) AS ai_replies,
      sum(CASE WHEN ur.metric_name = 'ai_tokens' THEN ur.quantity ELSE 0 END) AS ai_tokens
    FROM public.usage_records ur
    WHERE ur.workspace_id = t.id
      AND ur.period_month = EXTRACT(MONTH FROM now())::integer
      AND ur.period_year = EXTRACT(YEAR FROM now())::integer
  ) AS usage ON true
  WHERE public.is_platform_admin(auth.uid())
  ORDER BY t.created_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.platform_reset_workspace_integrations(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  DELETE FROM public.zapi_settings
  WHERE workspace_id = p_workspace_id
     OR tenant_id = p_workspace_id
     OR team_id = p_workspace_id;

  DELETE FROM public.tenant_integrations
  WHERE workspace_id = p_workspace_id
     OR tenant_id = p_workspace_id;

  DELETE FROM public.wa_instances
  WHERE team_id = p_workspace_id;

  UPDATE public.integrations_settings
  SET
    whatsapp_group_id = null,
    whatsapp_notifications_enabled = false,
    evolution_instance = null,
    evolution_apikey = null,
    updated_at = now()
  WHERE workspace_id = p_workspace_id
     OR tenant_id = p_workspace_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_create_demo_workspace(p_name text)
RETURNS public.tenants
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace public.tenants%ROWTYPE;
  v_base_slug text;
  v_slug text;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'Nome do workspace demo é obrigatório';
  END IF;

  v_base_slug := lower(regexp_replace(btrim(p_name), '[^a-zA-Z0-9]+', '-', 'g'));
  v_base_slug := trim(both '-' FROM v_base_slug);

  IF v_base_slug = '' THEN
    v_base_slug := 'workspace-demo';
  END IF;

  v_slug := v_base_slug;

  WHILE EXISTS (SELECT 1 FROM public.tenants WHERE slug = v_slug) LOOP
    v_slug := v_base_slug || '-' || substr(gen_random_uuid()::text, 1, 8);
  END LOOP;

  INSERT INTO public.tenants (name, slug, settings, is_active)
  VALUES (
    btrim(p_name),
    v_slug,
    jsonb_build_object('mode', 'demo', 'created_by', auth.uid()),
    true
  )
  RETURNING * INTO v_workspace;

  INSERT INTO public.tenant_members (tenant_id, user_id, role, is_active)
  VALUES (v_workspace.id, auth.uid(), 'owner', true)
  ON CONFLICT (tenant_id, user_id) DO UPDATE
    SET role = EXCLUDED.role,
        is_active = true,
        updated_at = now();

  PERFORM public.sync_user_workspace_claims(auth.uid());

  RETURN v_workspace;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_platform_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_list_workspaces() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_reset_workspace_integrations(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_create_demo_workspace(text) TO authenticated, service_role;
