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
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve(data);
                }
            });
        }).on('error', reject);
    });
}

async function diagnose() {
    try {
        console.log('--- User Identity Diagnosis ---');

        // Profiles usually have a select policy for authenticated users, 
        // but maybe we can see something with the email filter if it's permissive
        const profiles = await query('profiles?email=eq.eldonmp2@gmail.com&select=id,team_id,tenant_id,email');
        console.log('Profile for eldonmp2@gmail.com:');
        console.log(profiles);

        if (profiles && profiles.length > 0) {
            const tenantId = profiles[0].tenant_id;
            const teamId = profiles[0].team_id;
            console.log(`\nTenant ID: ${tenantId}`);
            console.log(`Team ID:   ${teamId}`);

            if (tenantId !== teamId) {
                console.log('\n!!! WARNING: Tenant ID and Team ID are DIFFERENT !!!');
            }
        } else {
            console.log('\nCould not find profile for eldonmp2@gmail.com via anon key REST API.');
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

diagnose();
