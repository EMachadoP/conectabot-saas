DELETE FROM public.ai_provider_configs
WHERE provider = 'lovable';

ALTER TABLE public.ai_provider_configs
DROP CONSTRAINT IF EXISTS ai_provider_configs_provider_check;

ALTER TABLE public.ai_provider_configs
ADD CONSTRAINT ai_provider_configs_provider_check
CHECK (provider IN ('openai', 'gemini'));
