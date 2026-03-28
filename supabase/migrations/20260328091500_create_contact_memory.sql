create table if not exists public.contact_memory (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts(id) on delete cascade,
  workspace_id uuid not null references public.tenants(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  contact_name text,
  company_name text,
  role_title text,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contact_memory_contact_id_key unique (contact_id)
);

alter table public.contact_memory enable row level security;

create index if not exists contact_memory_workspace_idx
  on public.contact_memory(workspace_id);

create index if not exists contact_memory_contact_idx
  on public.contact_memory(contact_id);

create or replace function public.set_contact_memory_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trigger_contact_memory_updated_at on public.contact_memory;
create trigger trigger_contact_memory_updated_at
before update on public.contact_memory
for each row
execute function public.set_contact_memory_updated_at();

drop policy if exists "workspace members can view contact memory" on public.contact_memory;
create policy "workspace members can view contact memory"
on public.contact_memory
for select
to authenticated
using (workspace_id = public.current_workspace_id());

drop policy if exists "workspace members can insert contact memory" on public.contact_memory;
create policy "workspace members can insert contact memory"
on public.contact_memory
for insert
to authenticated
with check (
  workspace_id = public.current_workspace_id()
  and exists (
    select 1
    from public.contacts c
    where c.id = contact_id
      and c.workspace_id = contact_memory.workspace_id
  )
);

drop policy if exists "workspace members can update contact memory" on public.contact_memory;
create policy "workspace members can update contact memory"
on public.contact_memory
for update
to authenticated
using (workspace_id = public.current_workspace_id())
with check (
  workspace_id = public.current_workspace_id()
  and exists (
    select 1
    from public.contacts c
    where c.id = contact_id
      and c.workspace_id = contact_memory.workspace_id
  )
);

grant all on public.contact_memory to authenticated;
grant all on public.contact_memory to service_role;
