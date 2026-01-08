import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.production' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials in .env.production');
    process.exit(1);
}

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
        console.log('\n--- tenant_integrations ---');
        if (integrations.length === 0) {
            console.log('No records found in tenant_integrations');
        } else {
            console.table(integrations.map(i => ({
                id: i.id,
                tenant_id: i.tenant_id,
                instance: i.instance_name,
                url: i.base_url,
                enabled: i.is_enabled
            })));
        }
    }

    // Check wa_instances
    const { data: instances, error: instError } = await supabase
        .from('wa_instances')
        .select('*');

    if (instError) {
        console.error('\nError fetching wa_instances (RLS might block if not authenticated):', instError);
    } else {
        console.log('\n--- wa_instances ---');
        if (instances.length === 0) {
            console.log('No records found in wa_instances');
        } else {
            console.table(instances.map(i => ({
                id: i.id,
                team_id: i.team_id,
                key: i.evolution_instance_key,
                url: i.evolution_base_url,
                status: i.status
            })));
        }
    }
}

checkConfig();
