import { useEffect, useMemo, useRef, useState } from "react";
import { useTenant } from "@/contexts/TenantContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, QrCode, RefreshCcw, Power, RotateCcw, Copy, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";


type HealthResponse = {
    ok: boolean;
    team_id: string;
    provider: "evolution";
    server?: { reachable: boolean; latency_ms?: number; http_status?: number; base_url_masked?: string };
    instance?: { configured: boolean; key?: string; status?: string; details?: any };
    auth?: { valid: boolean; http_status?: number };
    error?: string;
};

type QrResponse =
    | { ok: true; status: "READY"; team_id: string; instance_key: string; qr: { type: "image_base64" | "text"; value: string }; raw?: any }
    | { ok: true; status: "PENDING"; team_id: string; instance_key: string; raw?: any }
    | { ok: false; status?: "ERROR"; error: string; details?: any };

type SessionAction = "disconnect" | "restart";
type SessionResponse = { ok: boolean; action?: SessionAction; response?: any; error?: string; details?: any };

function statusLabel(health: HealthResponse | null) {
    if (!health) return "UNKNOWN";
    if (health.error === "NOT_CONFIGURED") return "NOT_CONFIGURED";

    const configured = health.instance?.configured;
    if (!configured) return "NOT_CONFIGURED";

    const authValid = health.auth?.valid;
    if (authValid === false) return "AUTH_INVALID";

    const st = (health.instance?.status ?? "UNKNOWN").toUpperCase();
    if (st.includes("CONNECTED")) return "CONNECTED";
    if (st.includes("DISCONNECTED")) return "DISCONNECTED";
    if (st.includes("NOT_FOUND")) return "NOT_FOUND";
    return st || "UNKNOWN";
}

function badgeVariantByStatus(st: string) {
    if (st === "CONNECTED") return "default";
    if (st === "DISCONNECTED") return "secondary";
    if (st === "NOT_CONFIGURED" || st === "AUTH_INVALID" || st === "NOT_FOUND") return "destructive";
    return "outline";
}

function StatusIcon({ st }: { st: string }) {
    if (st === "CONNECTED") return <CheckCircle2 className="h-4 w-4" />;
    if (st === "DISCONNECTED") return <AlertTriangle className="h-4 w-4" />;
    if (st === "NOT_CONFIGURED" || st === "AUTH_INVALID" || st === "NOT_FOUND") return <XCircle className="h-4 w-4" />;
    return <AlertTriangle className="h-4 w-4" />;
}

async function callEdge<T>(fn: string, body: any): Promise<T> {
    const { data, error } = await supabase.functions.invoke(fn, { body });
    if (error) throw error;
    return data as T;
}

