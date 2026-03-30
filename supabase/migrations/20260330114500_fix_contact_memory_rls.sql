drop policy if exists "workspace members can view contact memory" on public.contact_memory;
create policy "workspace members can view contact memory"
on public.contact_memory
for select
to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists "workspace members can insert contact memory" on public.contact_memory;
create policy "workspace members can insert contact memory"
on public.contact_memory
for insert
to authenticated
with check (
  public.is_workspace_member(workspace_id)
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
using (public.is_workspace_member(workspace_id))
with check (
  public.is_workspace_member(workspace_id)
  and exists (
    select 1
    from public.contacts c
    where c.id = contact_id
      and c.workspace_id = contact_memory.workspace_id
  )
);
