-- Add recipient-level state tracking to reminder_recipients
-- This enables per-recipient retry/idempotency and proper queue management

-- Add state tracking columns
ALTER TABLE public.reminder_recipients 
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending' 
    CHECK (status IN ('pending', 'queued', 'sent', 'retry_scheduled', 'failed', 'dlq'));

ALTER TABLE public.reminder_recipients 
  ADD COLUMN IF NOT EXISTS attempt_count int DEFAULT 0;

ALTER TABLE public.reminder_recipients 
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz;

ALTER TABLE public.reminder_recipients 
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz;

ALTER TABLE public.reminder_recipients 
  ADD COLUMN IF NOT EXISTS last_error text;

ALTER TABLE public.reminder_recipients 
  ADD COLUMN IF NOT EXISTS last_enqueued_at timestamptz;

ALTER TABLE public.reminder_recipients 
  ADD COLUMN IF NOT EXISTS last_sent_at timestamptz;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_reminder_recipients_status_due 
ON public.reminder_recipients(team_id, status, next_attempt_at) 
WHERE status IN ('pending', 'retry_scheduled');

CREATE INDEX IF NOT EXISTS idx_reminder_recipients_reminder 
ON public.reminder_recipients(reminder_id);

CREATE INDEX IF NOT EXISTS idx_reminder_recipients_enqueued 
ON public.reminder_recipients(team_id, last_enqueued_at);

-- Comments
COMMENT ON COLUMN public.reminder_recipients.status IS 'Recipient delivery status: pending, queued, sent, retry_scheduled, failed, dlq';
COMMENT ON COLUMN public.reminder_recipients.attempt_count IS 'Number of delivery attempts for this recipient';
COMMENT ON COLUMN public.reminder_recipients.last_attempt_at IS 'Timestamp of last delivery attempt';
COMMENT ON COLUMN public.reminder_recipients.next_attempt_at IS 'Timestamp when next retry should be attempted';
COMMENT ON COLUMN public.reminder_recipients.last_error IS 'Last error message from delivery attempt';
COMMENT ON COLUMN public.reminder_recipients.last_enqueued_at IS 'Timestamp when last enqueued to Redis';
COMMENT ON COLUMN public.reminder_recipients.last_sent_at IS 'Timestamp when successfully sent';
