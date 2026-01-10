-- View for WhatsApp Health Dashboard observability
CREATE OR REPLACE VIEW public.v_whatsapp_health AS
SELECT 
    wi.id,
    wi.team_id,
    t.name as team_name,
    wi.evolution_instance_key as instance_name,
    wi.status,
    wi.last_qr_requested_at,
    wi.last_error,
    (wi.last_status_details->'server'->>'reachable')::boolean as server_reachable,
    (wi.last_status_details->'server'->>'latency_ms')::integer as server_latency_ms,
    wi.last_status_details->'instance'->>'status' as instance_status,
    wi.last_status_details->>'checked_at' as last_health_check_at,
    wi.updated_at
FROM 
    public.wa_instances wi
JOIN 
    public.teams t ON wi.team_id = t.id;

-- Comment on view
COMMENT ON VIEW public.v_whatsapp_health IS 'Observability view for WhatsApp instances, extracting metrics from audit JSONB columns';
