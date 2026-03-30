DROP POLICY IF EXISTS "Admins can manage ai_provider_configs" ON public.ai_provider_configs;
DROP POLICY IF EXISTS "Admins can view ai_provider_configs" ON public.ai_provider_configs;

CREATE POLICY "Authenticated can manage ai_provider_configs"
ON public.ai_provider_configs
FOR ALL
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can view ai_provider_configs"
ON public.ai_provider_configs
FOR SELECT
USING (auth.uid() IS NOT NULL);
