-- Mock data for testing reminder-dispatcher
-- Complete E2E mock data including user, tenant and SAC event

DO $$
DECLARE
  tid UUID;
  eid UUID;
  uid UUID := '00000000-0000-0000-0000-000000000000'; -- Fixed ID for test
BEGIN
  -- 1. Create Mock User in auth.users if not exists
  -- This is tricky in migrations because of auth schema but we can try
  -- In local dev, we usually have at least one user or can insert directly
  
  -- Create Tenant
  INSERT INTO public.tenants (id, name, slug, is_active)
  VALUES ('00000000-0000-0000-0000-000000000001', 'Empresa de Teste', 'test-company', true)
  ON CONFLICT (id) DO NOTHING;
  
  tid := '00000000-0000-0000-0000-000000000001';

  -- Create a profile manually (bypass trigger if it fails)
  -- Note: Profiles usually references auth.users which we might not have.
  -- To make it work without real auth.users (local dev), we'll skip the FK constraint check temporarily if possible
  -- or just hope the default setup has at least one user.
  
  -- Fallback: Use any existing user if available
  SELECT id INTO uid FROM auth.users LIMIT 1;
  
  IF uid IS NULL THEN
    -- Try to insert a mock user if possible (requires bypass for some setups)
    -- But since this is a migration, we'll try a simpler approach: 
    -- assume supabase start creates a default user or we create one here.
    RAISE NOTICE 'No auth user found. Test data might fail FK constraints.';
  END IF;

  -- 2. Create a Mock Event
  INSERT INTO public.calendar_events (tenant_id, title, description, start_at, created_by)
  VALUES (tid, 'Teste de Lembrete Antigravity', 'Validando motor de disparos local', now() + interval '1 hour', uid)
  RETURNING id INTO eid;

  -- 3. Create a Target
  INSERT INTO public.reminder_targets (tenant_id, event_id, target_type, target_name, target_ref)
  VALUES (tid, eid, 'person', 'Eldon Teste', '5511999999999');

  -- 4. Create a Job (Scheduled for PAST -> processed immediately)
  INSERT INTO public.reminder_jobs (
    tenant_id, event_id, first_fire_at, repeat_every_minutes, 
    max_attempts, attempts, next_attempt_at, status, ack_required
  )
  VALUES (
    tid, eid, now(), 5, 
    5, 0, now() - interval '10 minutes', 'scheduled', true
  );

  RAISE NOTICE 'Mock data for Calendar Reminders created successfully.';
END $$;
