import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
    Calendar as CalendarIcon,
    Clock,
    Users,
    Plus,
    CheckCircle2,
    XCircle,
    ChevronRight,
    CalendarDays,
    MoreVertical,
    Loader2,
    AlertCircle
} from 'lucide-react';
import { format, isToday, isTomorrow, startOfDay, endOfDay, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/contexts/TenantContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { CreateEventModal } from '@/components/calendar/CreateEventModal';
import { EventDetailModal } from '@/components/calendar/EventDetailModal';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function CalendarPage() {
    const { user, loading: authLoading } = useAuth();
    const { activeTenant } = useTenant();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

    const { data: events, isLoading } = useQuery({
        queryKey: ['calendar_events', activeTenant?.id],
        queryFn: async () => {
            if (!activeTenant) return [];

            const start = startOfDay(new Date()).toISOString();
            const end = endOfDay(addDays(new Date(), 7)).toISOString();

            const { data, error } = await supabase
                .from('calendar_events')
                .select(`
                  *,
                  reminder_jobs (status)
                `)
                .eq('tenant_id', activeTenant.id)
                .gte('start_at', start)
                .lte('start_at', end)
                .order('start_at', { ascending: true });

            if (error) throw error;
            return data;
        },
        enabled: !!activeTenant
    });

    const handleUpdateStatus = async (eventId: string, newStatus: string) => {
        try {
            const { error } = await supabase
                .from('calendar_events')
                .update({ status: newStatus })
                .eq('id', eventId);

            if (error) throw error;

            toast({ title: 'Sucesso', description: `Evento ${newStatus === 'done' ? 'concluído' : 'cancelado'}.` });
            queryClient.invalidateQueries({ queryKey: ['calendar_events', activeTenant?.id] });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Erro', description: error.message });
        }
    };

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="animate-spin h-8 w-8 text-primary" />
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/auth" replace />;
    }

    const todayEvents = events?.filter(e => isToday(new Date(e.start_at))) || [];
    const upcomingEvents = events?.filter(e => !isToday(new Date(e.start_at))) || [];

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'scheduled': return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Agendado</Badge>;
            case 'done': return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Concluído</Badge>;
            case 'canceled': return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">Cancelado</Badge>;
            default: return <Badge variant="outline">{status}</Badge>;
        }
    };

    const EventCard = ({ event }: { event: any }) => (
        <Card key={event.id} className="group hover:shadow-md transition-all border-l-4 border-l-primary/50">
            <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                    <div className="flex gap-4">
                        <div className="flex flex-col items-center justify-center min-w-[50px] bg-muted/50 rounded-lg p-2 h-fit">
                            <span className="text-xs uppercase font-bold text-muted-foreground">
                                {format(new Date(event.start_at), "MMM", { locale: ptBR })}
                            </span>
                            <span className="text-xl font-black">
                                {format(new Date(event.start_at), "dd")}
                            </span>
                        </div>

                        <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-bold text-lg leading-tight group-hover:text-primary transition-colors">
                                    {event.title}
                                </h3>
                                {getStatusBadge(event.status)}
                            </div>

                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                                <div className="flex items-center gap-1">
                                    <Clock className="w-3.5 h-3.5" />
                                    {format(new Date(event.start_at), "HH:mm")}
                                </div>
                                {event.location && (
                                    <div className="flex items-center gap-1">
                                        <Users className="w-3.5 h-3.5" />
                                        {event.location}
                                    </div>
                                )}
                            </div>

                            {event.description && (
                                <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                                    {event.description}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-1">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <MoreVertical className="w-4 h-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => {
                                    setSelectedEventId(event.id);
                                    setIsDetailModalOpen(true);
                                }}>
                                    <ChevronRight className="w-4 h-4 mr-2" /> Detalhes / Lembretes
                                </DropdownMenuItem>
                                {event.status === 'scheduled' && (
                                    <>
                                        <DropdownMenuItem className="text-green-600" onClick={() => handleUpdateStatus(event.id, 'done')}>
                                            <CheckCircle2 className="w-4 h-4 mr-2" /> Marcar como Concluído
                                        </DropdownMenuItem>
                                        <DropdownMenuItem className="text-destructive" onClick={() => handleUpdateStatus(event.id, 'canceled')}>
                                            <XCircle className="w-4 h-4 mr-2" /> Cancelar Evento
                                        </DropdownMenuItem>
                                    </>
                                )}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </CardContent>
        </Card>
    );

    return (
        <AppLayout>
            <div className="p-6 space-y-8 overflow-auto h-full max-w-5xl mx-auto">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h1 className="text-3xl font-black tracking-tight">Agenda</h1>
                        <p className="text-muted-foreground flex items-center gap-2">
                            <CalendarDays className="w-4 h-4" />
                            {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
                        </p>
                    </div>
                    <Button onClick={() => setIsCreateModalOpen(true)} className="shadow-lg shadow-primary/20">
                        <Plus className="w-4 h-4 mr-2" />
                        Novo evento
                    </Button>
                </div>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                        <p className="text-muted-foreground">Carregando seus compromissos...</p>
                    </div>
                ) : (
                    <div className="space-y-10">
                        {/* TODAY SECTION */}
                        <section className="space-y-4">
                            <div className="flex items-center gap-2">
                                <Badge className="bg-primary text-primary-foreground font-bold">HOJE</Badge>
                                <Separator className="flex-1" />
                            </div>

                            {todayEvents.length === 0 ? (
                                <div className="text-center py-8 border border-dashed rounded-xl bg-muted/20">
                                    <p className="text-sm text-muted-foreground">Nenhum compromisso para hoje.</p>
                                </div>
                            ) : (
                                <div className="grid gap-4">
                                    {todayEvents.map(event => (
                                        <EventCard key={event.id} event={event} />
                                    ))}
                                </div>
                            )}
                        </section>

                        {/* UPCOMING SECTION */}
                        <section className="space-y-4">
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="font-bold">PRÓXIMA SEMANA</Badge>
                                <Separator className="flex-1" />
                            </div>

                            {upcomingEvents.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground italic text-sm">
                                    Nenhum outro compromisso agendado para os próximos 7 dias.
                                </div>
                            ) : (
                                <div className="grid gap-4">
                                    {upcomingEvents.map(event => (
                                        <EventCard key={event.id} event={event} />
                                    ))}
                                </div>
                            )}
                        </section>
                    </div>
                )}

                {!isLoading && events?.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
                            <CalendarIcon className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <div className="space-y-1">
                            <h2 className="text-xl font-bold">Sua agenda está vazia</h2>
                            <p className="text-muted-foreground max-w-xs">
                                Comece agendando seu primeiro evento com lembretes automáticos.
                            </p>
                        </div>
                        <Button variant="outline" onClick={() => setIsCreateModalOpen(true)}>
                            Criar primeiro evento
                        </Button>
                    </div>
                )}
            </div>

            <CreateEventModal
                open={isCreateModalOpen}
                onOpenChange={setIsCreateModalOpen}
                onSuccess={() => queryClient.invalidateQueries({ queryKey: ['calendar_events', activeTenant?.id] })}
            />

            <EventDetailModal
                open={isDetailModalOpen}
                onOpenChange={setIsDetailModalOpen}
                eventId={selectedEventId}
                onSuccess={() => queryClient.invalidateQueries({ queryKey: ['calendar_events', activeTenant?.id] })}
            />
        </AppLayout>
    );
}
