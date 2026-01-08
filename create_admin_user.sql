-- Solução: Criar usuário diretamente via SQL
-- Isso bypassa completamente o trigger e o Dashboard

DO $$
DECLARE
    new_user_id UUID;
    user_email TEXT := 'eldonmp2@gmail.com';
    user_password TEXT := 'NovaSenhaAdmin123!';
    user_name TEXT := 'Eldon Machado';
    default_tenant_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
    -- 1. Garantir que tenant padrão existe
    INSERT INTO public.tenants (id, name, slug, is_active)
    VALUES (default_tenant_id, 'Tenant Padrão', 'default', true)
    ON CONFLICT (id) DO NOTHING;

    -- 2. Verificar se usuário já existe
    SELECT id INTO new_user_id
    FROM auth.users
    WHERE email = user_email;

    IF new_user_id IS NOT NULL THEN
        RAISE NOTICE 'Usuário já existe: %', new_user_id;
        
        -- Atualizar senha e confirmar email
        UPDATE auth.users
        SET 
            encrypted_password = crypt(user_password, gen_salt('bf')),
            email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
            updated_at = NOW()
        WHERE id = new_user_id;
        
        RAISE NOTICE 'Senha atualizada';
    ELSE
        -- 3. Criar novo usuário
        new_user_id := gen_random_uuid();
        
        INSERT INTO auth.users (
            id,
            instance_id,
            email,
            encrypted_password,
            email_confirmed_at,
            raw_app_meta_data,
            raw_user_meta_data,
            aud,
            role,
            created_at,
            updated_at,
            confirmation_token,
            email_change,
            email_change_token_new,
            recovery_token
        ) VALUES (
            new_user_id,
            '00000000-0000-0000-0000-000000000000',
            user_email,
            crypt(user_password, gen_salt('bf')),
            NOW(), -- Email já confirmado
            '{"provider":"email","providers":["email"]}'::jsonb,
            jsonb_build_object('name', user_name),
            'authenticated',
            'authenticated',
            NOW(),
            NOW(),
            '',
            '',
            '',
            ''
        );
        
        RAISE NOTICE 'Usuário criado: %', new_user_id;
    END IF;

    -- 4. Criar/atualizar profile
    INSERT INTO public.profiles (id, email, name, tenant_id)
    VALUES (new_user_id, user_email, user_name, default_tenant_id)
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        name = EXCLUDED.name,
        tenant_id = EXCLUDED.tenant_id;
    
    RAISE NOTICE 'Profile criado/atualizado';

    -- 5. Adicionar a tenant_members como owner
    INSERT INTO public.tenant_members (tenant_id, user_id, role, is_active)
    VALUES (default_tenant_id, new_user_id, 'owner', true)
    ON CONFLICT (tenant_id, user_id) DO UPDATE SET
        role = 'owner',
        is_active = true;
    
    RAISE NOTICE 'Adicionado ao tenant como owner';

    -- 6. Identidade será criada automaticamente pelo Supabase no primeiro login
    RAISE NOTICE 'Identidade será criada no primeiro login';

    -- 7. Resultado
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ USUÁRIO CRIADO COM SUCESSO!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'ID: %', new_user_id;
    RAISE NOTICE 'Email: %', user_email;
    RAISE NOTICE 'Senha: %', user_password;
    RAISE NOTICE 'Nome: %', user_name;
    RAISE NOTICE 'Role: owner';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Você pode fazer login agora!';
    RAISE NOTICE '========================================';
END $$;
