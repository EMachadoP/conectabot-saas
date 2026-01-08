// Quick test script to verify Supabase connection and login
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://rzlrslywbszlffmaglln.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6bHJzbHl3YnN6bGZmbWFnbGxuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2NTQ2NjEsImV4cCI6MjA4MzIzMDY2MX0.07iElm-4tR8O7cOwTD2pwRtdTb0XHZQsvnxZIS9uOhU';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testLogin() {
    console.log('🔍 Testing login with Supabase...\n');

    const email = 'eldonmp2@gmail.com';
    const password = 'NovaSenhaAdmin123!';

    console.log('Email:', email);
    console.log('Password:', password.substring(0, 5) + '...');
    console.log('URL:', supabaseUrl);
    console.log('\n📡 Attempting login...\n');

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            console.error('❌ Login Error:');
            console.error('  Message:', error.message);
            console.error('  Status:', error.status);
            console.error('  Code:', error.code);
            console.error('  Details:', JSON.stringify(error, null, 2));
            process.exit(1);
        }

        console.log('✅ Login successful!');
        console.log('\n👤 User Info:');
        console.log('  ID:', data.user?.id);
        console.log('  Email:', data.user?.email);
        console.log('  Email Confirmed:', data.user?.email_confirmed_at);

        console.log('\n🔑 Session Info:');
        console.log('  Access Token:', data.session?.access_token?.substring(0, 20) + '...');
        console.log('  Refresh Token:', data.session?.refresh_token?.substring(0, 20) + '...');
        console.log('  Expires At:', new Date(data.session?.expires_at * 1000).toLocaleString());

    } catch (error) {
        console.error('💥 Unexpected Error:', error.message);
        process.exit(1);
    }
}

testLogin();
