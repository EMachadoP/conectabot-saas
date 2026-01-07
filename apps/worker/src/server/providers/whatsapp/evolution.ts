import { WhatsAppProvider } from './types.js';
import { MockProvider } from './mock.js';
import { supabase } from '../../../supabase.js';

export class EvolutionProvider implements WhatsAppProvider {
    private mockFallback: MockProvider;
    private config: { baseUrl: string; apiKey: string; instance: string };

    constructor(config: { baseUrl: string; apiKey: string; instance: string }) {
        this.mockFallback = new MockProvider();
        this.config = config;
    }

    private isReady(): boolean {
        return !!(this.config.baseUrl && this.config.apiKey && this.config.instance);
    }

    async sendText({ to, text, metadata }: { to: string; text: string; metadata?: any }) {
        if (!this.isReady()) {
            console.warn(`[EVOLUTION] No active integration found for tenant ${metadata?.tenant_id}. Falling back to Mock.`);
            return this.mockFallback.sendText({ to, text, metadata });
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        try {
            console.log(`[EVOLUTION] Sending text to ${to} (Instance: ${this.config.instance})`);

            const response = await fetch(`${this.config.baseUrl}/message/sendText/${this.config.instance}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': this.config.apiKey
                },
                body: JSON.stringify({
                    number: to,
                    text: text,
                    linkPreview: false
                }),
                signal: controller.signal
            });

            const data = await response.json();
            clearTimeout(timeout);

            if (!response.ok) {
                // Rules: 429/5xx -> retryable (ok: false, shouldRetry: true)
                // 400/401/403 -> non-retryable (ok: false, shouldRetry: false)
                const isRetryable = response.status === 429 || response.status >= 500;

                return {
                    ok: false,
                    error: data.message || `HTTP ${response.status}`,
                    raw: data,
                    shouldRetry: isRetryable,
                    http_status: response.status
                };
            }

            return {
                ok: true,
                provider_message_id: data.key?.id || data.message?.key?.id,
                raw: data,
                http_status: response.status
            };
        } catch (error: any) {
            clearTimeout(timeout);
            const isTimeout = error.name === 'AbortError';
            console.error(`[EVOLUTION] Error sending text to ${to}:`, isTimeout ? 'Timeout' : error.message);

            return {
                ok: false,
                error: isTimeout ? 'Request Timeout (15s)' : error.message,
                shouldRetry: true,
                http_status: isTimeout ? 408 : 500
            };
        }
    }

    async sendGroupText({ groupId, text, metadata }: { groupId: string; text: string; metadata?: any }) {
        if (!this.isReady()) {
            console.warn(`[EVOLUTION] No active integration found for tenant ${metadata?.tenant_id}. Falling back to Mock.`);
            return this.mockFallback.sendGroupText({ groupId, text, metadata });
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        try {
            console.log(`[EVOLUTION] Sending text to Group ${groupId} (Instance: ${this.config.instance})`);

            const response = await fetch(`${this.config.baseUrl}/message/sendText/${this.config.instance}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': this.config.apiKey
                },
                body: JSON.stringify({
                    number: groupId,
                    text: text,
                    linkPreview: false
                }),
                signal: controller.signal
            });

            const data = await response.json();
            clearTimeout(timeout);

            if (!response.ok) {
                const isRetryable = response.status === 429 || response.status >= 500;
                return {
                    ok: false,
                    error: data.message || `HTTP ${response.status}`,
                    raw: data,
                    shouldRetry: isRetryable,
                    http_status: response.status
                };
            }

            return {
                ok: true,
                provider_message_id: data.key?.id || data.message?.key?.id,
                raw: data,
                http_status: response.status
            };
        } catch (error: any) {
            clearTimeout(timeout);
            const isTimeout = error.name === 'AbortError';
            console.error(`[EVOLUTION] Error sending to group ${groupId}:`, isTimeout ? 'Timeout' : error.message);

            return {
                ok: false,
                error: isTimeout ? 'Request Timeout (15s)' : error.message,
                shouldRetry: true,
                http_status: isTimeout ? 408 : 500
            };
        }
    }
}
