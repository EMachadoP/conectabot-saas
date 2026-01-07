import { z } from 'zod';
import { supabase } from './supabase.js';
import { redis, REDIS_KEYS, REDIS_CONFIG, redisUtils } from './redis.js';
import { EvolutionProvider } from './server/providers/whatsapp/evolution.js';
import { MockProvider } from './provider.mock.js';

// Minimal payload schema (from dispatcher)
export const QueueItemSchema = z.object({
    recipient_id: z.string().uuid(),
    reminder_id: z.string().uuid(),
    team_id: z.string().uuid(),
    attempt_no: z.number(),
    idempotency_key: z.string(),
    enqueued_at: z.string().optional(),
});

export type QueueItem = z.infer<typeof QueueItemSchema>;

// Backoff schedule: 1, 3, 7, 15 minutes
function getBackoffMinutes(attemptNo: number): number {
    const backoffMap: Record<number, number> = {
        1: 1,
        2: 3,
        3: 7,
        4: 15,
    };
    return backoffMap[attemptNo] || 15; // Default to 15 if beyond map
}

// Classify error as retryable or not
function classifyError(httpStatus: number | null, error: string): { retryable: boolean; reason: string } {
    const errorLower = (error || '').toLowerCase();

    // Retryable: timeout, network, 429, 5xx
    if (
        httpStatus === 429 ||
        (httpStatus && httpStatus >= 500) ||
        errorLower.includes('timeout') ||
        errorLower.includes('fetch') ||
        errorLower.includes('network')
    ) {
        return { retryable: true, reason: error || 'Retryable error' };
    }

    // Non-retryable: 400, 401, 403, 404, invalid
    if (
        httpStatus === 400 ||
        httpStatus === 401 ||
        httpStatus === 403 ||
        httpStatus === 404 ||
        errorLower.includes('invalid') ||
        errorLower.includes('not found')
    ) {
        return { retryable: false, reason: error || 'Non-retryable error' };
    }

    // Default: non-retryable
    return { retryable: false, reason: error || 'Unknown error' };
}

