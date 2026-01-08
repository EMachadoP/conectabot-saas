-- 1. LIMPEZA E RECONSTRUÇÃO FINAL de Permissões
-- Execute no SQL Editor (este script resolve tudo para o novo ID)

DO $$
DECLARE
    v_user_id UUID;
    v_tenant_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
    -- 1. Pegar o ID ATUAL do usuário (mudou após o signup)
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'eldonmp2@gmail.com';
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário eldonmp2@gmail.com não encontrado em auth.users. Faça o signup primeiro!';
    END IF;

    -- 2. Garantir que a Tenant Padrão existe
    INSERT INTO public.tenants (id, name, slug, is_active)
    VALUES (v_tenant_id, 'ConectaBot Admin', 'admin', true)
    ON CONFLICT (id) DO NOTHING;

    -- 3. Criar/Atualizar Profile
    INSERT INTO public.profiles (id, email, name, tenant_id)
    VALUES (v_user_id, 'eldonmp2@gmail.com', 'Eldon Machado', v_tenant_id)
    ON CONFLICT (id) DO UPDATE SET 
        tenant_id = v_tenant_id,
        email = EXCLUDED.email;

    -- 4. Criar/Atualizar Tenant Member como OWNER
    INSERT INTO public.tenant_members (tenant_id, user_id, role, is_active)
    VALUES (v_tenant_id, v_user_id, 'owner', true)
    ON CONFLICT (tenant_id, user_id) 
    DO UPDATE SET role = 'owner', is_active = true;

    RAISE NOTICE '✅ SUCESSO! ID % promovido a OWNER na tenant %', v_user_id, v_tenant_id;
END $$;

-- Verificação final
SELECT 
    p.email, 
    tm.role, 
    tm.tenant_id,
    u.id as auth_user_id
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
JOIN public.tenant_members tm ON tm.user_id = u.id
WHERE u.email = 'eldonmp2@gmail.com';
