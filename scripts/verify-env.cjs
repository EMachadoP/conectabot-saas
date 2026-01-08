#!/usr/bin/env node
// CommonJS script for environment verification

/**
 * Script de Verificação de Ambiente
 * 
 * Verifica se todas as variáveis de ambiente estão configuradas corretamente
 * e se a conexão com o Supabase está funcionando.
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const REQUIRED_VARS = [
    'VITE_SUPABASE_URL',
    'VITE_SUPABASE_ANON_KEY',
    'VITE_SUPABASE_PROJECT_ID'
];

const EXPECTED_PROJECT_REF = 'rzlrslywbszlffmaglln';

async function verifyEnvironment() {
    console.log('🔍 Verificando configuração de ambiente...\n');

    let hasErrors = false;

    // 1. Verificar variáveis obrigatórias
    console.log('📋 Variáveis de Ambiente:');
    REQUIRED_VARS.forEach(varName => {
        const value = process.env[varName];
        if (!value) {
            console.error(`  ❌ ${varName}: AUSENTE`);
            hasErrors = true;
        } else {
            // Mostrar apenas início e fim para segurança
            const masked = value.length > 20
                ? `${value.substring(0, 10)}...${value.substring(value.length - 10)}`
                : value;
            console.log(`  ✅ ${varName}: ${masked}`);
        }
    });

    if (hasErrors) {
        console.error('\n❌ Variáveis de ambiente ausentes. Configure o arquivo .env');
        process.exit(1);
    }

    // 2. Verificar projeto Supabase
    console.log('\n🔐 Verificando Projeto Supabase:');

    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
    const projectId = process.env.VITE_SUPABASE_PROJECT_ID;

    // Decodificar JWT
    try {
        const payload = JSON.parse(Buffer.from(supabaseAnonKey.split('.')[1], 'base64').toString());

        console.log(`  URL: ${supabaseUrl}`);
        console.log(`  Project ID (env): ${projectId}`);
        console.log(`  Project Ref (JWT): ${payload.ref}`);

        if (payload.ref !== EXPECTED_PROJECT_REF) {
            console.error(`  ❌ ERRO: JWT aponta para projeto errado!`);
            console.error(`     Esperado: ${EXPECTED_PROJECT_REF}`);
            console.error(`     Encontrado: ${payload.ref}`);
            hasErrors = true;
        } else {
            console.log(`  ✅ Projeto correto: ${payload.ref}`);
        }

        if (projectId !== EXPECTED_PROJECT_REF) {
            console.error(`  ❌ ERRO: VITE_SUPABASE_PROJECT_ID incorreto!`);
            console.error(`     Esperado: ${EXPECTED_PROJECT_REF}`);
            console.error(`     Encontrado: ${projectId}`);
            hasErrors = true;
        }

        if (!supabaseUrl.includes(EXPECTED_PROJECT_REF)) {
            console.error(`  ❌ ERRO: URL não contém o project ref correto!`);
            hasErrors = true;
        }

    } catch (error) {
        console.error(`  ❌ Erro ao decodificar JWT: ${error.message}`);
        hasErrors = true;
    }

    if (hasErrors) {
        console.error('\n❌ Erros de configuração encontrados!');
        process.exit(1);
    }

    // 3. Testar conexão
    console.log('\n🌐 Testando Conexão com Supabase:');

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    try {
        // Teste simples de conexão
        const { error } = await supabase.from('profiles').select('count').limit(1);

        if (error) {
            console.error(`  ❌ Erro de conexão: ${error.message}`);
            console.error(`     Code: ${error.code}`);
            console.error(`     Details: ${error.details}`);
            process.exit(1);
        }

        console.log('  ✅ Conexão estabelecida com sucesso!');

    } catch (error) {
        console.error(`  ❌ Erro ao testar conexão: ${error.message}`);
        process.exit(1);
    }

    // 4. Resumo
    console.log('\n' + '='.repeat(50));
    console.log('✅ Todas as verificações passaram!');
    console.log('='.repeat(50));
    console.log('\n📝 Próximos passos:');
    console.log('  1. Execute: npm run dev');
    console.log('  2. Teste o login na aplicação');
    console.log('  3. Verifique o DevTools para confirmar o token JWT\n');
}

verifyEnvironment().catch(error => {
    console.error('\n💥 Erro fatal:', error.message);
    process.exit(1);
});
