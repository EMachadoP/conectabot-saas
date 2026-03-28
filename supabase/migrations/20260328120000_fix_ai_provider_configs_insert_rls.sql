DROP POLICY IF EXISTS "Admins can manage ai_provider_configs" ON public.ai_provider_configs;

CREATE POLICY "Admins can manage ai_provider_configs"
ON public.ai_provider_configs
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));
