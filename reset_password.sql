-- Redefinir senha do usuário
-- Execute no SQL Editor

-- Atualizar senha com criptografia correta
UPDATE auth.users
SET 
    encrypted_password = crypt('NovaSenhaAdmin123!', gen_salt('bf')),
    updated_at = NOW()
WHERE email = 'eldonmp2@gmail.com';

-- Verificar se foi atualizado
SELECT 
    id,
    email,
    encrypted_password IS NOT NULL as has_password,
    email_confirmed_at IS NOT NULL as email_confirmed,
    updated_at
FROM auth.users
WHERE email = 'eldonmp2@gmail.com';
