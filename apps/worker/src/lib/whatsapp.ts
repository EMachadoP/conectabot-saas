import { WhatsAppProvider } from '../server/providers/whatsapp/types.js';
import { MockProvider } from '../server/providers/whatsapp/mock.js';
import { EvolutionProvider } from '../server/providers/whatsapp/evolution.js';

export const getWhatsAppProvider = (): WhatsAppProvider => {
    const providerType = process.env.WHATSAPP_PROVIDER || 'mock';
    return providerType === 'evolution' ? new EvolutionProvider() : new MockProvider();
};

export * from '../server/providers/whatsapp/types.js';
