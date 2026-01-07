-- Migration: Add ack_token to reminder_attempt_logs
-- YYYYMMDDHHMMSS_add_ack_token_to_attempt_logs.sql

alter table public.reminder_attempt_logs
add column if not exists ack_token text;

-- Create a unique index for ack_token where it's not null to ensure one token maps to one specific attempt
create unique index if not exists reminder_attempt_logs_ack_token_uq
on public.reminder_attempt_logs(ack_token)
where ack_token is not null;

-- Add comment for documentation
comment on column public.reminder_attempt_logs.ack_token is 'Unique token sent in the WhatsApp message to identify the specific job attempt for automated ACK.';
