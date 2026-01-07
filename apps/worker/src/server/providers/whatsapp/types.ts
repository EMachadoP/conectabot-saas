export interface WhatsAppProvider {
    sendText(params: { to: string; text: string; metadata?: any }): Promise<{ ok: boolean; provider_message_id?: string; raw?: any; error?: string; shouldRetry?: boolean; http_status?: number }>;
    sendGroupText(params: { groupId: string; text: string; metadata?: any }): Promise<{ ok: boolean; provider_message_id?: string; raw?: any; error?: string; shouldRetry?: boolean; http_status?: number }>;
}
