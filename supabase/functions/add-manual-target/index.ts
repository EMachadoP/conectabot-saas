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

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const authHeader = req.headers.get('Authorization')!
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        )

        // Get user and team
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            throw new Error('Unauthorized')
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('team_id')
            .eq('id', user.id)
            .single()

        const teamId = profile?.team_id
        if (!teamId) {
            throw new Error('Team not found')
        }

        // Parse request body
        const { phone, display_name } = await req.json()

        if (!phone) {
            throw new Error('Phone number is required')
        }

        console.log(`[add-manual-target] Adding manual target for team ${teamId}: ${phone}`)

        // Normalize to E.164
        const phoneE164 = normalizePhone(phone)
        const jid = `${phoneE164}@s.whatsapp.net`

        // Upsert to wa_targets
        const { data, error } = await supabase
            .from('wa_targets')
            .upsert({
                team_id: teamId,
                type: 'person',
                jid: jid,
                display_name: display_name || phoneE164,
                phone_e164: phoneE164,
                source: 'manual',
                last_seen_at: null, // manual entries don't have last_seen_at
            }, { onConflict: 'team_id,jid' })
            .select()
            .single()

        if (error) throw error

        console.log(`[add-manual-target] Successfully added/updated manual target: ${jid}`)

        return new Response(JSON.stringify({
            success: true,
            target: data,
            timestamp: new Date().toISOString()
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error: any) {
        console.error('[add-manual-target] Error:', error)
        return new Response(JSON.stringify({
            error: error.message,
            timestamp: new Date().toISOString()
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        })
    }
})
