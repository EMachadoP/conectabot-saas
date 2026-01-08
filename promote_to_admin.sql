-- 1. Verificar papéis do usuário atual
-- Execute no SQL Editor

SELECT 
    p.email,
    p.name,
    tm.role,
    tm.tenant_id,
    t.name as tenant_name
FROM public.profiles p
LEFT JOIN public.tenant_members tm ON tm.user_id = p.id
LEFT JOIN public.tenants t ON t.id = tm.tenant_id
WHERE p.email = 'eldonmp2@gmail.com';

-- 2. PROMOVER A OWNER (ADMIN)
-- Isso dará todas as permissões na plataforma

DO $$
DECLARE
    v_user_id UUID;
    v_tenant_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'eldonmp2@gmail.com';
    
    IF v_user_id IS NOT NULL THEN
        -- Garantir que o membro existe com role 'owner'
        INSERT INTO public.tenant_members (tenant_id, user_id, role, is_active)
        VALUES (v_tenant_id, v_user_id, 'owner', true)
        ON CONFLICT (tenant_id, user_id) 
        DO UPDATE SET role = 'owner', is_active = true;
        
        RAISE NOTICE '✅ Usuário eldonmp2@gmail.com promovido a OWNER da tenant padrão.';
    ELSE
        RAISE NOTICE '❌ Usuário não encontrado em auth.users para promoção.';
    END IF;
END $$;
