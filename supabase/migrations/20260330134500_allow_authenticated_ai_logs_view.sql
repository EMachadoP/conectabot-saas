DROP POLICY IF EXISTS "Authenticated can view ai_logs" ON public.ai_logs;

CREATE POLICY "Authenticated can view ai_logs"
ON public.ai_logs
FOR SELECT
USING (auth.uid() IS NOT NULL);
