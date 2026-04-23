-- Migration: Schedule AI auto-reactivate via pg_cron
-- Purpose: After 30 minutes of inactivity, automatically return conversations to AI AUTO mode.
-- The Edge Function ai-auto-reactivate exists but was never scheduled — this migration fixes that.

-- 1. Create SQL function that performs the reactivation directly in the DB (no HTTP needed)
CREATE OR REPLACE FUNCTION public.ai_auto_reactivate_conversations()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv RECORD;
  v_threshold TIMESTAMP WITH TIME ZONE;
  v_count INT := 0;
BEGIN
  v_threshold := NOW() - INTERVAL '30 minutes';

  FOR v_conv IN
    SELECT id, ai_mode, human_control, last_message_at
    FROM public.conversations
    WHERE status = 'open'
      AND (ai_mode != 'AUTO' OR human_control = true)
      AND (last_message_at IS NULL OR last_message_at < v_threshold)
  LOOP
    UPDATE public.conversations
    SET
      ai_mode        = 'AUTO',
      human_control  = false,
      ai_paused_until = NULL
    WHERE id = v_conv.id;

    INSERT INTO public.ai_events (
      conversation_id,
      event_type,
      message,
      metadata
    ) VALUES (
      v_conv.id,
      'ai_auto_reactivated',
      '🤖 IA reativada automaticamente após 30 minutos de inatividade.',
      jsonb_build_object(
        'reason',                 'inactivity_timeout',
        'previous_mode',          v_conv.ai_mode,
        'previous_human_control', v_conv.human_control,
        'last_message_at',        v_conv.last_message_at
      )
    );

    v_count := v_count + 1;
  END LOOP;

  IF v_count > 0 THEN
    RAISE LOG '[ai_auto_reactivate] Reactivated % conversation(s)', v_count;
  END IF;
END;
$$;

-- 2. Remove existing job if it was previously created (idempotent)
SELECT cron.unschedule('ai-auto-reactivate-job')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'ai-auto-reactivate-job'
);

-- 3. Schedule the job to run every 5 minutes
SELECT cron.schedule(
  'ai-auto-reactivate-job',
  '*/5 * * * *',
  'SELECT public.ai_auto_reactivate_conversations();'
);
