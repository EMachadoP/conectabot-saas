CREATE TABLE IF NOT EXISTS public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  price_cents integer NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  billing_interval text NOT NULL DEFAULT 'month' CHECK (billing_interval IN ('month', 'year')),
  max_messages integer,
  max_members integer,
  ai_enabled boolean NOT NULL DEFAULT true,
  max_ai_tokens integer,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_id uuid NOT NULL REFERENCES public.plans(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'unpaid')),
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id)
);

CREATE TABLE IF NOT EXISTS public.usage_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  metric_name text NOT NULL,
  quantity bigint NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  period_month integer NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year integer NOT NULL CHECK (period_year >= 2020),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, metric_name, period_month, period_year)
);

CREATE INDEX IF NOT EXISTS usage_records_workspace_metric_period_idx
  ON public.usage_records (workspace_id, metric_name, period_month, period_year);

CREATE TRIGGER update_plans_updated_at
  BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_usage_records_updated_at
  BEFORE UPDATE ON public.usage_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.plans (name, description, price_cents, billing_interval, max_messages, max_members, ai_enabled, max_ai_tokens)
VALUES
  ('free', 'Plano inicial para operacao basica.', 0, 'month', 500, 2, true, 25000),
  ('pro', 'Plano para operacao recorrente com IA e equipe maior.', 19900, 'month', 5000, 10, true, 250000),
  ('enterprise', 'Plano com limites amplos para operacao intensiva.', 49900, 'month', 50000, 100, true, 2000000)
ON CONFLICT (name) DO UPDATE
SET
  description = excluded.description,
  price_cents = excluded.price_cents,
  billing_interval = excluded.billing_interval,
  max_messages = excluded.max_messages,
  max_members = excluded.max_members,
  ai_enabled = excluded.ai_enabled,
  max_ai_tokens = excluded.max_ai_tokens,
  is_active = true;

INSERT INTO public.subscriptions (workspace_id, plan_id, status, current_period_end)
SELECT
  t.id,
  p.id,
  'active',
  now() + interval '10 years'
FROM public.tenants t
CROSS JOIN LATERAL (
  SELECT id
  FROM public.plans
  WHERE name = 'free'
  LIMIT 1
) AS p
WHERE NOT EXISTS (
  SELECT 1
  FROM public.subscriptions s
  WHERE s.workspace_id = t.id
);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS plans_select_all ON public.plans;
DROP POLICY IF EXISTS subscriptions_workspace_select ON public.subscriptions;
DROP POLICY IF EXISTS usage_records_workspace_select ON public.usage_records;

CREATE POLICY plans_select_all
ON public.plans
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY subscriptions_workspace_select
ON public.subscriptions
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.tenant_members tm
    WHERE tm.tenant_id = subscriptions.workspace_id
      AND tm.user_id = auth.uid()
      AND tm.is_active = true
  )
);

CREATE POLICY usage_records_workspace_select
ON public.usage_records
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.tenant_members tm
    WHERE tm.tenant_id = usage_records.workspace_id
      AND tm.user_id = auth.uid()
      AND tm.is_active = true
  )
);

