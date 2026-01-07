-- Migration: Add evolution fields to integrations_settings
-- YYYYMMDDHHMMSS_add_evolution_fields_to_settings.sql

alter table public.integrations_settings
add column if not exists evolution_instance text,
add column if not exists evolution_apikey text;

-- Create an index to speed up webhook lookups by instance name
create index if not exists idx_integrations_settings_evolution_instance 
on public.integrations_settings(evolution_instance);

-- Add comments for documentation
comment on column public.integrations_settings.evolution_instance is 'Evolution API instance name for this tenant.';
comment on column public.integrations_settings.evolution_apikey is 'Evolution API key for this specific instance (if different from global).';
