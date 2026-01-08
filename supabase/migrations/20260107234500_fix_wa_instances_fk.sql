/* Fix Foreign Key mismatch for wa_instances
   - Removes the constraint pointing to the old 'teams' table
   - Points the constraint to the active 'tenants' table
   - Ensures data integrity for the Evolution API integration
*/

DO $$
BEGIN
    -- 1) Remove a constraint antiga se ela existir
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'wa_instances_team_id_fkey'
    ) THEN
        ALTER TABLE public.wa_instances DROP CONSTRAINT wa_instances_team_id_fkey;
    END IF;

    -- 2) Cria a nova constraint apontando para a tabela 'tenants'
    -- Isso permite que o activeTenant.id do sistema seja aceito em wa_instances
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'tenants') THEN
        ALTER TABLE public.wa_instances 
        ADD CONSTRAINT wa_instances_team_id_fkey 
        FOREIGN KEY (team_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
        
        RAISE NOTICE 'Constraint wa_instances_team_id_fkey redirecionada para a tabela tenants com sucesso.';
    ELSE
        RAISE EXCEPTION 'Erro: A tabela public.tenants não foi encontrada.';
    END IF;
END $$;

-- 3) Garante que as permissões RLS estejam atualizadas para ler da tabela certa
DROP POLICY IF EXISTS wa_instances_select ON public.wa_instances;
CREATE POLICY wa_instances_select
ON public.wa_instances
FOR SELECT
TO authenticated
USING (
  exists (
    select 1
    from public.tenant_members tm
    where tm.tenant_id = public.wa_instances.team_id
      and tm.user_id = auth.uid()
      and coalesce(tm.is_active, true) = true
  )
);
