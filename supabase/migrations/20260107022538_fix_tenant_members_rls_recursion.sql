-- Fix: evitar recursão infinita na RLS de tenant_members
-- 2.1) Remover TODAS as policies atuais (evita ter que saber os nomes)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tenant_members'
  LOOP
    EXECUTE FORMAT('DROP POLICY IF EXISTS %I ON public.tenant_members', r.policyname);
  END LOOP;
END $$;

-- 2.2) Garantir RLS ligada
ALTER TABLE public.tenant_members ENABLE ROW LEVEL SECURITY;

-- 2.3) Policies SEM RECURSÃO (mínimas e seguras)
-- Usuário só enxerga/manipula a própria linha em tenant_members
CREATE POLICY tm_select_self
ON public.tenant_members
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY tm_insert_self
ON public.tenant_members
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY tm_update_self
ON public.tenant_members
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY tm_delete_self
ON public.tenant_members
FOR DELETE
TO authenticated
USING (user_id = auth.uid());
