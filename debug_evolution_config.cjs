const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.production' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkConfig() {
    console.log('Checking Evolution Config...');

    // Check tenant_integrations
    const { data: integrations, error: intError } = await supabase
        .from('tenant_integrations')
        .select('*')
        .eq('provider', 'evolution');

    if (intError) {
        console.error('Error fetching tenant_integrations:', intError);
    } else {
        console.log('--- tenant_integrations ---');
        console.table(integrations.map(i => ({
            tenant_id: i.tenant_id,
            instance: i.instance_name,
            url: i.base_url,
            enabled: i.is_enabled
        })));
    }

    // Check wa_instances (Note: might fail due to RLS if not admin, but let's try)
    const { data: instances, error: instError } = await supabase
        .from('wa_instances')
        .select('*');

    if (instError) {
        console.error('Error fetching wa_instances (RLS might block):', instError);
    } else {
        console.log('--- wa_instances ---');
        console.table(instances.map(i => ({
            team_id: i.team_id,
            key: i.evolution_instance_key,
            url: i.evolution_base_url,
            status: i.status
        })));
    }
}

checkConfig();
