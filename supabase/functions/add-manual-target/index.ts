import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Normalize phone to E.164 format
function normalizePhone(phone: string): string {
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '')

    // If already starts with country code, return as is
    if (digits.startsWith('55') && digits.length >= 12) {
        return digits
    }

    // If starts with 0, remove it (Brazilian format)
    if (digits.startsWith('0')) {
        return '55' + digits.substring(1)
    }

    // Otherwise, assume Brazilian number and prepend 55
    return '55' + digits
}

function jsonResponse(body: Record<string, unknown>, status: number) {
    return new Response(JSON.stringify(body), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status,
    })
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) {
            return jsonResponse({
                error: 'Missing authorization header',
                timestamp: new Date().toISOString()
            }, 401)
        }

        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        )

        // Get user and team
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return jsonResponse({
                error: 'Unauthorized',
                timestamp: new Date().toISOString()
            }, 401)
        }

        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('team_id')
            .eq('id', user.id)
            .single()

        if (profileError) {
            console.error('[add-manual-target] Failed to fetch profile:', profileError)
            throw profileError
        }

        const teamId = profile?.team_id
        if (!teamId) {
            return jsonResponse({
                error: 'Team not found',
                timestamp: new Date().toISOString()
            }, 404)
        }

        // Parse request body
        const { phone, display_name } = await req.json()

        if (typeof phone !== 'string' || !phone.trim()) {
            return jsonResponse({
                error: 'Phone number is required',
                timestamp: new Date().toISOString()
            }, 400)
        }

        console.log(`[add-manual-target] Adding manual target for team ${teamId}: ${phone}`)

        // Normalize to E.164
        const phoneE164 = normalizePhone(phone.trim())
        if (phoneE164.length < 12 || phoneE164.length > 13) {
            return jsonResponse({
                error: 'Invalid phone number format',
                timestamp: new Date().toISOString()
            }, 400)
        }

        const jid = `${phoneE164}@s.whatsapp.net`
        const normalizedDisplayName =
            typeof display_name === 'string' && display_name.trim()
                ? display_name.trim()
                : phoneE164

        // Use service role for write consistency, after validating the caller team.
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Upsert to wa_targets
        const { data, error } = await supabaseAdmin
            .from('wa_targets')
            .upsert({
                team_id: teamId,
                type: 'person',
                jid: jid,
                display_name: normalizedDisplayName,
                phone_e164: phoneE164,
                source: 'manual',
                last_seen_at: null, // manual entries don't have last_seen_at
            }, { onConflict: 'team_id,jid' })
            .select()
            .single()

        if (error) throw error

        console.log(`[add-manual-target] Successfully added/updated manual target: ${jid}`)

        return jsonResponse({
            success: true,
            target: data,
            timestamp: new Date().toISOString()
        }, 200)

    } catch (error: any) {
        console.error('[add-manual-target] Error:', error)
        return jsonResponse({
            error: error.message,
            timestamp: new Date().toISOString()
        }, 500)
    }
})
