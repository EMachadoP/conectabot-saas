import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Using service role to setup test data
const supabase = createClient(supabaseUrl, supabaseKey);

async function testMultiTenantResolution() {
    console.log('🚀 Iniciando Teste de Resolução Multi-tenant...');

    // 1. Setup Test Tenants
    const tenantA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const tenantB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

    console.log('--- Configurando Integrações de Teste ---');

    // Upsert Tenant A Config
    await supabase.from('tenant_integrations').upsert({
        tenant_id: tenantA,
        provider: 'evolution',
        is_enabled: true,
        instance_name: 'instance-alpha',
        base_url: 'https://api.alpha.com',
        api_key: 'key-alpha',
        webhook_secret: 'secret-alpha'
    }, { onConflict: 'tenant_id, provider' });

    // Upsert Tenant B Config
    await supabase.from('tenant_integrations').upsert({
        tenant_id: tenantB,
        provider: 'evolution',
        is_enabled: true,
        instance_name: 'instance-beta',
        base_url: 'https://api.beta.com',
        api_key: 'key-beta',
        webhook_secret: 'secret-beta'
    }, { onConflict: 'tenant_id, provider' });

    console.log('✅ Dados de teste inseridos.');

    // 2. Simulate Webhook Resolution (Mapping Instance -> Tenant)
    console.log('--- Simulando Resolução de Webhook ---');

    const resolveInstance = async (name: string) => {
        const { data, error } = await supabase
            .from('tenant_integrations')
            .select('tenant_id, webhook_secret')
            .eq('instance_name', name)
            .eq('provider', 'evolution')
            .maybeSingle();
        return data;
    };

    const resA = await resolveInstance('instance-alpha');
    const resB = await resolveInstance('instance-beta');

    console.log(`Payload instance 'instance-alpha' resolveu para Tenant: ${resA?.tenant_id} (Esperado: ${tenantA})`);
    console.log(`Payload instance 'instance-beta' resolveu para Tenant: ${resB?.tenant_id} (Esperado: ${tenantB})`);

    if (resA?.tenant_id === tenantA && resB?.tenant_id === tenantB) {
        console.log('✅ SUCESSO: Mapeamento de instâncias isolado corretamente.');
    } else {
        console.error('❌ ERRO: Falha no mapeamento de instâncias.');
    }

    // 3. Simulate Worker Factory Resolution
    console.log('--- Simulando Factory de Provedores ---');

    const resolveProvider = async (tId: string) => {
        const { data } = await supabase
            .from('tenant_integrations')
            .select('*')
            .eq('tenant_id', tId)
            .eq('provider', 'evolution')
            .maybeSingle();
        return data;
    };

    const configA = await resolveProvider(tenantA);
    const configB = await resolveProvider(tenantB);

    console.log(`Tenant ${tenantA} usa Instance: ${configA?.instance_name} (${configA?.base_url})`);
    console.log(`Tenant ${tenantB} usa Instance: ${configB?.instance_name} (${configB?.base_url})`);

    if (configA?.instance_name === 'instance-alpha' && configB?.instance_name === 'instance-beta') {
        console.log('✅ SUCESSO: Factory resolveu configurações corretas por Tenant.');
    } else {
        console.error('❌ ERRO: Factory falhou na resolução por Tenant.');
    }
}

testMultiTenantResolution();
