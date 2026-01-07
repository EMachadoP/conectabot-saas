-- Tornar eldonmp2@gmail.com admin (local)
DO $$ 
DECLARE 
  target_id uuid;
BEGIN
  -- Tenta achar o ID pelo e-mail
  SELECT id INTO target_id FROM auth.users WHERE LOWER(email) = LOWER('eldonmp2@gmail.com');
  
  IF target_id IS NOT NULL THEN
    -- Opção A e B: Marcar admin na tabela profiles
    -- (O script cobre ambas as colunas se existirem ou apenas as que o schema tiver)
    
    -- Se existir coluna 'role', seta 'admin'
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role') THEN
      UPDATE public.profiles SET role = 'admin' WHERE id = target_id;
    END IF;

    -- Se existir coluna 'is_admin', seta true
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_admin') THEN
      UPDATE public.profiles SET is_admin = true WHERE id = target_id;
    END IF;

    -- Garantir que seu membership está ativo e com role owner no tenant padrão
    INSERT INTO public.tenant_members (tenant_id, user_id, role, is_active)
    VALUES ('00000000-0000-0000-0000-000000000001', target_id, 'owner', true)
    ON CONFLICT (tenant_id, user_id) DO UPDATE 
    SET is_active = true, role = 'owner';

    -- Garantir role admin em user_roles (tabela de segurança secundária)
    INSERT INTO public.user_roles (user_id, role)
    VALUES (target_id, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
    
  END IF;
END $$;
