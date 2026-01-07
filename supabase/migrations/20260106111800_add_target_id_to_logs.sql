-- Add target_id to reminder_attempt_logs for detailed auditing per target
ALTER TABLE public.reminder_attempt_logs
ADD COLUMN IF NOT EXISTS target_id uuid references public.reminder_targets(id) on delete set null;

COMMENT ON COLUMN public.reminder_attempt_logs.target_id IS 'Specific target recipient for this attempt log';
