-- Update reminder_targets to use JID instead of target_ref
-- JID is the WhatsApp identifier format used by Evolution API

-- Rename column for clarity
ALTER TABLE public.reminder_targets 
  RENAME COLUMN target_ref TO jid;

-- Update comment to reflect new naming
COMMENT ON COLUMN public.reminder_targets.jid IS 'WhatsApp JID identifier (e.g., 5511999999999@s.whatsapp.net for person or groupid@g.us for group)';
