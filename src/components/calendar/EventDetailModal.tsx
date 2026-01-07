import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
    Calendar as CalendarIcon,
    Clock,
    Users,
    CheckCircle2,
    XCircle,
    History,
    Info,
    ExternalLink,
    MessageSquare,
    AlertCircle,
    Loader2,
    Trash2,
    Copy,
    Check,
    User
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useToast } from '@/hooks/use-toast';
import { formatPhoneDisplay } from '@/lib/phone-utils';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

interface EventDetailModalProps {
    eventId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

export function EventDetailModal({ eventId, open, onOpenChange, onSuccess }: EventDetailModalProps) {
    const { activeTenant } = useTenant();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [event, setEvent] = useState<any>(null);
    const [job, setJob] = useState<any>(null);
    const [recipients, setRecipients] = useState<any[]>([]);
    const [logs, setLogs] = useState<any[]>([]);
    const [actionLoading, setActionLoading] = useState(false);

    const fetchData = async () => {
        if (!eventId || !activeTenant) return;
        setLoading(true);

        try {
            // 1. Fetch Event with team_id
            const { data: eventData } = await supabase
                .from('calendar_events')
                .select('*, team_id:tenant_id')
                .eq('id', eventId)
                .single();

            setEvent(eventData);

            // 2. Fetch Job
            const { data: jobData } = await supabase
                .from('reminder_jobs')
                .select('*')
                .eq('event_id', eventId)
                .single();

            setJob(jobData);

            // 3. Fetch Recipients from reminder_recipients (if job exists)
            if (jobData?.id) {
                // Get team_id from profile for filtering
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('team_id')
                        .eq('id', user.id)
                        .single();

                    const teamId = profile?.team_id;

                    // Fetch recipients with team_id filter (RLS will also apply)
                    const { data: recipientsData } = await supabase
                        .from('reminder_recipients')
                        .select('*')
                        .eq('reminder_id', jobData.id)
                        .eq('team_id', teamId)
                        .order('created_at', { ascending: true });

                    setRecipients(recipientsData || []);
                }
            } else {
                setRecipients([]);
            }

            // 4. Fetch Logs
            const { data: logsData } = await supabase
                .from('reminder_attempt_logs')
                .select('*')
                .eq('job_id', jobData?.id)
                .order('created_at', { ascending: false });

            setLogs(logsData || []);

        } catch (error) {
            console.error('Error fetching event details:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (open && eventId) {
            fetchData();
        }
    }, [open, eventId]);

