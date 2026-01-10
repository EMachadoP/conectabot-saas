import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Activity,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Clock,
    Zap,
    RefreshCw,
    Search,
    ExternalLink
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface HealthData {
    id: string;
    team_name: string;
    instance_name: string;
    status: string;
    last_qr_requested_at: string | null;
    last_error: any;
    server_reachable: boolean;
    server_latency_ms: number | null;
    instance_status: string | null;
    last_health_check_at: string | null;
    updated_at: string;
}

export default function WhatsAppHealthDashboard() {
    const [data, setData] = useState<HealthData[]>([]);
    const [loading, setLoading] = useState(true);
    const [lastRefresh, setLastRefresh] = useState(new Date());

    const fetchHealth = async () => {
        setLoading(true);
        try {
            const { data: healthData, error } = await supabase
                .from('v_whatsapp_health' as any)
                .select('*')
                .order('team_name');

            if (error) throw error;
            setData(healthData as unknown as HealthData[]);
            setLastRefresh(new Date());
        } catch (err) {
            console.error('Error fetching health dashboard:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchHealth();
        const interval = setInterval(fetchHealth, 30000); // Auto refresh every 30s
        return () => clearInterval(interval);
    }, []);

    const translateError = (error: any) => {
        if (!error) return null;
        const errStr = JSON.stringify(error).toLowerCase();

        if (errStr.includes("401") || errStr.includes("403") || errStr.includes("unauthorized")) {
            return "Chave de API Inválida ou Expirada";
        }
        if (errStr.includes("404")) {
            return "Instância não encontrada no servidor Evolution";
        }
        if (errStr.includes("timeout") || errStr.includes("fetch failed")) {
            return "Servidor Evolution Offline ou Lento";
        }
        if (errStr.includes("refused")) {
            return "Conexão Recusada pelo Servidor";
        }
        return "Erro Técnico Detalhado no Banco";
    };

    const getStatusColor = (item: HealthData) => {
        if (item.instance_status === 'CONNECTED' || item.status === 'connected') return 'text-green-500';
        if (item.instance_status === 'DISCONNECTED') return 'text-amber-500';
        return 'text-destructive';
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        <Activity className="w-5 h-5 text-primary" />
                        Painel de Saúde Evolution API
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        Monitoramento técnico em tempo real de todas as instâncias do ecossistema.
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-right">
                        <p className="text-[10px] uppercase font-bold text-muted-foreground">Última Atualização</p>
                        <p className="text-xs">{lastRefresh.toLocaleTimeString()}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={fetchHealth} disabled={loading}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                        Sincronizar
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                <Card className="bg-primary/5 border-primary/20">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">Instâncias Ativas</p>
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                        </div>
                        <p className="text-2xl font-bold">{data.filter(d => d.instance_status === 'CONNECTED').length}</p>
                    </CardContent>
                </Card>
                <Card className="bg-amber-500/5 border-amber-500/20">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">Desconectadas</p>
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                        </div>
                        <p className="text-2xl font-bold">{data.filter(d => d.instance_status === 'DISCONNECTED').length}</p>
                    </CardContent>
                </Card>
                <Card className="bg-destructive/5 border-destructive/20">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">Com Erros Criticos</p>
                            <XCircle className="w-4 h-4 text-destructive" />
                        </div>
                        <p className="text-2xl font-bold">{data.filter(d => d.status === 'error' || !d.server_reachable).length}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">Latência Média</p>
                            <Zap className="w-4 h-4 text-blue-500" />
                        </div>
                        <p className="text-2xl font-bold">
                            {Math.round(data.reduce((acc, curr) => acc + (curr.server_latency_ms || 0), 0) / (data.filter(d => d.server_latency_ms).length || 1))}ms
                        </p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-md">Listagem de Tenants & Instâncias</CardTitle>
                    <CardDescription>Dados extraídos diretamente da camada de observabilidade do banco.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ScrollArea className="h-[400px]">
                        <div className="space-y-4">
                            {data.map((item) => (
                                <div key={item.id} className="flex items-center justify-between p-4 border rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className={`p-2 rounded-full bg-background border ${getStatusColor(item)}`}>
                                            {item.instance_status === 'CONNECTED' ? <CheckCircle2 className="w-5 h-5" /> :
                                                item.instance_status === 'DISCONNECTED' ? <AlertTriangle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                                        </div>
                                        <div>
                                            <h4 className="font-semibold text-sm">{item.team_name}</h4>
                                            <p className="text-xs text-muted-foreground">{item.instance_name}</p>
                                        </div>
                                    </div>

                                    <div className="hidden md:grid grid-cols-3 gap-8">
                                        <div className="text-center">
                                            <p className="text-[10px] uppercase font-bold text-muted-foreground">Servidor</p>
                                            <Badge variant={item.server_reachable ? "outline" : "destructive"} className="text-[10px] py-0">
                                                {item.server_reachable ? `${item.server_latency_ms}ms` : 'OFFLINE'}
                                            </Badge>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[10px] uppercase font-bold text-muted-foreground">Último QR</p>
                                            <p className="text-xs">
                                                {item.last_qr_requested_at
                                                    ? formatDistanceToNow(new Date(item.last_qr_requested_at), { addSuffix: true, locale: ptBR })
                                                    : 'Nunca'}
                                            </p>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-[10px] uppercase font-bold text-muted-foreground">Estado</p>
                                            <p className={`text-xs font-bold ${getStatusColor(item)}`}>
                                                {item.instance_status || 'DESCONHECIDO'}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="max-w-[200px] text-right">
                                        {item.last_error ? (
                                            <Badge variant="destructive" className="font-normal text-[9px] h-auto py-1">
                                                {translateError(item.last_error)}
                                            </Badge>
                                        ) : (
                                            <div className="flex items-center gap-1 justify-end text-green-600">
                                                <CheckCircle2 className="w-3 h-3" />
                                                <span className="text-[10px] font-bold">Saudável</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {data.length === 0 && !loading && (
                                <div className="py-12 text-center text-muted-foreground italic">
                                    Nenhuma instância configurada no ecossistema.
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    );
}
