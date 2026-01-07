-- Migration: Enrich reminder_attempt_logs with backoff metadata
-- 20260106131500_enrich_reminder_logs.sql

ALTER TABLE public.reminder_attempt_logs
ADD COLUMN IF NOT EXISTS provider_message_id text,
ADD COLUMN IF NOT EXISTS http_status int,
ADD COLUMN IF NOT EXISTS retryable boolean default true,
ADD COLUMN IF NOT EXISTS next_retry_at timestamptz;

-- Update status options in comment
COMMENT ON COLUMN public.reminder_attempt_logs.result IS 'Outcome: success | failed | retry_scheduled | dlq';
COMMENT ON COLUMN public.reminder_attempt_logs.provider_message_id IS 'External ID returned by the messaging provider (e.g. Evolution API)';
COMMENT ON COLUMN public.reminder_attempt_logs.http_status IS 'HTTP response code from the provider API';
COMMENT ON COLUMN public.reminder_attempt_logs.retryable IS 'Indicates if the error allows for a subsequent retry';
COMMENT ON COLUMN public.reminder_attempt_logs.next_retry_at IS 'The scheduled time for the next retry attempt if retry_scheduled';
