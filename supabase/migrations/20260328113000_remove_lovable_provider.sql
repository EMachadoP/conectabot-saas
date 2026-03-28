-- Remove legacy Lovable provider defaults and switch active provider to Gemini.

UPDATE public.ai_provider_configs
SET active = false
WHERE provider = 'lovable';

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
  WHERE provider = 'gemini'
);

UPDATE public.ai_provider_configs
SET
  active = CASE
    WHEN id = (
      SELECT id
      FROM public.ai_provider_configs
      WHERE provider = 'gemini'
      ORDER BY active DESC, created_at ASC
      LIMIT 1
    ) THEN true
    ELSE false
  END,
  key_ref = CASE
    WHEN provider = 'gemini' AND (key_ref IS NULL OR key_ref = '') THEN 'GEMINI_API_KEY'
    ELSE key_ref
  END
WHERE provider IN ('gemini', 'lovable');

DELETE FROM public.ai_provider_configs
WHERE provider = 'lovable';
