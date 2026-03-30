DROP POLICY IF EXISTS "Admins can manage entities" ON public.entities;
DROP POLICY IF EXISTS "Agents can create entities" ON public.entities;
DROP POLICY IF EXISTS "Agents can update entities" ON public.entities;

CREATE POLICY "Authenticated can insert entities"
ON public.entities
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can update entities"
ON public.entities
FOR UPDATE
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated can delete entities"
ON public.entities
FOR DELETE
USING (auth.uid() IS NOT NULL);

INSERT INTO public.ai_provider_configs (
  provider,
  model,
  temperature,
  max_tokens,
  top_p,
  active,
  key_ref
)
SELECT
  'gemini',
  'gemini-2.5-flash',
  0.7,
  1024,
  1.0,
  true,
  'GEMINI_API_KEY'
WHERE NOT EXISTS (
  SELECT 1
  FROM public.ai_provider_configs
  WHERE provider IN ('openai', 'gemini')
);
