-- Verificação completa do usuário em auth.users
-- Execute no SQL Editor

-- 1. Verificar se usuário existe em auth.users
SELECT 
    id,
    email,
    encrypted_password IS NOT NULL as has_password,
    email_confirmed_at IS NOT NULL as email_confirmed,
    created_at,
    updated_at,
    last_sign_in_at,
    raw_user_meta_data,
    raw_app_meta_data
FROM auth.users
WHERE email = 'eldonmp2@gmail.com';

-- 2. Se não retornar nada, o usuário NÃO existe em auth.users
-- Isso explicaria o erro "Invalid login credentials"

-- 3. Contar total de usuários em auth.users
SELECT COUNT(*) as total_users FROM auth.users;

-- 4. Listar todos os usuários (para debug)
SELECT id, email, created_at 
FROM auth.users 
ORDER BY created_at DESC 
LIMIT 5;
