-- Mock data for testing reminder-dispatcher
DO $$
DECLARE
  tid UUID;
  eid UUID;
  jid UUID;
  uid UUID;
BEGIN
  -- 1. Get current tenant and user
  SELECT id INTO tid FROM public.tenants WHERE slug = 'default' LIMIT 1;
  SELECT id INTO uid FROM public.profiles LIMIT 1;

  IF tid IS NULL THEN
    RAISE EXCEPTION 'Tenant default not found';
  END IF;

  -- 2. Create a Mock Event
  INSERT INTO public.calendar_events (tenant_id, title, description, start_at, created_by)
  VALUES (tid, 'Teste E2E Lembretes', 'Evento de teste para o motor de disparos Antigravity', now() + interval '1 hour', uid)
  RETURNING id INTO eid;

  -- 3. Create a Target
  INSERT INTO public.reminder_targets (tenant_id, event_id, target_type, target_name, target_ref)
  VALUES (tid, eid, 'person', 'Eldon Teste', '5511999999999');

  -- 4. Create a Job (Scheduled for NOW - processed immediately)
  INSERT INTO public.reminder_jobs (
    tenant_id, event_id, first_fire_at, repeat_every_minutes, 
    max_attempts, attempts, next_attempt_at, status, ack_required
  )
  VALUES (
    tid, eid, now(), 10, 
    3, 0, now() - interval '1 minute', 'scheduled', true
  )
  RETURNING id INTO jid;

  RAISE NOTICE 'Mock data created successfully. Event: %, Job: %', eid, jid;
END $$;
