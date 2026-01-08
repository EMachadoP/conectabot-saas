-- 3. VERSÃO ULTRA-SEGURA do trigger (Reduzida ao mínimo)
-- Execute no SQL Editor após o script de limpeza

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Tentar criar profile, mas NÃO FALHAR se der erro
  BEGIN
    INSERT INTO public.profiles (id, email, name, tenant_id)
    VALUES (
      NEW.id, 
      NEW.email, 
      COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      '00000000-0000-0000-0000-000000000001'
    );
  EXCEPTION WHEN OTHERS THEN
    -- Apenas loga o erro e NÃO interrompe a criação do usuário
    RAISE LOG 'Error in handle_new_user: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;
