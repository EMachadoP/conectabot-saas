-- Script para diagnosticar problemas na criação de usuários
-- Execute no SQL Editor do Supabase

-- 1. Verificar estrutura da tabela auth.users
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'auth' 
  AND table_name = 'users'
ORDER BY ordinal_position;

-- 2. Verificar constraints em auth.users
SELECT
    con.conname AS constraint_name,
    con.contype AS constraint_type,
    CASE con.contype
        WHEN 'c' THEN 'CHECK'
        WHEN 'f' THEN 'FOREIGN KEY'
        WHEN 'p' THEN 'PRIMARY KEY'
        WHEN 'u' THEN 'UNIQUE'
        WHEN 't' THEN 'TRIGGER'
        WHEN 'x' THEN 'EXCLUSION'
    END AS constraint_type_desc,
    pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
WHERE nsp.nspname = 'auth'
  AND rel.relname = 'users';

-- 3. Verificar triggers em auth.users
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'auth'
  AND event_object_table = 'users'
ORDER BY trigger_name;

-- 4. Verificar se há RLS ativado em auth.users (não deveria ter)
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'auth'
  AND tablename = 'users';

-- 5. Verificar políticas RLS em auth.users (se houver)
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'auth'
  AND tablename = 'users';

-- 6. Verificar se tenant_id é obrigatório em profiles
SELECT 
    column_name,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'profiles'
  AND column_name = 'tenant_id';

-- 7. Testar criação de usuário manualmente (para ver erro exato)
DO $$
DECLARE
    test_user_id UUID := gen_random_uuid();
    test_email TEXT := 'test_' || floor(random() * 1000000) || '@test.com';
BEGIN
    -- Tentar inserir em auth.users
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
        updated_at
    ) VALUES (
        test_user_id,
        '00000000-0000-0000-0000-000000000000',
        test_email,
        crypt('TestPassword123!', gen_salt('bf')),
        NOW(),
        '{"provider":"email","providers":["email"]}'::jsonb,
        '{"name":"Test User"}'::jsonb,
        'authenticated',
        'authenticated',
        NOW(),
        NOW()
    );
    
    RAISE NOTICE 'Usuário de teste criado com sucesso: %', test_email;
    
    -- Limpar teste
    DELETE FROM auth.users WHERE id = test_user_id;
    RAISE NOTICE 'Usuário de teste removido';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'ERRO AO CRIAR USUÁRIO:';
        RAISE NOTICE 'SQLSTATE: %', SQLSTATE;
        RAISE NOTICE 'SQLERRM: %', SQLERRM;
        RAISE NOTICE 'Detalhes: %', SQLERRM;
END $$;
