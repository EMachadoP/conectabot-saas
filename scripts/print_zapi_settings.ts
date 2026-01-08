
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://rzlrslywbszlffmaglln.supabase.co';
const SERVICE_ROLE_KEY = 'sb_secret_NqSXbtK16L98S52Lrj-EeQ_TxOxe4QD';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function printSettings() {
    const { data: settings } = await supabase
        .from('zapi_settings')
        .select('*');

    console.log(JSON.stringify(settings, null, 2));
}

printSettings();
