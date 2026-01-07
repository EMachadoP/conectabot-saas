import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
    Calendar as CalendarIcon,
    Clock,
    Users,
    Plus,
    Trash2,
    Loader2,
    Info
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/contexts/TenantContext';
import { useToast } from '@/hooks/use-toast';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { WATargetSelector } from './WATargetSelector';
import { WATarget } from '@/hooks/useWATargets';


const formSchema = z.object({
    title: z.string().min(1, 'Título é obrigatório'),
    description: z.string().optional(),
    start_at: z.date({ required_error: 'Início é obrigatório' }),
    end_at: z.date().optional(),
    timezone: z.string().default('America/Recife'),
    reminder_offset: z.coerce.number().default(30),
    repeat_every: z.coerce.number().default(10),
    max_attempts: z.coerce.number().default(12),
    ack_required: z.boolean().default(true),
});

type FormValues = z.infer<typeof formSchema>;

interface Target {
    id: string;
    waTarget?: WATarget;
}

interface CreateEventModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
}

export function CreateEventModal({ open, onOpenChange, onSuccess }: CreateEventModalProps) {
    const { user } = useAuth();
    const { activeTenant } = useTenant();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [targets, setTargets] = useState<Target[]>([
        { id: crypto.randomUUID() }
    ]);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            title: '',
            description: '',
            start_at: new Date(),
            timezone: 'America/Recife',
            reminder_offset: 30,
            repeat_every: 10,
            max_attempts: 12,
            ack_required: true,
        },
    });

    const addTarget = () => {
        setTargets([...targets, { id: crypto.randomUUID() }]);
    };

    const removeTarget = (id: string) => {
        if (targets.length > 1) {
            setTargets(targets.filter(t => t.id !== id));
        }
    };

    const updateTarget = (id: string, waTarget: WATarget | undefined) => {
        setTargets(targets.map(t => t.id === id ? { ...t, waTarget } : t));
    };

    async function onSubmit(values: any) {
        if (!activeTenant || !user) return;

        // Validate targets
        const validTargets = targets.filter(t => t.waTarget);
        if (validTargets.length === 0) {
            toast({ variant: 'destructive', title: 'Atenção', description: 'Adicione pelo menos um destinatário válido.' });
            return;
        }

        setLoading(true);

        try {
            // Get team_id from profile
            const { data: profile } = await supabase
                .from('profiles')
                .select('team_id')
                .eq('id', user.id)
                .single();

            const teamId = profile?.team_id;
            if (!teamId) throw new Error('Team not found');

            // 1. Insert Event
            const { data: event, error: eventError } = await supabase
                .from('calendar_events')
                .insert({
                    tenant_id: activeTenant.id,
                    title: values.title,
                    description: values.description,
                    start_at: values.start_at.toISOString(),
                    end_at: values.end_at?.toISOString(),
                    timezone: values.timezone,
                    created_by: user.id,
                })
                .select()
                .single();

            if (eventError) throw eventError;

            // 2. Insert Reminder Job
            const firstFireAt = new Date(values.start_at);
            firstFireAt.setMinutes(firstFireAt.getMinutes() - values.reminder_offset);

            const { data: job, error: jobError } = await supabase
                .from('reminder_jobs')
                .insert({
                    tenant_id: activeTenant.id,
                    event_id: event.id,
                    first_fire_at: firstFireAt.toISOString(),
                    next_attempt_at: firstFireAt.toISOString(),
                    repeat_every_minutes: values.repeat_every,
                    max_attempts: values.max_attempts,
                    ack_required: values.ack_required,
                    status: 'scheduled',
                })
                .select()
                .single();

            if (jobError) throw jobError;

            // 3. Insert Recipients (new table for multi-recipient support)
            const { error: recipientsError } = await supabase
                .from('reminder_recipients')
                .insert(
                    validTargets.map(t => ({
                        reminder_id: job.id,
                        team_id: teamId,
                        type: t.waTarget!.type,
                        jid: t.waTarget!.jid,
                        display_name: t.waTarget!.display_name,
                        phone_e164: t.waTarget!.phone_e164,
                    }))
                );

            if (recipientsError) throw recipientsError;

            // 4. Also insert to reminder_targets for backward compatibility
            const { error: targetsError } = await supabase
                .from('reminder_targets')
                .insert(
                    validTargets.map(t => ({
                        team_id: teamId,
                        event_id: event.id,
                        target_type: t.waTarget!.type,
                        target_name: t.waTarget!.display_name,
                        jid: t.waTarget!.jid,
                    }))
                );

            if (targetsError) throw targetsError;

            toast({ title: 'Sucesso', description: 'Evento e lembretes agendados!' });
            onOpenChange(false);
            form.reset();
            setTargets([{ id: crypto.randomUUID() }]);
            if (onSuccess) onSuccess();

        } catch (error: any) {
            console.error('Error creating event:', error);
            toast({ variant: 'destructive', title: 'Erro', description: error.message });
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Novo Evento e Lembrete</DialogTitle>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="title"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Título *</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Ex: Reunião de Alinhamento" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="description"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Descrição</FormLabel>
                                            <FormControl>
                                                <Textarea placeholder="Detalhes do compromisso..." {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="grid grid-cols-2 gap-2">
                                    <FormField
                                        control={form.control}
                                        name="start_at"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-col">
                                                <FormLabel>Data e Hora Início</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="datetime-local"
                                                        className="bg-background"
                                                        value={field.value instanceof Date ? format(field.value, "yyyy-MM-dd'T'HH:mm") : ''}
                                                        onChange={(e) => field.onChange(new Date(e.target.value))}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="end_at"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-col">
                                                <FormLabel>Data e Hora Fim</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="datetime-local"
                                                        className="bg-background"
                                                        value={field.value instanceof Date ? format(field.value, "yyyy-MM-dd'T'HH:mm") : ''}
                                                        onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>

                            <div className="space-y-4 border-l pl-4 border-muted">
                                <div className="flex items-center gap-2 mb-2 font-semibold text-sm">
                                    <Clock className="w-4 h-4 text-primary" />
                                    Configurações de Lembrete
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <FormField
                                        control={form.control}
                                        name="reminder_offset"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs">Disparar X min antes</FormLabel>
                                                <FormControl>
                                                    <Input type="number" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="repeat_every"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs">Repetir a cada (min)</FormLabel>
                                                <FormControl>
                                                    <Input type="number" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <FormField
                                        control={form.control}
                                        name="max_attempts"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="text-xs">Máx. de tentativas</FormLabel>
                                                <FormControl>
                                                    <Input type="number" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="ack_required"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-col gap-2 mt-4">
                                                <FormLabel className="text-xs">Exigir Confirmação?</FormLabel>
                                                <FormControl>
                                                    <Switch
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>

                                <p className="text-[10px] text-muted-foreground flex items-start gap-1">
                                    <Info className="w-3 h-3 mt-0.5 shrink-0" />
                                    Se a confirmação for ligada, o lembrete repete até alguém responder.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 font-semibold text-sm">
                                    <Users className="w-4 h-4 text-primary" />
                                    Destinatários do Lembrete
                                </div>
                                <Button type="button" variant="outline" size="sm" onClick={addTarget}>
                                    <Plus className="w-3 h-3 mr-1" /> Add
                                </Button>
                            </div>

                            <div className="space-y-2">
                                {targets.map((target) => (
                                    <div key={target.id} className="flex gap-2 items-center bg-muted/30 p-3 rounded-md">
                                        <div className="flex-1">
                                            <WATargetSelector
                                                value={target.waTarget}
                                                onChange={(waTarget) => updateTarget(target.id, waTarget)}
                                                placeholder="Buscar contato ou grupo..."
                                            />
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="h-10 text-destructive px-2"
                                            onClick={() => removeTarget(target.id)}
                                            disabled={targets.length === 1}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                                Cancelar
                            </Button>
                            <Button type="submit" disabled={loading}>
                                {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                                Salvar Evento e Lembretes
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