    const handleUpdateJobStatus = async (newStatus: string) => {
        if (!job) return;
        setActionLoading(true);

        try {
            const updates: any = { status: newStatus };
            if (newStatus === 'done') {
                updates.ack_received_at = new Date().toISOString();
            }

            const { error } = await supabase
                .from('reminder_jobs')
                .update(updates)
                .eq('id', job.id);

            if (error) throw error;

            toast({ title: 'Status atualizado', description: `Lembrete marcado como ${newStatus}.` });
            fetchData();
            if (onSuccess) onSuccess();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Erro', description: error.message });
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeleteEvent = async () => {
        if (!confirm('Tem certeza que deseja excluir este evento e todos os lembretes associados?')) return;
        setActionLoading(true);

        try {
            const { error } = await supabase
                .from('calendar_events')
                .delete()
                .eq('id', eventId);

            if (error) throw error;

            toast({ title: 'Evento excluído' });
            onOpenChange(false);
            if (onSuccess) onSuccess();
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Erro', description: error.message });
        } finally {
            setActionLoading(false);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast({ title: 'Copiado!', description: 'Comando de confirmação copiado para a área de transferência.' });
    };

    const getLatestTokenForTarget = (targetJid: string) => {
        const latestLog = logs.find(l => l.target_ref === targetJid && l.ack_token);
        return latestLog?.ack_token;
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'scheduled': return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Agendado</Badge>;
            case 'running': return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 animate-pulse">Enviando...</Badge>;
            case 'waiting_ack': return <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">Aguardando Resposta</Badge>;
            case 'done': return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Concluído</Badge>;
            case 'canceled': return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">Cancelado</Badge>;
            case 'failed': return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Falhou</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
                {loading ? (
                    <div className="p-12 flex flex-col items-center justify-center gap-4">
                        <Loader2 className="w-10 h-10 animate-spin text-primary" />
                        <p className="text-muted-foreground">Carregando detalhes do evento...</p>
                    </div>
                ) : (
                    <>
                        <DialogHeader className="p-6 pb-2">
                            <div className="flex items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <DialogTitle className="text-xl flex items-center gap-2">
                                        {event?.title}
                                        {job && getStatusBadge(job.status)}
                                    </DialogTitle>
                                    <p className="text-sm text-muted-foreground">
                                        {event?.description || 'Sem descrição.'}
                                    </p>
                                </div>
                                <Button variant="ghost" size="sm" className="text-destructive h-8" onClick={handleDeleteEvent} disabled={actionLoading}>
                                    <Trash2 className="w-4 h-4 mr-1" /> Excluir
                                </Button>
                            </div>
                        </DialogHeader>

                        <ScrollArea className="flex-1">
                            <div className="p-6 space-y-6">
                                {/* Event Info Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-muted/30 p-4 rounded-lg flex items-start gap-3">
                                        <CalendarIcon className="w-5 h-5 text-primary mt-0.5" />
                                        <div>
                                            <p className="text-xs font-semibold uppercase text-muted-foreground">Horário</p>
                                            <p className="text-sm font-medium">
                                                {event?.start_at && format(new Date(event.start_at), "eeee, d 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                                            </p>
                                            {event?.end_at && (
                                                <p className="text-xs text-muted-foreground mt-1">
                                                    Fim: {format(new Date(event.end_at), "HH:mm")}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {job && (
                                        <div className="bg-muted/30 p-4 rounded-lg flex items-start gap-3">
                                            <Clock className="w-5 h-5 text-primary mt-0.5" />
                                            <div>
                                                <p className="text-xs font-semibold uppercase text-muted-foreground">Status do Lembrete</p>
                                                <p className="text-sm font-medium">
                                                    {job.attempts} tentativas de {job.max_attempts}
                                                </p>
                                                {job.next_attempt_at && (job.status === 'scheduled' || job.status === 'waiting_ack') && (
                                                    <p className="text-xs text-muted-foreground mt-1">
                                                        Próximo disparo: {format(new Date(job.next_attempt_at), "HH:mm")}
                                                    </p>
                                                )}
                                                {job.ack_received_at && (
                                                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                                                        <CheckCircle2 className="w-3 h-3" /> Confirmado em {format(new Date(job.ack_received_at), "HH:mm")}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Targets */}
                                <div className="space-y-3">
                                    <h3 className="text-sm font-semibold flex items-center gap-2">
                                        <Users className="w-4 h-4" /> Destinatários ({targets.length})
                                    </h3>
                                    <div className="grid gap-2">
                                        {targets.map((target, idx) => {
                                            const token = getLatestTokenForTarget(target.jid);
                                            return (
                                                <div key={idx} className="flex flex-col p-3 border rounded-md text-sm bg-background/50">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="flex items-center gap-3">
                                                            <MessageSquare className="w-4 h-4 text-muted-foreground" />
                                                            <div>
                                                                <span className="font-semibold">{target.target_name}</span>
                                                                <span className="text-muted-foreground ml-2 text-xs font-mono">
                                                                    {target.jid}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <Badge variant="outline" className="text-[10px] capitalize">
                                                            {target.target_type === 'person' ? 'Pessoa' : 'Grupo'}
                                                        </Badge>
                                                    </div>

                                                    {token && (job?.status === 'waiting_ack' || job?.status === 'scheduled') && (
                                                        <div className="flex items-center justify-between mt-1 p-2 bg-primary/5 rounded border border-primary/10">
                                                            <div className="flex flex-col">
                                                                <span className="text-[10px] uppercase font-bold text-primary/70">Comando de Confirmação</span>
                                                                <code className="text-xs font-mono font-bold text-primary">OK {token}</code>
                                                            </div>
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-7 w-7 p-0"
                                                                onClick={() => copyToClipboard(`OK ${token}`)}
                                                                title="Copiar comando"
                                                            >
                                                                <Copy className="w-3.5 h-3.5" />
                                                            </Button>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <Separator />

                                {/* Execution Logs */}
                                <div className="space-y-3">
                                    <h3 className="text-sm font-semibold flex items-center gap-2">
                                        <History className="w-4 h-4" /> Logs de Execução
                                    </h3>
                                    {logs.length === 0 ? (
                                        <div className="p-8 border border-dashed rounded-lg text-center text-sm text-muted-foreground">
                                            Nenhum disparo realizado ainda.
                                        </div>
                                    ) : (
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead className="w-[80px]">Tent.</TableHead>
                                                    <TableHead>Hora</TableHead>
                                                    <TableHead>Resultado</TableHead>
                                                    <TableHead>Provedor</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {logs.map((log, idx) => (
                                                    <TableRow key={idx} className="text-sm">
                                                        <TableCell>#{log.attempt_no}</TableCell>
                                                        <TableCell>{format(new Date(log.fired_at), "HH:mm:ss")}</TableCell>
                                                        <TableCell>
                                                            {log.result === 'success' ? (
                                                                <span className="text-green-600 flex items-center gap-1">
                                                                    <CheckCircle2 className="w-3 h-3" /> Sucesso
                                                                </span>
                                                            ) : (
                                                                <span className="text-red-600 flex items-center gap-1" title={log.error}>
                                                                    <AlertCircle className="w-3 h-3" /> Erro
                                                                </span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="capitalize">{log.provider}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    )}
                                </div>
                            </div>
                        </ScrollArea>

                        <DialogFooter className="p-6 border-t bg-muted/20">
                            <div className="flex flex-wrap gap-2 w-full justify-end">
                                {job && (job.status === 'waiting_ack' || job.status === 'scheduled' || job.status === 'running') && (
                                    <>
                                        <Button
                                            variant="outline"
                                            className="text-destructive hover:bg-destructive/10"
                                            onClick={() => handleUpdateJobStatus('canceled')}
                                            disabled={actionLoading}
                                        >
                                            <XCircle className="w-4 h-4 mr-2" /> Cancelar Lembretes
                                        </Button>
                                        <Button
                                            className="bg-green-600 hover:bg-green-700"
                                            onClick={() => handleUpdateJobStatus('done')}
                                            disabled={actionLoading}
                                        >
                                            <CheckCircle2 className="w-4 h-4 mr-2" /> Finalizar (Confirmado)
                                        </Button>
                                    </>
                                )}
                                <Button variant="secondary" onClick={() => onOpenChange(false)}>
                                    Fechar
                                </Button>
                            </div>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
