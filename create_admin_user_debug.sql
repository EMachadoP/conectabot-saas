-- Versão simplificada para debug - vamos ver qual parte está falhando

DO $$
DECLARE
    new_user_id UUID := gen_random_uuid();
    user_email TEXT := 'eldonmp2@gmail.com';
    user_password TEXT := 'NovaSenhaAdmin123!';
    default_tenant_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
    RAISE NOTICE 'Iniciando criação de usuário...';
    RAISE NOTICE 'Email: %', user_email;
    RAISE NOTICE 'User ID: %', new_user_id;
    
    -- Passo 1: Criar tenant
    BEGIN
        INSERT INTO public.tenants (id, name, slug, is_active)
        VALUES (default_tenant_id, 'Tenant Padrão', 'default', true)
        ON CONFLICT (id) DO NOTHING;
        RAISE NOTICE '✅ Tenant OK';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ Erro ao criar tenant: % %', SQLERRM, SQLSTATE;
    END;
    
    -- Passo 2: Criar usuário em auth.users
    BEGIN
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            created_at,
            updated_at,
            confirmation_token,
            email_change,
            email_change_token_new,
            recovery_token
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            new_user_id,
            'authenticated',
            'authenticated',
            user_email,
            crypt(user_password, gen_salt('bf')),
            NOW(),
            '{"provider":"email","providers":["email"]}'::jsonb,
            '{"name":"Eldon Machado"}'::jsonb,
            NOW(),
            NOW(),
            '',
            '',
            '',
            ''
        );
        RAISE NOTICE '✅ Usuário criado em auth.users';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ ERRO AO CRIAR USUÁRIO:';
        RAISE NOTICE 'Mensagem: %', SQLERRM;
        RAISE NOTICE 'SQLSTATE: %', SQLSTATE;
        RAISE NOTICE 'Detalhes: %', SQLERRM;
        -- Não fazer RAISE EXCEPTION para continuar e ver outros erros
    END;
    
    -- Passo 3: Criar profile
    BEGIN
        INSERT INTO public.profiles (id, email, name, tenant_id)
        VALUES (new_user_id, user_email, 'Eldon Machado', default_tenant_id);
        RAISE NOTICE '✅ Profile criado';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ Erro ao criar profile: % %', SQLERRM, SQLSTATE;
    END;
    
    -- Passo 4: Criar tenant_member
    BEGIN
        INSERT INTO public.tenant_members (tenant_id, user_id, role, is_active)
        VALUES (default_tenant_id, new_user_id, 'owner', true);
        RAISE NOTICE '✅ Tenant member criado';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ Erro ao criar tenant_member: % %', SQLERRM, SQLSTATE;
    END;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ PROCESSO CONCLUÍDO!';
    RAISE NOTICE 'User ID: %', new_user_id;
    RAISE NOTICE 'Email: %', user_email;
    RAISE NOTICE 'Senha: %', user_password;
    RAISE NOTICE '========================================';
    
END $$;

-- Verificar se usuário foi criado
SELECT 
    u.id,
    u.email,
    u.email_confirmed_at,
    u.created_at,
    p.name,
    p.tenant_id
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE u.email = 'eldonmp2@gmail.com';
