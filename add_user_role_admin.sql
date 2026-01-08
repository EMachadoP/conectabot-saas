-- Adicionar papel de ADMIN na tabela user_roles
-- Execute no SQL Editor

DO $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Pegar o ID do usuário pelo email
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'eldonmp2@gmail.com';
    
    IF v_user_id IS NOT NULL THEN
        -- Inserir o papel de admin
        INSERT INTO public.user_roles (user_id, role)
        VALUES (v_user_id, 'admin')
        ON CONFLICT (user_id, role) DO NOTHING;
        
        RAISE NOTICE '✅ Papel de ADMIN adicionado para eldonmp2@gmail.com na tabela user_roles.';
    ELSE
        RAISE NOTICE '❌ Usuário não encontrado em auth.users.';
    END IF;
END $$;

-- Verificar se agora aparece nos papéis
SELECT u.email, ur.role
FROM auth.users u
JOIN public.user_roles ur ON ur.user_id = u.id
WHERE u.email = 'eldonmp2@gmail.com';
