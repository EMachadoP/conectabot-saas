import { WhatsAppProvider } from './types.js';

export class MockProvider implements WhatsAppProvider {
    async sendText({ to, text, metadata }: { to: string; text: string; metadata?: any }) {
        console.log(`[MOCK] Sending text to ${to} (Metadata: ${JSON.stringify(metadata)}): ${text}`);
        await new Promise(resolve => setTimeout(resolve, 300));
        return { ok: true, provider_message_id: `mock-text-${Date.now()}`, http_status: 200 };
    }

    async sendGroupText({ groupId, text, metadata }: { groupId: string; text: string; metadata?: any }) {
        console.log(`[MOCK] Sending text to Group ${groupId} (Metadata: ${JSON.stringify(metadata)}): ${text}`);
        await new Promise(resolve => setTimeout(resolve, 300));
        return { ok: true, provider_message_id: `mock-group-${Date.now()}`, http_status: 200 };
    }
}
