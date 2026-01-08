-- Verificação profunda do status do usuário
-- Execute no SQL Editor

-- 1. Verificar profiles
SELECT id, email, name, tenant_id, created_at
FROM public.profiles
WHERE email = 'eldonmp2@gmail.com';

-- 2. Verificar tenant_members (TODOS os registros deste usuário)
SELECT tm.tenant_id, tm.user_id, tm.role, tm.is_active, t.name as tenant_name
FROM public.tenant_members tm
LEFT JOIN public.tenants t ON t.id = tm.tenant_id
WHERE tm.user_id = (SELECT id FROM auth.users WHERE email = 'eldonmp2@gmail.com');

-- 3. Verificar tenants existentes
SELECT id, name, slug FROM public.tenants;

-- 4. Verificar se há disparidade no auth.users
SELECT id, email, raw_app_meta_data, raw_user_meta_data
FROM auth.users
WHERE email = 'eldonmp2@gmail.com';
