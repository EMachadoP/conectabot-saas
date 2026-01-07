-- Standardize updated_at triggers for calendar and reminder tables
-- Uses the generic set_updated_at() function created in previous migrations

-- calendar_events
DROP TRIGGER IF EXISTS trg_calendar_events_updated_at ON public.calendar_events;
CREATE TRIGGER trg_calendar_events_updated_at
BEFORE UPDATE ON public.calendar_events
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- reminder_jobs
DROP TRIGGER IF EXISTS trg_reminder_jobs_updated_at ON public.reminder_jobs;
CREATE TRIGGER trg_reminder_jobs_updated_at
BEFORE UPDATE ON public.reminder_jobs
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Comments
COMMENT ON TRIGGER trg_calendar_events_updated_at ON public.calendar_events IS 'Auto-updates updated_at timestamp using generic function';
COMMENT ON TRIGGER trg_reminder_jobs_updated_at ON public.reminder_jobs IS 'Auto-updates updated_at timestamp using generic function';
