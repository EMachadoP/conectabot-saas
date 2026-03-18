-- Phase 1.8: expand workspace_id to secondary tables and make authenticated
-- client inserts default to the current workspace.

DO $$
DECLARE
  v_table_name text;
  dual_id_tables text[] := ARRAY[
    'agents',
    'ai_settings',
    'ai_team_settings',
    'calendar_events',
    'condominiums',
    'contacts',
    'conversations',
    'integrations_settings',
    'kb_snippets',
    'labels',
    'messages',
    'profiles',
    'protocols',
    'reminder_attempt_logs',
    'reminder_jobs',
    'reminder_targets',
    'sac_counters',
    'sac_tickets',
    'teams',
    'tenant_integrations',
    'zapi_settings'
  ];
BEGIN
  FOREACH v_table_name IN ARRAY dual_id_tables
  LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND information_schema.tables.table_name = v_table_name
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE',
        v_table_name
      );

      IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND information_schema.columns.table_name = v_table_name
          AND column_name = 'tenant_id'
      ) THEN
        EXECUTE format(
          'UPDATE public.%I SET workspace_id = tenant_id WHERE workspace_id IS NULL AND tenant_id IS NOT NULL',
          v_table_name
        );

        EXECUTE format(
          'ALTER TABLE public.%I ALTER COLUMN tenant_id SET DEFAULT public.current_workspace_id()',
          v_table_name
        );
      END IF;

      EXECUTE format(
        'ALTER TABLE public.%I ALTER COLUMN workspace_id SET DEFAULT public.current_workspace_id()',
        v_table_name
      );

      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON public.%I(workspace_id)',
        'idx_' || v_table_name || '_workspace_id',
        v_table_name
      );

      EXECUTE format(
        'DROP TRIGGER IF EXISTS %I ON public.%I',
        v_table_name || '_sync_workspace_tenant',
        v_table_name
      );

      EXECUTE format(
        'CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.sync_workspace_and_tenant_id()',
        v_table_name || '_sync_workspace_tenant',
        v_table_name
      );
    END IF;
  END LOOP;
END;
$$;

UPDATE public.participants p
SET workspace_id = c.workspace_id
FROM public.contacts c
WHERE p.contact_id = c.id
  AND p.workspace_id IS NULL;

ALTER TABLE public.participants
ALTER COLUMN workspace_id SET DEFAULT public.current_workspace_id();

CREATE INDEX IF NOT EXISTS idx_participants_workspace_id
ON public.participants(workspace_id);

CREATE UNIQUE INDEX IF NOT EXISTS tenant_integrations_workspace_provider_key
ON public.tenant_integrations(workspace_id, provider);

COMMENT ON INDEX public.tenant_integrations_workspace_provider_key IS
'Allows upsert of tenant_integrations by workspace_id + provider during the multi-tenant transition.';
