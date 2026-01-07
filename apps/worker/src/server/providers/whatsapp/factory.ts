import { WhatsAppProvider } from './types.js';
import { EvolutionProvider } from './evolution.js';
import { MockProvider } from './mock.js';
import { supabase } from '../../../supabase.js';

/**
 * Resolves the correct WhatsApp provider for a given tenant.
 * If evolution integration is enabled and configured, returns EvolutionProvider.
 * Otherwise, falls back to MockProvider.
 */
export async function getTenantProvider(tenantId: string): Promise<WhatsAppProvider> {
    try {
        const { data, error } = await supabase
            .from('tenant_integrations')
            .select('*')
            .eq('tenant_id', tenantId)
            .eq('provider', 'evolution')
            .maybeSingle();

        if (error) {
            console.error(`[FACTORY] Error fetching integration for tenant ${tenantId}:`, error.message);
            return new MockProvider();
        }

        if (data && data.is_enabled && data.base_url && data.api_key && data.instance_name) {
            console.log(`[FACTORY] Using EvolutionProvider for tenant ${tenantId}`);
            return new EvolutionProvider({
                baseUrl: data.base_url,
                apiKey: data.api_key,
                instance: data.instance_name
            });
        }

        console.log(`[FACTORY] Falling back to MockProvider for tenant ${tenantId} (No active config)`);
        return new MockProvider();
    } catch (err: any) {
        console.error(`[FACTORY] Fatal error resolving provider for tenant ${tenantId}:`, err.message);
        return new MockProvider();
    }
}
