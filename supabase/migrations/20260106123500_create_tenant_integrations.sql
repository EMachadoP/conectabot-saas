-- Migration to create tenant_integrations table
create table if not exists public.tenant_integrations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,

  provider text not null, -- 'evolution', 'zapi', etc.
  is_enabled boolean not null default false,

  instance_name text,
  base_url text,
  api_key text,
  webhook_secret text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (tenant_id, provider)
);

create index if not exists tenant_integrations_tenant_idx
on public.tenant_integrations(tenant_id);

create index if not exists tenant_integrations_instance_idx
on public.tenant_integrations(instance_name);

-- RLS
alter table public.tenant_integrations enable row level security;

-- Policy: Members can view their tenant's integrations (if enabled)
create policy "Users can view their own tenant integrations"
  on public.tenant_integrations for select
  to authenticated
  using (
    tenant_id = (select tenant_id from public.profiles where id = auth.uid())
    and (is_enabled = true or public.has_role(auth.uid(), 'admin'))
  );

-- Policy: Only Admins can manage integrations (Select, Insert, Update, Delete)
create policy "Admins can manage tenant integrations"
  on public.tenant_integrations for all
  to authenticated
  using (
    tenant_id = (select tenant_id from public.profiles where id = auth.uid())
    and public.has_role(auth.uid(), 'admin')
  )
  with check (
    tenant_id = (select tenant_id from public.profiles where id = auth.uid())
    and public.has_role(auth.uid(), 'admin')
  );

-- Trigger to update updated_at
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger update_tenant_integrations_updated_at
    before update on public.tenant_integrations
    for each row
    execute function public.update_updated_at_column();
