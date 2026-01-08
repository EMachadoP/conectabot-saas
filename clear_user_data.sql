-- 1. LIMPEZA TOTAL do usuário eldonmp2@gmail.com
-- Execute no SQL Editor para começar do zero

DO $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Buscar ID do usuário
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'eldonmp2@gmail.com';
    
    IF v_user_id IS NOT NULL THEN
        -- Remover de todas as tabelas (profiles e members costumam ter FK com cascade, mas vamos garantir)
        DELETE FROM public.tenant_members WHERE user_id = v_user_id;
        DELETE FROM public.profiles WHERE id = v_user_id;
        DELETE FROM auth.identities WHERE user_id = v_user_id;
        DELETE FROM auth.users WHERE id = v_user_id;
        
        RAISE NOTICE '✅ Usuário eldonmp2@gmail.com removido completamente.';
    ELSE
        RAISE NOTICE 'ℹ️ Usuário eldonmp2@gmail.com não encontrado para remoção.';
    END IF;
END $$;

-- 2. Verificar se sumiu mesmo
SELECT count(*) FROM auth.users WHERE email = 'eldonmp2@gmail.com';
