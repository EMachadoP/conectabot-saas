alter table public.ai_settings
add column if not exists agent_display_name text;

update public.ai_settings
set agent_display_name = coalesce(nullif(agent_display_name, ''), 'Ana Mônica')
where agent_display_name is null or btrim(agent_display_name) = '';
