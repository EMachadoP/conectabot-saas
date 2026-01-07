import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/contexts/TenantContext';
import { useAuth } from '@/hooks/useAuth';

interface CreateTicketModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess: () => void;
}

export function CreateTicketModal({ open, onOpenChange, onSuccess }: CreateTicketModalProps) {
    const { activeTenant } = useTenant();
    const { user } = useAuth();
    const { toast } = useToast();

    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        priority: 'normal',
        contact_name: '',
        contact_channel: 'whatsapp',
        contact_ref: '',
        related_entity: '',
        category: 'SAC'
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeTenant || !user) return;

        setLoading(true);
        try {
            // 1. Obter próximo código via RPC
            const { data: code, error: codeError } = await supabase.rpc('next_sac_code');

            if (codeError) throw codeError;

            // 2. Inserir ticket
            const { error: insertError } = await supabase
                .from('sac_tickets')
                .insert({
                    tenant_id: activeTenant.id,
                    code,
                    title: formData.title,
                    description: formData.description || null,
                    priority: formData.priority,
                    status: 'open',
                    contact_name: formData.contact_name || null,
                    contact_channel: formData.contact_channel || null,
                    contact_ref: formData.contact_ref || null,
                    related_entity: formData.related_entity || null,
                    category: formData.category,
                    created_by: user.id
                });

            if (insertError) throw insertError;

            toast({
                title: 'Ticket criado com sucesso',
                description: `Código: ${code}`,
            });

            onSuccess();
            onOpenChange(false);
            resetForm();
        } catch (error: any) {
            console.error('Error creating ticket:', error);
            toast({
                title: 'Erro ao criar ticket',
                description: error.message || 'Ocorreu um erro inesperado',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setFormData({
            title: '',
            description: '',
            priority: 'normal',
            contact_name: '',
            contact_channel: 'whatsapp',
            contact_ref: '',
            related_entity: '',
            category: 'SAC'
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Novo Ticket SAC</DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="title">Título *</Label>
                        <Input
                            id="title"
                            required
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            placeholder="Ex: Problema no portão"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="priority">Prioridade</Label>
                            <Select
                                value={formData.priority}
                                onValueChange={(val) => setFormData({ ...formData, priority: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="low">Baixa</SelectItem>
                                    <SelectItem value="normal">Normal</SelectItem>
                                    <SelectItem value="high">Alta</SelectItem>
                                    <SelectItem value="urgent">Urgente</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="category">Categoria</Label>
                            <Input
                                id="category"
                                value={formData.category}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Descrição</Label>
                        <Textarea
                            id="description"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Detalhes sobre a solicitação..."
                            className="resize-none h-24"
                        />
                    </div>

                    <div className="border-t pt-4 mt-4">
                        <h3 className="text-sm font-medium mb-3">Dados de Contato</h3>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="contact_name">Nome do Solicitante</Label>
                                <Input
                                    id="contact_name"
                                    value={formData.contact_name}
                                    onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                                    placeholder="Nome completo"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="contact_channel">Canal</Label>
                                    <Select
                                        value={formData.contact_channel}
                                        onValueChange={(val) => setFormData({ ...formData, contact_channel: val })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="whatsapp">WhatsApp</SelectItem>
                                            <SelectItem value="email">E-mail</SelectItem>
                                            <SelectItem value="phone">Telefone</SelectItem>
                                            <SelectItem value="web">Web/Portal</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="contact_ref">Referência (Ex: Apt 12)</Label>
                                    <Input
                                        id="contact_ref"
                                        value={formData.contact_ref}
                                        onChange={(e) => setFormData({ ...formData, contact_ref: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="related_entity">Entidade Relacionada (Ex: Condomínio X)</Label>
                                <Input
                                    id="related_entity"
                                    value={formData.related_entity}
                                    onChange={(e) => setFormData({ ...formData, related_entity: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? 'Criando...' : 'Criar Ticket'}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
