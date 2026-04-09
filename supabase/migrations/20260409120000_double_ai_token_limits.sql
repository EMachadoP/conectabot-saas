-- Double AI token limits for all plans
UPDATE public.plans SET max_ai_tokens = 150000  WHERE name = 'start';
UPDATE public.plans SET max_ai_tokens = 600000  WHERE name = 'pro';
UPDATE public.plans SET max_ai_tokens = 4000000 WHERE name = 'enterprise';
