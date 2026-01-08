-- Corrigir metadados do usuário para permitir login
-- Execute no SQL Editor

UPDATE auth.users
SET 
    raw_app_meta_data = '{"provider":"email","providers":["email"]}'::jsonb,
    raw_user_meta_data = '{"name":"Eldon Machado"}'::jsonb,
    created_at = COALESCE(created_at, NOW()),
    confirmation_token = '',
    email_change = '',
    email_change_token_new = '',
    recovery_token = ''
WHERE email = 'eldonmp2@gmail.com';

-- Verificar se foi atualizado
SELECT 
    id,
    email,
    has_password,
    email_confirmed,
    created_at,
    raw_user_meta_data,
    raw_app_meta_data
FROM (
    SELECT 
        id,
        email,
        encrypted_password IS NOT NULL as has_password,
        email_confirmed_at IS NOT NULL as email_confirmed,
        created_at,
        raw_user_meta_data,
        raw_app_meta_data
    FROM auth.users
    WHERE email = 'eldonmp2@gmail.com'
) subquery;
