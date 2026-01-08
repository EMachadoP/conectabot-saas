-- Verificar usuários no projeto atual
-- Execute este script no SQL Editor

-- 1. Listar TODOS os usuários (para ver se há algum)
SELECT 
    id,
    email,
    created_at,
    email_confirmed_at,
    last_sign_in_at
FROM auth.users
ORDER BY created_at DESC
LIMIT 10;

-- 2. Buscar especificamente pelo email
SELECT 
    id,
    email,
    created_at,
    email_confirmed_at,
    raw_user_meta_data,
    raw_app_meta_data
FROM auth.users
WHERE email = 'eldonmp2@gmail.com';

-- 3. Verificar se profile existe
SELECT 
    p.id,
    p.email,
    p.name,
    p.tenant_id,
    p.created_at
FROM public.profiles p
WHERE p.email = 'eldonmp2@gmail.com';

-- 4. Verificar tenant_members
SELECT 
    tm.tenant_id,
    tm.user_id,
    tm.role,
    tm.is_active
FROM public.tenant_members tm
JOIN auth.users u ON u.id = tm.user_id
WHERE u.email = 'eldonmp2@gmail.com';
