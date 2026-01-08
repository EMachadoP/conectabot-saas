/* Final RLS fix for Integration tables (Multi-tenant)
   - tenant_integrations: membros leem, admins gerenciam
   - wa_instances: membros leem, admins gerenciam

   Este script garante suporte correto a multi-tenancy validando contra a tabela tenant_members.
*/

-------------------------------------------------------
-- 1. TENANT_INTEGRATIONS
-------------------------------------------------------
alter table public.tenant_integrations enable row level security;

-- Limpa policies antigas para evitar conflitos
drop policy if exists ti_select on public.tenant_integrations;
drop policy if exists ti_manage_admin on public.tenant_integrations;
drop policy if exists "Users can view their own tenant integrations" on public.tenant_integrations;
drop policy if exists "Admins can manage tenant integrations" on public.tenant_integrations;
drop policy if exists ti_insert_admin on public.tenant_integrations;
drop policy if exists ti_update_admin on public.tenant_integrations;
drop policy if exists ti_delete_admin on public.tenant_integrations;

-- SELECT: qualquer membro ativo do tenant
create policy ti_select
on public.tenant_integrations
for select
to authenticated
using (
  exists (
    select 1
    from public.tenant_members tm
    where tm.tenant_id = public.tenant_integrations.tenant_id
      and tm.user_id = auth.uid()
      and coalesce(tm.is_active, true) = true
  )
);

-- INSERT/UPDATE/DELETE: apenas owners, admins ou super_admins
create policy ti_manage_admin
on public.tenant_integrations
for all
to authenticated
using (
  exists (
    select 1
    from public.tenant_members tm
    where tm.tenant_id = public.tenant_integrations.tenant_id
      and tm.user_id = auth.uid()
      and coalesce(tm.is_active, true) = true
      and tm.role in ('owner', 'admin', 'super_admin')
  )
)
with check (
  exists (
    select 1
    from public.tenant_members tm
    where tm.tenant_id = public.tenant_integrations.tenant_id
      and tm.user_id = auth.uid()
      and coalesce(tm.is_active, true) = true
      and tm.role in ('owner', 'admin', 'super_admin')
  )
);

-------------------------------------------------------
-- 2. WA_INSTANCES
-------------------------------------------------------
alter table public.wa_instances enable row level security;

-- Limpa policies antigas
drop policy if exists "team_select_wa_instances" on public.wa_instances;
drop policy if exists "team_insert_wa_instances" on public.wa_instances;
drop policy if exists "team_update_wa_instances" on public.wa_instances;
drop policy if exists "team_delete_wa_instances" on public.wa_instances;
drop policy if exists wa_instances_select on public.wa_instances;
drop policy if exists wa_instances_manage on public.wa_instances;

-- SELECT: qualquer membro ativo do tenant
create policy wa_instances_select
on public.wa_instances
for select
to authenticated
using (
  exists (
    select 1
    from public.tenant_members tm
    where tm.tenant_id = public.wa_instances.team_id
      and tm.user_id = auth.uid()
      and coalesce(tm.is_active, true) = true
  )
);

-- ALL: apenas owners, admins ou super_admins
create policy wa_instances_manage
on public.wa_instances
for all
to authenticated
using (
  exists (
    select 1
    from public.tenant_members tm
    where tm.tenant_id = public.wa_instances.team_id
      and tm.user_id = auth.uid()
      and coalesce(tm.is_active, true) = true
      and tm.role in ('owner', 'admin', 'super_admin')
  )
)
with check (
  exists (
    select 1
    from public.tenant_members tm
    where tm.tenant_id = public.wa_instances.team_id
      and tm.user_id = auth.uid()
      and coalesce(tm.is_active, true) = true
      and tm.role in ('owner', 'admin', 'super_admin')
  )
);
