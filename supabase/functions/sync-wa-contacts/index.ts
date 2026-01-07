import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

        console.log(`[sync-wa-contacts] Starting sync for team ${teamId}`)

        // Get wa_instance for this team
        const { data: instance } = await supabase
            .from('wa_instances')
            .select('*')
            .eq('team_id', teamId)
            .single()

        if (!instance) {
            throw new Error('WhatsApp instance not configured for this team')
        }

        if (instance.status !== 'connected') {
            throw new Error(`WhatsApp instance is ${instance.status}. Please connect first.`)
        }

        const { evolution_base_url: baseUrl, evolution_api_key: apiKey, evolution_instance_key: instanceKey } = instance

        console.log(`[sync-wa-contacts] Using Evolution instance: ${instanceKey}`)

        // Fetch contacts
        let contacts = []
        try {
            const contactsRes = await fetch(`${baseUrl}/chat/findContacts/${instanceKey}`, {
                headers: { 'apikey': apiKey },
                signal: AbortSignal.timeout(10000)
            })

            if (contactsRes.ok) {
                contacts = await contactsRes.json()
                console.log(`[sync-wa-contacts] Fetched ${contacts?.length || 0} contacts`)
            } else {
                console.warn(`[sync-wa-contacts] Failed to fetch contacts: ${contactsRes.status}`)
            }
        } catch (error: any) {
            console.error(`[sync-wa-contacts] Error fetching contacts:`, error.message)
        }

        // Fetch groups
        let groups = []
        try {
            const groupsRes = await fetch(`${baseUrl}/group/fetchAllGroups/${instanceKey}`, {
                headers: { 'apikey': apiKey },
                signal: AbortSignal.timeout(10000)
            })

            if (groupsRes.ok) {
                groups = await groupsRes.json()
                console.log(`[sync-wa-contacts] Fetched ${groups?.length || 0} groups`)
            } else {
                console.warn(`[sync-wa-contacts] Failed to fetch groups: ${groupsRes.status}`)
            }
        } catch (error: any) {
            console.error(`[sync-wa-contacts] Error fetching groups:`, error.message)
        }

        // Prepare data for insertion
        const targets = []
        const now = new Date().toISOString()

        // Process contacts
        for (const contact of (contacts || [])) {
            if (contact.id && contact.id.includes('@s.whatsapp.net')) {
                const phone = contact.id.split('@')[0]
                targets.push({
                    team_id: teamId,
                    type: 'person',
                    jid: contact.id,
                    display_name: contact.pushName || contact.name || phone,
                    phone_e164: phone,
                    source: 'sync',
                    last_seen_at: now,
                })
            }
        }

        // Process groups
        for (const group of (groups || [])) {
            if (group.id && group.id.includes('@g.us')) {
                targets.push({
                    team_id: teamId,
                    type: 'group',
                    jid: group.id,
                    display_name: group.subject || group.id.split('@')[0],
                    phone_e164: null,
                    source: 'sync',
                    last_seen_at: now,
                })
            }
        }

        console.log(`[sync-wa-contacts] Prepared ${targets.length} targets for upsert`)

        // Upsert into wa_targets (using service role for RLS bypass)
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        if (targets.length > 0) {
            const { error: upsertError } = await supabaseAdmin
                .from('wa_targets')
                .upsert(targets, { onConflict: 'team_id,jid' })

            if (upsertError) {
                console.error(`[sync-wa-contacts] Upsert error:`, upsertError)
                throw upsertError
            }

            console.log(`[sync-wa-contacts] Successfully synced ${targets.length} targets`)
        }

        // Update last_sync_at on wa_instance
        await supabaseAdmin
            .from('wa_instances')
            .update({ last_sync_at: now })
            .eq('id', instance.id)

        return new Response(JSON.stringify({
            success: true,
            synced: targets.length,
            contacts: contacts?.length || 0,
            groups: groups?.length || 0,
            timestamp: now
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error: any) {
        console.error('[sync-wa-contacts] Critical error:', error)
        return new Response(JSON.stringify({
            error: error.message,
            timestamp: new Date().toISOString()
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        })
    }
})