export async function processJob(item: any) {
    const validation = QueueItemSchema.safeParse(item);
    if (!validation.success) {
        console.error('[WORKER] Invalid queue item payload:', validation.error.format());
        return true; // Ack to remove from queue
    }

    const payload = validation.data;
    const { recipient_id, reminder_id, team_id, attempt_no, idempotency_key } = payload;

    console.log(`[WORKER] Processing recipient ${recipient_id} (attempt ${attempt_no})`);

    // 1. LOCK: Acquire recipient-level lock
    const lockKey = `lock:reminder:recipient:${recipient_id}`;
    const locked = await redis.set(lockKey, '1', { ex: 60, nx: true });

    if (!locked) {
        console.log(`[WORKER] Recipient ${recipient_id} is already being processed. Skipping.`);
        return true; // Ack to avoid reprocessing
    }

    try {
        // 2. IDEMPOTENCY: Fetch recipient and check status
        const { data: recipient, error: recipientError } = await supabase
            .from('reminder_recipients')
            .select('*')
            .eq('id', recipient_id)
            .eq('team_id', team_id)
            .single();

        if (recipientError || !recipient) {
            console.error(`[WORKER] Recipient ${recipient_id} not found:`, recipientError);
            return true; // Ack
        }

        // Guard: if already in final state, skip
        if (['sent', 'failed', 'dlq'].includes(recipient.status)) {
            console.log(`[WORKER] Recipient ${recipient_id} already in final state: ${recipient.status}. Skipping.`);

            // Optional: log as 'ignored'
            await supabase.from('reminder_attempt_logs').insert({
                tenant_id: team_id, // Using team_id as tenant_id (adjust if needed)
                job_id: reminder_id,
                target_id: recipient_id,
                target_ref: recipient.jid,
                attempt_no,
                result: 'ignored',
                provider: 'n/a',
                error: `Already in final state: ${recipient.status}`,
                retryable: false,
            }).then(({ error }) => {
                if (error) console.error('[WORKER] Error logging ignored attempt:', error);
            });

            return true; // Ack
        }

        // Guard: if not queued, skip (dispatcher may have reprocessed)
        if (recipient.status !== 'queued') {
            console.log(`[WORKER] Recipient ${recipient_id} status is ${recipient.status}, not 'queued'. Skipping.`);
            return true; // Ack
        }

        // 3. FETCH DATA: Get reminder and wa_instance
        const { data: reminder, error: reminderError } = await supabase
            .from('reminder_jobs')
            .select('*, calendar_events(title, description, start_at)')
            .eq('id', reminder_id)
            .eq('tenant_id', team_id) // Assuming reminder_jobs has tenant_id = team_id
            .single();

        if (reminderError || !reminder) {
            console.error(`[WORKER] Reminder ${reminder_id} not found:`, reminderError);

            // Mark recipient as failed
            await supabase.from('reminder_recipients').update({
                status: 'failed',
                last_attempt_at: new Date().toISOString(),
                last_error: 'Reminder not found',
            }).eq('id', recipient_id);

            return true; // Ack
        }

        const { data: instance, error: instanceError } = await supabase
            .from('wa_instances')
            .select('*')
            .eq('team_id', team_id)
            .single();

        // If no instance or error, use MockProvider
        let provider;
        let providerName = 'mock';

        if (!instance || instanceError || instance.status !== 'connected') {
            console.warn(`[WORKER] No connected wa_instance for team ${team_id}. Using MockProvider.`);
            provider = new MockProvider();
        } else {
            provider = new EvolutionProvider({
                baseUrl: instance.evolution_base_url,
                apiKey: instance.evolution_api_key,
                instance: instance.evolution_instance_key,
            });
            providerName = 'evolution';
        }

        // 4. BUILD MESSAGE: Apply placeholders
        const eventTitle = reminder.calendar_events?.title || 'Evento';
        const eventDate = reminder.calendar_events?.start_at
            ? new Date(reminder.calendar_events.start_at).toLocaleDateString('pt-BR')
            : '';
        const eventTime = reminder.calendar_events?.start_at
            ? new Date(reminder.calendar_events.start_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
            : '';

        let messageText = `🔔 *Lembrete: ${eventTitle}*\n\n📅 ${eventDate} às ${eventTime}\n\n${reminder.calendar_events?.description || ''}`;

        // Apply placeholders (if message_content exists in reminder)
        // messageText = messageText.replace('{title}', eventTitle).replace('{date}', eventDate).replace('{time}', eventTime);

        // 5. SEND MESSAGE
        let result;
        const isGroup = recipient.type === 'group';

        if (isGroup) {
            result = await provider.sendGroupText({
                groupId: recipient.jid,
                text: messageText,
                metadata: { team_id },
            });
        } else {
            result = await provider.sendText({
                to: recipient.jid,
                text: messageText,
                metadata: { team_id },
            });
        }

        // 6. CLASSIFY RESULT
        let logResult: 'success' | 'retry_scheduled' | 'failed' | 'dlq' = 'success';
        let recipientStatus: 'sent' | 'retry_scheduled' | 'failed' | 'dlq' = 'sent';
        let nextAttemptAt: string | null = null;
        let errorSummary: string | null = null;
        let retryable = false;
        const httpStatus = result.http_status || null;

        if (result.ok) {
            logResult = 'success';
            recipientStatus = 'sent';
        } else {
            const classification = classifyError(httpStatus, result.error || 'Unknown error');
            errorSummary = classification.reason;
            retryable = classification.retryable;

            const newAttemptCount = recipient.attempt_count + 1;
            const maxAttempts = reminder.max_attempts || 12;

            if (retryable && newAttemptCount < maxAttempts) {
                // Retry with backoff
                logResult = 'retry_scheduled';
                recipientStatus = 'retry_scheduled';
                const backoffMin = getBackoffMinutes(newAttemptCount);
                nextAttemptAt = new Date(Date.now() + backoffMin * 60000).toISOString();
            } else if (newAttemptCount >= maxAttempts) {
                // Max attempts reached -> DLQ
                logResult = 'dlq';
                recipientStatus = 'dlq';
            } else {
                // Non-retryable -> Failed
                logResult = 'failed';
                recipientStatus = 'failed';
            }
        }

        // 7. LOG ATTEMPT (always)
        const { error: logError } = await supabase.from('reminder_attempt_logs').insert({
            tenant_id: team_id, // or use tenant_id if different from team_id
            job_id: reminder_id,
            target_id: recipient_id,
            target_ref: recipient.jid,
            attempt_no,
            result: logResult,
            provider: providerName,
            http_status: httpStatus,
            error: errorSummary,
            response_json: result.raw || result,
            retryable,
            ack_token: null, // TODO: implement ACK logic if needed
        });

        if (logError) {
            console.error(`[WORKER] Error logging attempt for recipient ${recipient_id}:`, logError);
            // Don't fail the worker, just log
        }

        // 8. UPDATE RECIPIENT
        if (recipientStatus === 'sent') {
            await supabase.from('reminder_recipients').update({
                status: 'sent',
                last_sent_at: new Date().toISOString(),
                last_attempt_at: new Date().toISOString(),
                last_error: null,
            }).eq('id', recipient_id).eq('team_id', team_id);

        } else if (recipientStatus === 'retry_scheduled') {
            const newAttemptCount = recipient.attempt_count + 1;
            await supabase.from('reminder_recipients').update({
                status: 'retry_scheduled',
                attempt_count: newAttemptCount,
                last_attempt_at: new Date().toISOString(),
                next_attempt_at: nextAttemptAt,
                last_error: errorSummary,
            }).eq('id', recipient_id).eq('team_id', team_id);

        } else if (recipientStatus === 'failed') {
            await supabase.from('reminder_recipients').update({
                status: 'failed',
                last_attempt_at: new Date().toISOString(),
                next_attempt_at: null,
                last_error: errorSummary,
            }).eq('id', recipient_id).eq('team_id', team_id);

        } else if (recipientStatus === 'dlq') {
            await supabase.from('reminder_recipients').update({
                status: 'dlq',
                last_attempt_at: new Date().toISOString(),
                next_attempt_at: null,
                last_error: errorSummary,
            }).eq('id', recipient_id).eq('team_id', team_id);

            // 9. PUSH TO DLQ
            try {
                await redis.lpush('reminder:dlq', JSON.stringify({
                    payload_original: payload,
                    error_summary: errorSummary,
                    http_status: httpStatus,
                    provider: providerName,
                    at: new Date().toISOString(),
                }));
                console.log(`[WORKER] Recipient ${recipient_id} pushed to reminder:dlq`);
            } catch (dlqError) {
                console.error(`[WORKER] Error pushing to DLQ:`, dlqError);
            }
        }

        // 10. OBSERVABILITY
        console.log(`[WORKER] team_id=${team_id} recipient_id=${recipient_id} provider=${providerName} result=${logResult} http_status=${httpStatus} retryable=${retryable}`);

        return true; // Ack

    } catch (error) {
        console.error(`[WORKER] Fatal error processing recipient ${recipient_id}:`, error);
        return true; // Ack to avoid infinite loop
    } finally {
        // Release lock
        await redis.del(lockKey);
    }
}
