ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS reply_to_message_id uuid REFERENCES public.messages(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS reply_to_provider_message_id text,
ADD COLUMN IF NOT EXISTS reply_preview text,
ADD COLUMN IF NOT EXISTS reply_sender_name text;

CREATE INDEX IF NOT EXISTS idx_messages_reply_to_message_id
ON public.messages(reply_to_message_id)
WHERE reply_to_message_id IS NOT NULL;
