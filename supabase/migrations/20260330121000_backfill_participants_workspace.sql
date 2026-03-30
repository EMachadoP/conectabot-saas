update public.participants p
set workspace_id = c.workspace_id
from public.contacts c
where p.contact_id = c.id
  and (
    p.workspace_id is null
    or p.workspace_id <> c.workspace_id
  );
