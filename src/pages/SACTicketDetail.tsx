import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AppLayout } from "@/components/layout/AppLayout";
import { ArrowLeft, CheckCircle, Clock, User, Phone, MapPin, Tag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type TicketStatus = "open" | "pending" | "resolved" | "canceled";
type TicketPriority = "low" | "normal" | "high" | "urgent";

interface SACTicket {
    id: string;
    code: string;
    title: string;
    description: string | null;
    category: string;
    priority: TicketPriority;
    status: TicketStatus;
    contact_name: string | null;
    contact_channel: string | null;
    contact_ref: string | null;
    related_entity: string | null;
    assigned_to: string | null;
    created_by: string | null;
    created_at: string;
    updated_at: string;
    resolved_at: string | null;
}

const statusLabels: Record<TicketStatus, string> = {
    open: "Aberto",
    pending: "Pendente",
    resolved: "Resolvido",
    canceled: "Cancelado",
};

const priorityLabels: Record<TicketPriority, string> = {
    low: "Baixa",
    normal: "Normal",
    high: "Alta",
    urgent: "Urgente",
};

const priorityColors: Record<TicketPriority, string> = {
    low: "bg-gray-500",
    normal: "bg-blue-500",
    high: "bg-orange-500",
    urgent: "bg-red-500",
};

const statusColors: Record<TicketStatus, string> = {
    open: "bg-green-500",
    pending: "bg-yellow-500",
    resolved: "bg-gray-500",
    canceled: "bg-red-500",
};

export default function SACTicketDetail() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { activeTenant } = useTenant();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: ticket, isLoading, error } = useQuery({
        queryKey: ["sac_ticket", id],
        queryFn: async () => {
            if (!id) return null;
            const { data, error } = await supabase
                .from("sac_tickets")
                .select("*")
                .eq("id", id)
                .single();

            if (error) throw error;
            return data as SACTicket;
        },
        enabled: !!id,
    });

    const updateStatusMutation = useMutation({
        mutationFn: async (newStatus: TicketStatus) => {
            if (!id) return;
            const updates: any = {
                status: newStatus,
                updated_at: new Date().toISOString()
            };

            if (newStatus === 'resolved') {
                updates.resolved_at = new Date().toISOString();
            } else if (newStatus === 'pending' || newStatus === 'open') {
                updates.resolved_at = null;
            }

            const { error } = await supabase
                .from("sac_tickets")
                .update(updates)
                .eq("id", id);

            if (error) throw error;
        },
        onSuccess: (_, newStatus) => {
            queryClient.invalidateQueries({ queryKey: ["sac_ticket", id] });
            queryClient.invalidateQueries({ queryKey: ["sac_tickets"] });
            toast({
                title: "Status atualizado",
                description: `Ticket marcado como ${statusLabels[newStatus].toLowerCase()}.`,
            });
        },
        onError: (error: any) => {
            toast({
                title: "Erro ao atualizar status",
                description: error.message,
                variant: "destructive",
            });
        }
    });

    if (isLoading) {
        return (
            <AppLayout>
                <div className="container mx-auto p-6">Carregando detalhes...</div>
            </AppLayout>
        );
    }

    if (error || !ticket) {
        return (
            <AppLayout>
                <div className="container mx-auto p-6">
                    <Button variant="ghost" onClick={() => navigate("/sac")} className="mb-4">
                        <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
                    </Button>
                    <div className="text-center py-12">
                        <h2 className="text-2xl font-bold">Ticket não encontrado</h2>
                        <p className="text-muted-foreground mt-2">O ticket que você está procurando não existe ou foi removido.</p>
                    </div>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <div className="container mx-auto p-6 space-y-6 max-w-4xl">
                <Button variant="ghost" onClick={() => navigate("/sac")} className="mb-2">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Voltar para a listagem
                </Button>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3">
                            <span className="text-sm font-mono text-muted-foreground">{ticket.code}</span>
                            <Badge className={statusColors[ticket.status]}>{statusLabels[ticket.status]}</Badge>
                            <Badge className={priorityColors[ticket.priority]}>{priorityLabels[ticket.priority]}</Badge>
                        </div>
                        <h1 className="text-3xl font-bold">{ticket.title}</h1>
                    </div>

                    <div className="flex items-center gap-2">
                        {ticket.status !== 'resolved' && (
                            <Button
                                onClick={() => updateStatusMutation.mutate('resolved')}
                                disabled={updateStatusMutation.isPending}
                                className="bg-green-600 hover:bg-green-700"
                            >
                                <CheckCircle className="w-4 h-4 mr-2" /> Marcar como Resolvido
                            </Button>
                        )}
                        {ticket.status !== 'pending' && ticket.status !== 'resolved' && (
                            <Button
                                variant="outline"
                                onClick={() => updateStatusMutation.mutate('pending')}
                                disabled={updateStatusMutation.isPending}
                            >
                                <Clock className="w-4 h-4 mr-2" /> Mover para Pendente
                            </Button>
                        )}
                        {ticket.status === 'resolved' && (
                            <Button
                                variant="outline"
                                onClick={() => updateStatusMutation.mutate('open')}
                                disabled={updateStatusMutation.isPending}
                            >
                                Reabrir Ticket
                            </Button>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Main Info */}
                    <Card className="md:col-span-2">
                        <CardHeader>
                            <CardTitle className="text-lg">Descrição</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="whitespace-pre-wrap text-foreground min-h-[100px]">
                                {ticket.description || "Nenhuma descrição fornecida."}
                            </p>
                        </CardContent>
                    </Card>

                    {/* Sidebar Info */}
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-lg">Informações</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex items-start gap-2">
                                    <Tag className="w-4 h-4 mt-1 text-muted-foreground" />
                                    <div>
                                        <p className="text-xs font-medium text-muted-foreground uppercase">Categoria</p>
                                        <p className="text-sm">{ticket.category}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2">
                                    <User className="w-4 h-4 mt-1 text-muted-foreground" />
                                    <div>
                                        <p className="text-xs font-medium text-muted-foreground uppercase">Solicitante</p>
                                        <p className="text-sm">{ticket.contact_name || "Não informado"}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2">
                                    <Phone className="w-4 h-4 mt-1 text-muted-foreground" />
                                    <div>
                                        <p className="text-xs font-medium text-muted-foreground uppercase">Canal / Ref</p>
                                        <p className="text-sm capitalize">{ticket.contact_channel || "—"} {ticket.contact_ref ? `(${ticket.contact_ref})` : ""}</p>
                                    </div>
                                </div>
                                <div className="flex items-start gap-2">
                                    <MapPin className="w-4 h-4 mt-1 text-muted-foreground" />
                                    <div>
                                        <p className="text-xs font-medium text-muted-foreground uppercase">Entidade Relacionada</p>
                                        <p className="text-sm">{ticket.related_entity || "—"}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="pt-6 space-y-2">
                                <div className="flex justify-between text-xs">
                                    <span className="text-muted-foreground">Criado em:</span>
                                    <span>{new Date(ticket.created_at).toLocaleString('pt-BR')}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-muted-foreground">Atualizado em:</span>
                                    <span>{new Date(ticket.updated_at).toLocaleString('pt-BR')}</span>
                                </div>
                                {ticket.resolved_at && (
                                    <div className="flex justify-between text-xs text-green-600 font-medium">
                                        <span>Resolvido em:</span>
                                        <span>{new Date(ticket.resolved_at).toLocaleString('pt-BR')}</span>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
