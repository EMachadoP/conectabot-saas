-- Double AI token limits for all plans (prices unchanged)
UPDATE public.plans SET max_ai_tokens = 300000  WHERE name = 'start';
UPDATE public.plans SET max_ai_tokens = 1200000 WHERE name = 'pro';
UPDATE public.plans SET max_ai_tokens = 8000000 WHERE name = 'enterprise';