export default function WhatsAppSessionCard({ refreshKey }: { refreshKey?: number }) {
    const { activeTenant } = useTenant();
    const teamId = activeTenant?.id || null;
    const { toast } = useToast();

    const [health, setHealth] = useState<HealthResponse | null>(null);
    const [healthLoading, setHealthLoading] = useState(false);

    const [qr, setQr] = useState<{ type: "image_base64" | "text"; value: string } | null>(null);
    const [qrLoading, setQrLoading] = useState(false);

    const [actionLoading, setActionLoading] = useState<SessionAction | null>(null);

    const [polling, setPolling] = useState(false);
    const pollingTimerRef = useRef<number | null>(null);
    const pollingDeadlineRef = useRef<number | null>(null);

    const st = useMemo(() => statusLabel(health), [health]);

    const stopPolling = () => {
        setPolling(false);
        if (pollingTimerRef.current) window.clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
        pollingDeadlineRef.current = null;
    };

    const fetchHealth = async (silent = false) => {
        if (!teamId) return;
        try {
            setHealthLoading(true);
            const res = await callEdge<HealthResponse>("evolution-health", { team_id: teamId });
            setHealth(res);
            if (!silent) {
                toast({ title: "Status atualizado", description: `Estado: ${statusLabel(res)}` });
            }
            return res;
        } catch (e: any) {
            if (!silent) toast({ title: "Erro ao consultar status", description: e.message ?? String(e), variant: "destructive" });
            return null;
        } finally {
            setHealthLoading(false);
        }
    };

    const generateQr = async (attempt = 1) => {
        if (!teamId) {
            toast({ title: "Sem team ativo", description: "Selecione um tenant/team para continuar.", variant: "destructive" });
            return;
        }
        try {
            if (attempt === 1) {
                setQrLoading(true);
                setQr(null);
            }

            const res = await callEdge<QrResponse>("evolution-qr", { team_id: teamId });

            if (!res.ok || (res as any).status === "ERROR") {
                toast({
                    title: "Falha ao gerar QR",
                    description: (res as any).error || "Erro desconhecido",
                    variant: "destructive"
                });
                setQrLoading(false);
                return;
            }

            if ((res as any).status === "PENDING") {
                if (attempt < 5) {
                    console.log(`[WhatsAppSessionCard] QR PENDING, retrying (attempt ${attempt + 1}/5)...`);
                    setTimeout(() => generateQr(attempt + 1), 3000);
                    return;
                } else {
                    toast({
                        title: "QR Code demorando",
                        description: "A Evolution ainda está gerando o QR. Tente clicar em Gerar QR novamente em alguns instantes.",
                        variant: "default"
                    });
                    setQrLoading(false);
                    return;
                }
            }

            // Caso seja status "READY" ou formato antigo (ok: true sem status)
            const qrData = (res as any).qr;
            if (qrData) {
                setQr(qrData);
                toast({ title: "QR gerado", description: "Abra o WhatsApp Business e escaneie quando estiver com o telefone." });
                startPolling();
            } else {
                // Se der ok mas não vier QR e não for PENDING
                console.warn("[WhatsAppSessionCard] QR READY but no data", res);
                toast({ title: "QR não encontrado", description: "A resposta do servidor foi positiva mas sem dados de QR.", variant: "destructive" });
            }
        } catch (e: any) {
            toast({ title: "Erro ao gerar QR", description: e.message ?? String(e), variant: "destructive" });
        } finally {
            // Only set loading to false if we are not scheduling a retry
            if (!((res as any)?.status === "PENDING" && attempt < 5)) {
                setQrLoading(false);
            }
        }
    };

    const startPolling = async () => {
        stopPolling();
        setPolling(true);
        pollingDeadlineRef.current = Date.now() + 90_000;

        const first = await fetchHealth(true);
        if (first && statusLabel(first) === "CONNECTED") {
            stopPolling();
            toast({ title: "Conectado!", description: "A instância Evolution está CONNECTED." });
            return;
        }

        pollingTimerRef.current = window.setInterval(async () => {
            if (!pollingDeadlineRef.current) return;

            if (Date.now() > pollingDeadlineRef.current) {
                stopPolling();
                toast({
                    title: "Polling encerrado",
                    description: "Não conectou em 90s. Se ainda estiver DISCONNECTED, gere um novo QR e tente novamente.",
                    variant: "destructive",
                });
                return;
            }

            const res = await fetchHealth(true);
            if (!res) return;

            const s = statusLabel(res);
            if (s === "CONNECTED") {
                stopPolling();
                toast({ title: "Conectado!", description: "A instância Evolution está CONNECTED." });
            }
        }, 3000);
    };

    const sessionAction = async (action: SessionAction) => {
        if (!teamId) return;
        try {
            setActionLoading(action);
            const res = await callEdge<SessionResponse>("evolution-session", { team_id: teamId, action });
            if (!res.ok) {
                toast({ title: "Falha na ação", description: res.error ?? "Erro", variant: "destructive" });
                return;
            }
            toast({ title: "Ação executada", description: `Ação: ${action}` });
            setQr(null);
            stopPolling();
            await fetchHealth(true);
        } catch (e: any) {
            toast({ title: "Erro", description: e.message ?? String(e), variant: "destructive" });
        } finally {
            setActionLoading(null);
        }
    };

    const copyJson = async (obj: any) => {
        try {
            await navigator.clipboard.writeText(JSON.stringify(obj, null, 2));
            toast({ title: "Copiado", description: "JSON copiado para a área de transferência." });
        } catch {
            toast({ title: "Não foi possível copiar", description: "Copie manualmente.", variant: "destructive" });
        }
    };

    useEffect(() => {
        if (teamId) fetchHealth(true);
        return () => stopPolling();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [teamId, refreshKey]);

    const infoText = useMemo(() => {
        if (st === "NOT_CONFIGURED") return "Configure a Evolution (base_url, api_key e instance_key) na aba WhatsApp para este team.";
        if (st === "AUTH_INVALID") return "API Key inválida (401/403). Verifique a credencial configurada.";
        if (st === "NOT_FOUND") return "Instância não encontrada. Verifique instance_key ou crie a instância no servidor Evolution.";
        if (st === "DISCONNECTED") return "Instância desconectada. Gere o QR e escaneie pelo WhatsApp Business.";
        if (st === "CONNECTED") return "Tudo certo. Instância conectada e pronta para envio/recebimento.";
        return "Status desconhecido. Atualize o status e verifique o JSON de diagnóstico.";
    }, [st]);

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
                <div className="space-y-1">
                    <CardTitle className="text-lg">Sessão WhatsApp (Evolution)</CardTitle>
                    <div className="flex items-center gap-2">
                        <Badge variant={badgeVariantByStatus(st) as any} className="flex items-center gap-1">
                            <StatusIcon st={st} />
                            {st}
                        </Badge>

                        {polling && (
                            <Badge variant="outline" className="flex items-center gap-1">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                Aguardando conexão…
                            </Badge>
                        )}
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button variant="secondary" size="sm" onClick={() => fetchHealth()} disabled={healthLoading || !teamId}>
                        {healthLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                    </Button>

                    <Button size="sm" onClick={generateQr} disabled={qrLoading || !teamId || st === "NOT_CONFIGURED"}>
                        {qrLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                        <span className="ml-2">Gerar QR</span>
                    </Button>

                    <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => sessionAction("disconnect")}
                        disabled={actionLoading !== null || !teamId}
                    >
                        {actionLoading === "disconnect" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
                    </Button>

                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => sessionAction("restart")}
                        disabled={actionLoading !== null || !teamId}
                    >
                        {actionLoading === "restart" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                <Alert>
                    <AlertTitle>Diagnóstico</AlertTitle>
                    <AlertDescription>{infoText}</AlertDescription>
                </Alert>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div className="rounded-md border p-3">
                        <div className="text-sm font-medium">Servidor</div>
                        <div className="mt-1 text-sm text-muted-foreground">
                            {health?.server?.reachable ? "Reachable" : "Não alcançável"}
                            {typeof health?.server?.latency_ms === "number" ? ` • ${health.server.latency_ms}ms` : ""}
                        </div>
                    </div>

                    <div className="rounded-md border p-3">
                        <div className="text-sm font-medium">Instância</div>
                        <div className="mt-1 text-sm text-muted-foreground">
                            {health?.instance?.configured ? "Configurada" : "Não configurada"}
                            {health?.instance?.key ? ` • ${health.instance.key}` : ""}
                        </div>
                    </div>

                    <div className="rounded-md border p-3">
                        <div className="text-sm font-medium">Autenticação</div>
                        <div className="mt-1 text-sm text-muted-foreground">
                            {health?.auth?.valid ? "Válida" : "Inválida"}
                        </div>
                    </div>
                </div>

                <Separator />

                {qr ? (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <div>
                                <div className="font-medium">QR / Pairing</div>
                                <div className="text-sm text-muted-foreground">
                                    Escaneie no WhatsApp Business quando estiver com o telefone.
                                </div>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => copyJson({ qr, health })}>
                                <Copy className="h-4 w-4" />
                            </Button>
                        </div>

                        {qr.type === "image_base64" ? (
                            <div className="flex justify-center">
                                <div className="rounded-lg border bg-background p-4">
                                    <img src={qr.value} alt="QR Code" className="h-64 w-64" />
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-lg border bg-background p-4">
                                <div className="text-sm text-muted-foreground mb-2">Pairing code / QR string</div>
                                <code className="block whitespace-pre-wrap break-all text-sm">{qr.value}</code>
                                <div className="mt-3">
                                    <Button variant="secondary" size="sm" onClick={() => navigator.clipboard.writeText(qr.value)}>
                                        <Copy className="h-4 w-4 mr-2" />
                                        Copiar
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-sm text-muted-foreground">
                        Nenhum QR gerado ainda. Clique em <span className="font-medium">Gerar QR</span>.
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
