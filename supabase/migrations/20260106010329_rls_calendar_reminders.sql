-- dedicated migration for Calendar and Reminders RLS
-- Consolidates security policies using the current_tenant_id() pattern

-- calendar_events
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_select_calendar_events" ON public.calendar_events;
DROP POLICY IF EXISTS "tenant_insert_calendar_events" ON public.calendar_events;
DROP POLICY IF EXISTS "tenant_update_calendar_events" ON public.calendar_events;
DROP POLICY IF EXISTS "tenant_delete_calendar_events" ON public.calendar_events;

CREATE POLICY "tenant_select_calendar_events" ON public.calendar_events 
FOR SELECT USING (tenant_id = public.current_tenant_id());

CREATE POLICY "tenant_insert_calendar_events" ON public.calendar_events 
FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "tenant_update_calendar_events" ON public.calendar_events 
FOR UPDATE USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "tenant_delete_calendar_events" ON public.calendar_events 
FOR DELETE USING (tenant_id = public.current_tenant_id());


-- reminder_targets
ALTER TABLE public.reminder_targets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_select_reminder_targets" ON public.reminder_targets;
DROP POLICY IF EXISTS "tenant_insert_reminder_targets" ON public.reminder_targets;
DROP POLICY IF EXISTS "tenant_update_reminder_targets" ON public.reminder_targets;
DROP POLICY IF EXISTS "tenant_delete_reminder_targets" ON public.reminder_targets;

CREATE POLICY "tenant_select_reminder_targets" ON public.reminder_targets 
FOR SELECT USING (tenant_id = public.current_tenant_id());

CREATE POLICY "tenant_insert_reminder_targets" ON public.reminder_targets 
FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "tenant_update_reminder_targets" ON public.reminder_targets 
FOR UPDATE USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "tenant_delete_reminder_targets" ON public.reminder_targets 
FOR DELETE USING (tenant_id = public.current_tenant_id());


-- reminder_jobs
ALTER TABLE public.reminder_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_select_reminder_jobs" ON public.reminder_jobs;
DROP POLICY IF EXISTS "tenant_insert_reminder_jobs" ON public.reminder_jobs;
DROP POLICY IF EXISTS "tenant_update_reminder_jobs" ON public.reminder_jobs;
DROP POLICY IF EXISTS "tenant_delete_reminder_jobs" ON public.reminder_jobs;

CREATE POLICY "tenant_select_reminder_jobs" ON public.reminder_jobs 
FOR SELECT USING (tenant_id = public.current_tenant_id());

CREATE POLICY "tenant_insert_reminder_jobs" ON public.reminder_jobs 
FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "tenant_update_reminder_jobs" ON public.reminder_jobs 
FOR UPDATE USING (tenant_id = public.current_tenant_id()) WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "tenant_delete_reminder_jobs" ON public.reminder_jobs 
FOR DELETE USING (tenant_id = public.current_tenant_id());


-- reminder_attempt_logs
ALTER TABLE public.reminder_attempt_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_select_reminder_attempt_logs" ON public.reminder_attempt_logs;
DROP POLICY IF EXISTS "tenant_insert_reminder_attempt_logs" ON public.reminder_attempt_logs;
DROP POLICY IF EXISTS "tenant_delete_reminder_attempt_logs" ON public.reminder_attempt_logs;

CREATE POLICY "tenant_select_reminder_attempt_logs" ON public.reminder_attempt_logs 
FOR SELECT USING (tenant_id = public.current_tenant_id());

CREATE POLICY "tenant_insert_reminder_attempt_logs" ON public.reminder_attempt_logs 
FOR INSERT WITH CHECK (tenant_id = public.current_tenant_id());

CREATE POLICY "tenant_delete_reminder_attempt_logs" ON public.reminder_attempt_logs 
FOR DELETE USING (tenant_id = public.current_tenant_id());

-- Comments
COMMENT ON POLICY "tenant_select_calendar_events" ON public.calendar_events IS 'Users can only view events from their active tenant';
COMMENT ON POLICY "tenant_select_reminder_targets" ON public.reminder_targets IS 'Users can only view reminder targets from their active tenant';
COMMENT ON POLICY "tenant_select_reminder_jobs" ON public.reminder_jobs IS 'Users can only view reminder jobs from their active tenant';
COMMENT ON POLICY "tenant_select_reminder_attempt_logs" ON public.reminder_attempt_logs IS 'Users can only view attempt logs from their active tenant';