CREATE OR REPLACE FUNCTION public.can_perform_action(
  p_workspace_id uuid,
  p_action_type text,
  p_quantity bigint DEFAULT 1
)
RETURNS TABLE (
  allowed boolean,
  reason text,
  plan_name text,
  subscription_status text,
  current_usage bigint,
  usage_limit bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subscription record;
  v_metric_name text;
  v_limit bigint;
  v_usage bigint;
BEGIN
  SELECT
    s.status,
    s.current_period_end,
    p.name AS plan_name,
    p.max_messages,
    p.max_members,
    p.ai_enabled,
    p.max_ai_tokens
  INTO v_subscription
  FROM public.subscriptions s
  JOIN public.plans p ON p.id = s.plan_id
  WHERE s.workspace_id = p_workspace_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'workspace_without_subscription', 'none', 'missing', 0::bigint, 0::bigint;
    RETURN;
  END IF;

  IF v_subscription.status NOT IN ('active', 'trialing') THEN
    RETURN QUERY SELECT false, 'subscription_inactive', v_subscription.plan_name, v_subscription.status, 0::bigint, 0::bigint;
    RETURN;
  END IF;

  CASE p_action_type
    WHEN 'outbound_message' THEN
      v_metric_name := 'messages_sent';
      v_limit := coalesce(v_subscription.max_messages, 9223372036854775807);
    WHEN 'ai_reply' THEN
      IF NOT coalesce(v_subscription.ai_enabled, false) THEN
        RETURN QUERY SELECT false, 'ai_disabled_on_plan', v_subscription.plan_name, v_subscription.status, 0::bigint, 0::bigint;
        RETURN;
      END IF;
      v_metric_name := 'ai_tokens';
      v_limit := coalesce(v_subscription.max_ai_tokens, 9223372036854775807);
    WHEN 'ai_tokens' THEN
      IF NOT coalesce(v_subscription.ai_enabled, false) THEN
        RETURN QUERY SELECT false, 'ai_disabled_on_plan', v_subscription.plan_name, v_subscription.status, 0::bigint, 0::bigint;
        RETURN;
      END IF;
      v_metric_name := 'ai_tokens';
      v_limit := coalesce(v_subscription.max_ai_tokens, 9223372036854775807);
    ELSE
      RETURN QUERY SELECT true, 'unmetered_action', v_subscription.plan_name, v_subscription.status, 0::bigint, 0::bigint;
      RETURN;
  END CASE;

  SELECT coalesce(quantity, 0)
  INTO v_usage
  FROM public.usage_records
  WHERE workspace_id = p_workspace_id
    AND metric_name = v_metric_name
    AND period_month = extract(month from now())::int
    AND period_year = extract(year from now())::int;

  v_usage := coalesce(v_usage, 0);

  IF v_usage + coalesce(p_quantity, 1) > v_limit THEN
    RETURN QUERY SELECT false, 'plan_limit_reached', v_subscription.plan_name, v_subscription.status, v_usage, v_limit;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, 'ok', v_subscription.plan_name, v_subscription.status, v_usage, v_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_usage(
  p_workspace_id uuid,
  p_metric_name text,
  p_quantity bigint DEFAULT 1,
  p_period_month integer DEFAULT extract(month from now())::int,
  p_period_year integer DEFAULT extract(year from now())::int
)
RETURNS public.usage_records
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record public.usage_records;
BEGIN
  INSERT INTO public.usage_records (
    workspace_id,
    metric_name,
    quantity,
    period_month,
    period_year
  )
  VALUES (
    p_workspace_id,
    p_metric_name,
    greatest(coalesce(p_quantity, 0), 0),
    p_period_month,
    p_period_year
  )
  ON CONFLICT (workspace_id, metric_name, period_month, period_year)
  DO UPDATE SET
    quantity = public.usage_records.quantity + excluded.quantity,
    updated_at = now()
  RETURNING * INTO v_record;

  RETURN v_record;
END;
$$;

GRANT EXECUTE ON FUNCTION public.can_perform_action(uuid, text, bigint) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_usage(uuid, text, bigint, integer, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.provision_workspace_subscription()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_free_plan_id uuid;
BEGIN
  SELECT id
  INTO v_free_plan_id
  FROM public.plans
  WHERE name = 'free'
  LIMIT 1;

  IF v_free_plan_id IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.subscriptions (workspace_id, plan_id, status, current_period_end)
  VALUES (NEW.id, v_free_plan_id, 'active', now() + interval '10 years')
  ON CONFLICT (workspace_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS provision_workspace_subscription ON public.tenants;
CREATE TRIGGER provision_workspace_subscription
  AFTER INSERT ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.provision_workspace_subscription();
