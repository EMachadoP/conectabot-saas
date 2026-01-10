-- Add audit columns to wa_instances for better observability
ALTER TABLE public.wa_instances 
ADD COLUMN IF NOT EXISTS last_qr_requested_at timestamptz,
ADD COLUMN IF NOT EXISTS last_error jsonb,
ADD COLUMN IF NOT EXISTS last_status_details jsonb;

-- Comment on new columns
COMMENT ON COLUMN public.wa_instances.last_qr_requested_at IS 'Last time a QR code was requested';
COMMENT ON COLUMN public.wa_instances.last_error IS 'JSON payload of the last error encountered';
COMMENT ON COLUMN public.wa_instances.last_status_details IS 'Detailed status from the last health check';
