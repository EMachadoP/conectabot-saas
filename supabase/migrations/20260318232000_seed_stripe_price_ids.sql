UPDATE public.plans
SET
  name = 'start',
  description = 'Plano inicial para operacao recorrente com WhatsApp e IA.',
  price_cents = 14700,
  billing_interval = 'month',
  max_messages = 1500,
  max_members = 3,
  ai_enabled = true,
  max_ai_tokens = 75000,
  stripe_price_id = 'price_1TCQxMCrE3GjmNRMHOUM5cgP',
  is_active = true
WHERE lower(name) = 'free';

UPDATE public.plans
SET
  name = 'pro',
  description = 'Plano para operacao em crescimento com equipe maior e mais volume.',
  price_cents = 29700,
  billing_interval = 'month',
  max_messages = 6000,
  max_members = 12,
  ai_enabled = true,
  max_ai_tokens = 300000,
  stripe_price_id = 'price_1TCQxoCrE3GjmNRMsWQN7nGu',
  is_active = true
WHERE lower(name) = 'pro';

UPDATE public.plans
SET
  name = 'enterprise',
  description = 'Plano corporativo para operacao intensiva e limites ampliados.',
  price_cents = 59700,
  billing_interval = 'month',
  max_messages = 50000,
  max_members = 100,
  ai_enabled = true,
  max_ai_tokens = 2000000,
  stripe_price_id = 'price_1TCQyHCrE3GjmNRMYtT6bD3S',
  is_active = true
WHERE lower(name) = 'enterprise';
