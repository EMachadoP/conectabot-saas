import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/contexts/TenantContext";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { CreateTicketModal } from "@/components/sac/CreateTicketModal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Ticket } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";

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

export default function SAC() {
    const { activeTenant } = useTenant();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<string>("all");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const queryClient = useQueryClient(); // Adicionar useQueryClient import se necessário, mas vou usar refetch da query principal por enquanto.

    const { data: tickets, isLoading } = useQuery({
        queryKey: ["sac_tickets", activeTenant?.id],
        queryFn: async () => {
            if (!activeTenant?.id) return [];

            const { data, error } = await supabase
                .from("sac_tickets")
                .select("*")
                .eq("tenant_id", activeTenant.id)
                .order("created_at", { ascending: false });

            if (error) throw error;
            return data as SACTicket[];
        },
        enabled: !!activeTenant?.id,
    });

    const refetch = () => {
        queryClient.invalidateQueries({ queryKey: ["sac_tickets", activeTenant?.id] });
    };

    const filteredTickets = tickets?.filter((ticket) => {
        if (activeTab === "all") return true;
        if (activeTab === "open") return ticket.status === "open";
        if (activeTab === "pending") return ticket.status === "pending";
        if (activeTab === "resolved") return ticket.status === "resolved";
        return true;
    });

    const ticketCounts = {
        open: tickets?.filter((t) => t.status === "open").length || 0,
        pending: tickets?.filter((t) => t.status === "pending").length || 0,
        resolved: tickets?.filter((t) => t.status === "resolved").length || 0,
        all: tickets?.length || 0,
    };

    return (
        <AppLayout>
            <div className="container mx-auto p-6 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-2">
                            <Ticket className="w-8 h-8" />
                            SAC
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            Gerenciamento de tickets de atendimento ao cliente
                        </p>
                    </div>
                    <Button onClick={() => setIsModalOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Novo Ticket
                    </Button>
                </div>

                {/* Tabs */}
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList>
                        <TabsTrigger value="all">
                            Todos ({ticketCounts.all})
                        </TabsTrigger>
                        <TabsTrigger value="open">
                            Abertos ({ticketCounts.open})
                        </TabsTrigger>
                        <TabsTrigger value="pending">
                            Pendentes ({ticketCounts.pending})
                        </TabsTrigger>
                        <TabsTrigger value="resolved">
                            Resolvidos ({ticketCounts.resolved})
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value={activeTab} className="space-y-4 mt-6">
                        {isLoading ? (
                            <div className="text-center py-12 text-muted-foreground">
                                Carregando tickets...
                            </div>
                        ) : filteredTickets && filteredTickets.length > 0 ? (
                            <div className="grid gap-4">
                                {filteredTickets.map((ticket) => (
                                    <Card
                                        key={ticket.id}
                                        className="hover:shadow-md transition-shadow cursor-pointer"
                                        onClick={() => navigate(`/sac/${ticket.id}`)}
                                    >
                                        <CardHeader>
                                            <div className="flex items-start justify-between">
                                                <div className="space-y-1">
                                                    <CardTitle className="text-lg flex items-center gap-2">
                                                        {ticket.code}
                                                        <Badge className={priorityColors[ticket.priority]}>
                                                            {priorityLabels[ticket.priority]}
                                                        </Badge>
                                                        <Badge className={statusColors[ticket.status]}>
                                                            {statusLabels[ticket.status]}
                                                        </Badge>
                                                    </CardTitle>
                                                    <CardDescription className="text-base font-medium">
                                                        {ticket.title}
                                                    </CardDescription>
                                                </div>
                                                <Badge variant="outline">{ticket.category}</Badge>
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="space-y-2 text-sm text-muted-foreground">
                                                {ticket.description && (
                                                    <p className="line-clamp-2">{ticket.description}</p>
                                                )}
                                                <div className="flex items-center gap-4 flex-wrap">
                                                    {ticket.contact_name && (
                                                        <span>👤 {ticket.contact_name}</span>
                                                    )}
                                                    {ticket.contact_channel && (
                                                        <span>📱 {ticket.contact_channel}</span>
                                                    )}
                                                    {ticket.related_entity && (
                                                        <span>🏢 {ticket.related_entity}</span>
                                                    )}
                                                    <span className="ml-auto">
                                                        {new Date(ticket.created_at).toLocaleDateString("pt-BR", {
                                                            day: "2-digit",
                                                            month: "short",
                                                            year: "numeric",
                                                            hour: "2-digit",
                                                            minute: "2-digit",
                                                        })}
                                                    </span>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        ) : (
                            <Card>
                                <CardContent className="py-12 text-center text-muted-foreground">
                                    <Ticket className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                    <p className="text-lg font-medium">Nenhum ticket encontrado</p>
                                    <p className="text-sm mt-1">
                                        {activeTab === "all"
                                            ? "Crie seu primeiro ticket clicando em 'Novo Ticket'"
                                            : `Não há tickets ${activeTab === "open" ? "abertos" : activeTab === "pending" ? "pendentes" : "resolvidos"} no momento`}
                                    </p>
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>
                </Tabs>
            </div>

            <CreateTicketModal
                open={isModalOpen}
                onOpenChange={setIsModalOpen}
                onSuccess={() => {
                    refetch();
                }}
            />
        </AppLayout>
    );
}
