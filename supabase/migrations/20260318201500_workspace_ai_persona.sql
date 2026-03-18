ALTER TABLE public.ai_settings
  ADD COLUMN IF NOT EXISTS system_prompt text,
  ADD COLUMN IF NOT EXISTS model_name text,
  ADD COLUMN IF NOT EXISTS temperature numeric(3,2);

UPDATE public.ai_settings
SET
  workspace_id = COALESCE(workspace_id, tenant_id),
  system_prompt = COALESCE(NULLIF(system_prompt, ''), base_system_prompt),
  temperature = COALESCE(temperature, 0.7)
WHERE workspace_id IS NULL
   OR system_prompt IS NULL
   OR temperature IS NULL;

WITH template AS (
  SELECT
    enabled_global,
    timezone,
    base_system_prompt,
    COALESCE(NULLIF(system_prompt, ''), base_system_prompt) AS system_prompt,
    fallback_offhours_message,
    policies_json,
    memory_message_count,
    enable_auto_summary,
    anti_spam_seconds,
    max_messages_per_hour,
    human_request_pause_hours,
    schedule_json,
    model_name,
    COALESCE(temperature, 0.7) AS temperature
  FROM public.ai_settings
  ORDER BY created_at
  LIMIT 1
)
INSERT INTO public.ai_settings (
  tenant_id,
  workspace_id,
  enabled_global,
  timezone,
  base_system_prompt,
  system_prompt,
  fallback_offhours_message,
  policies_json,
  memory_message_count,
  enable_auto_summary,
  anti_spam_seconds,
  max_messages_per_hour,
  human_request_pause_hours,
  schedule_json,
  model_name,
  temperature
)
SELECT
  t.id,
  t.id,
  COALESCE(template.enabled_global, false),
  COALESCE(template.timezone, 'America/Fortaleza'),
  COALESCE(
    template.base_system_prompt,
    'Voce e um assistente virtual profissional, claro e prestativo.'
  ),
  COALESCE(
    template.system_prompt,
    template.base_system_prompt,
    'Voce e o assistente virtual da empresa {{company_name}}. Atenda com clareza, objetividade e empatia. O cliente atual chama-se {{contact_name}}.'
  ),
  COALESCE(
    template.fallback_offhours_message,
    'Recebemos sua mensagem e retornaremos no proximo horario util.'
  ),
  COALESCE(template.policies_json, '{}'::jsonb),
  COALESCE(template.memory_message_count, 12),
  COALESCE(template.enable_auto_summary, false),
  COALESCE(template.anti_spam_seconds, 5),
  COALESCE(template.max_messages_per_hour, 6),
  COALESCE(template.human_request_pause_hours, 2),
  template.schedule_json,
  template.model_name,
  COALESCE(template.temperature, 0.7)
FROM public.tenants t
CROSS JOIN template
WHERE NOT EXISTS (
  SELECT 1
  FROM public.ai_settings existing
  WHERE existing.workspace_id = t.id
);

DELETE FROM public.ai_settings
WHERE workspace_id IS NULL;

UPDATE public.ai_settings
SET
  tenant_id = workspace_id,
  base_system_prompt = COALESCE(NULLIF(base_system_prompt, ''), system_prompt),
  system_prompt = COALESCE(NULLIF(system_prompt, ''), base_system_prompt),
  temperature = COALESCE(temperature, 0.7)
WHERE tenant_id IS DISTINCT FROM workspace_id
   OR base_system_prompt IS NULL
   OR system_prompt IS NULL
   OR temperature IS NULL;

ALTER TABLE public.ai_settings
  ALTER COLUMN workspace_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ai_settings_workspace_id_key
  ON public.ai_settings (workspace_id);

DO $$
DECLARE
  policy_record record;
BEGIN
  FOR policy_record IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'ai_settings'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.ai_settings', policy_record.policyname);
  END LOOP;
END;
$$;

ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_settings_workspace_select
ON public.ai_settings
FOR SELECT
USING (public.can_manage_workspace_members(workspace_id));

CREATE POLICY ai_settings_workspace_insert
ON public.ai_settings
FOR INSERT
WITH CHECK (public.can_manage_workspace_members(workspace_id));

CREATE POLICY ai_settings_workspace_update
ON public.ai_settings
FOR UPDATE
USING (public.can_manage_workspace_members(workspace_id))
WITH CHECK (public.can_manage_workspace_members(workspace_id));

CREATE POLICY ai_settings_workspace_delete
ON public.ai_settings
FOR DELETE
USING (public.can_manage_workspace_members(workspace_id));
