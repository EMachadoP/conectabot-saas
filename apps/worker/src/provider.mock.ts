export interface WhatsAppResult {
    success: boolean;
    messageId?: string;
    error?: string;
}

export class MockProvider {
    async sendText(to: string, text: string, tenant_id: string): Promise<WhatsAppResult> {
        console.log(`[MOCK] Sending text to ${to} (Tenant: ${tenant_id}): ${text}`);
        // Simulate network delay
        await new Promise(resolve => setTimeout(resolve, 300));
        return { success: true, messageId: `mock-text-${Date.now()}` };
    }

    async sendToGroup(groupId: string, text: string, tenant_id: string): Promise<WhatsAppResult> {
        console.log(`[MOCK] Sending text to Group ${groupId} (Tenant: ${tenant_id}): ${text}`);
        await new Promise(resolve => setTimeout(resolve, 300));
        return { success: true, messageId: `mock-group-${Date.now()}` };
    }
}
