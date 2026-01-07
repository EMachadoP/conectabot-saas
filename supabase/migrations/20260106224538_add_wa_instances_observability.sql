-- Add observability fields to wa_instances for better monitoring and debugging
ALTER TABLE public.wa_instances
  ADD COLUMN IF NOT EXISTS last_status text,
  ADD COLUMN IF NOT EXISTS last_status_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_qr_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error text;

-- Create index for efficient team-based queries
CREATE INDEX IF NOT EXISTS idx_wa_instances_team_provider
  ON public.wa_instances(team_id, evolution_instance_key);

-- Comments for documentation
COMMENT ON COLUMN public.wa_instances.last_status IS 'Last known connection status from Evolution API';
COMMENT ON COLUMN public.wa_instances.last_status_at IS 'Timestamp of last status check';
COMMENT ON COLUMN public.wa_instances.last_qr_at IS 'Timestamp of last QR code generation';
COMMENT ON COLUMN public.wa_instances.last_error IS 'Last error message encountered';
