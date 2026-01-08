// Script to check if user exists in the database
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rzlrslywbszlffmaglln.supabase.co';
// Using service role key to check auth.users (you'll need to provide this)
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'PASTE_SERVICE_ROLE_KEY_HERE';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function checkUser() {
    console.log('🔍 Checking if user exists in auth.users...\n');

    const email = 'eldonmp2@gmail.com';

    try {
        // List all users (requires service role key)
        const { data: { users }, error } = await supabase.auth.admin.listUsers();

        if (error) {
            console.error('❌ Error listing users:', error.message);
            console.error('   Make sure you have the SERVICE_ROLE_KEY set');
            process.exit(1);
        }

        console.log(`📊 Total users in project: ${users.length}\n`);

        // Find our user
        const user = users.find(u => u.email === email);

        if (!user) {
            console.error(`❌ User ${email} NOT FOUND in auth.users`);
            console.log('\n📋 Existing users:');
            users.forEach(u => {
                console.log(`  - ${u.email} (ID: ${u.id})`);
            });
            process.exit(1);
        }

        console.log('✅ User found in auth.users!');
        console.log('\n👤 User Details:');
        console.log('  ID:', user.id);
        console.log('  Email:', user.email);
        console.log('  Email Confirmed:', user.email_confirmed_at ? 'Yes' : 'No');
        console.log('  Email Confirmed At:', user.email_confirmed_at);
        console.log('  Created At:', user.created_at);
        console.log('  Last Sign In:', user.last_sign_in_at || 'Never');

        // Check if user has a password set
        if (user.encrypted_password) {
            console.log('  Password Set: Yes');
        } else {
            console.log('  Password Set: No (this might be the issue!)');
        }

    } catch (error) {
        console.error('💥 Unexpected Error:', error.message);
        process.exit(1);
    }
}

checkUser();
