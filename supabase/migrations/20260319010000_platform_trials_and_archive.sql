CREATE OR REPLACE FUNCTION public.platform_start_workspace_trial(
  p_workspace_id uuid,
  p_days integer DEFAULT 5,
  p_plan_name text DEFAULT 'start'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id uuid;
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF p_days IS NULL OR p_days < 1 THEN
    RAISE EXCEPTION 'A quantidade de dias deve ser maior que zero';
  END IF;

  SELECT id
  INTO v_plan_id
  FROM public.plans
  WHERE lower(name) = lower(p_plan_name)
    AND is_active = true
  LIMIT 1;

  IF v_plan_id IS NULL THEN
    RAISE EXCEPTION 'Plano "%" não encontrado', p_plan_name;
  END IF;

  INSERT INTO public.subscriptions (
    workspace_id,
    plan_id,
    status,
    current_period_end
  )
  VALUES (
    p_workspace_id,
    v_plan_id,
    'trialing',
    now() + make_interval(days => p_days)
  )
  ON CONFLICT (workspace_id) DO UPDATE
    SET plan_id = EXCLUDED.plan_id,
        status = 'trialing',
        current_period_end = EXCLUDED.current_period_end,
        updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.platform_archive_workspace(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  UPDATE public.tenants
  SET is_active = false,
      updated_at = now()
  WHERE id = p_workspace_id;

  UPDATE public.tenant_members
  SET is_active = false,
      updated_at = now()
  WHERE tenant_id = p_workspace_id;
END;
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
    AND COALESCE(t.is_active, true) = true
  ORDER BY t.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.platform_start_workspace_trial(uuid, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.platform_archive_workspace(uuid) TO authenticated, service_role;
