import fs from 'fs';
import https from 'https';

const env = fs.readFileSync('.env.production', 'utf8');
const url = env.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();

function query(path) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: new URL(url).hostname,
            path: `/rest/v1/${path}`,
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`
            }
        };
        https.get(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });
}

async function diagnose() {
    try {
        console.log('--- Diagnosis ---');

        // Get current user (simulated by checking profiles)
        // Since we don't have a token, we check all profiles if possible
        const profiles = await query('profiles?select=id,team_id,email');
        console.log('Profiles (first 5):');
        console.table(profiles.slice(0, 5));

        const tenants = await query('tenants?select=id,name');
        console.log('\nTenants:');
        console.table(tenants);

        const members = await query('tenant_members?select=user_id,tenant_id,role');
        console.log('\nTenant Members:');
        console.table(members);

        const waInstances = await query('wa_instances?select=team_id,evolution_instance_key');
        console.log('\nwa_instances:');
        console.table(waInstances);

        const tenantIntegrations = await query('tenant_integrations?select=tenant_id,instance_name');
        console.log('\ntenant_integrations:');
        console.table(tenantIntegrations);

    } catch (e) {
        console.error('Error:', e);
    }
}

diagnose();
