import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useToast } from '@/hooks/use-toast';

export interface WATarget {
    id: string;
    team_id: string;
    type: 'person' | 'group';
    jid: string;
    display_name: string;
    phone_e164?: string | null;
    source: 'sync' | 'manual';
    last_seen_at?: string | null;
    created_at: string;
    updated_at: string;
}

export function useWATargets() {
    const { activeTenant } = useTenant(); // Note: activeTenant actually contains team info
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Get team_id from profile
    const { data: profile } = useQuery({
        queryKey: ['profile'],
        queryFn: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return null;

            const { data } = await supabase
                .from('profiles')
                .select('team_id')
                .eq('id', user.id)
                .single();

            return data;
        },
    });

    const teamId = profile?.team_id;

    const { data: targets = [], isLoading } = useQuery({
        queryKey: ['wa_targets', teamId],
        queryFn: async () => {
            if (!teamId) return [];

            const { data, error } = await supabase
                .from('wa_targets')
                .select('*')
                .eq('team_id', teamId)
                .order('source', { ascending: false }) // sync first, then manual
                .order('display_name');

            if (error) throw error;
            return data as WATarget[];
        },
        enabled: !!teamId,
    });

    const syncMutation = useMutation({
        mutationFn: async () => {
            const { data, error } = await supabase.functions.invoke('sync-wa-contacts');
            if (error) throw error;
            return data;
        },
        onSuccess: (data) => {
            toast({
                title: 'Sincronização concluída',
                description: `${data.synced} contatos/grupos sincronizados.`,
            });
            queryClient.invalidateQueries({ queryKey: ['wa_targets', teamId] });
        },
        onError: (error: any) => {
            toast({
                variant: 'destructive',
                title: 'Erro na sincronização',
                description: error.message,
            });
        },
    });

    const addManualMutation = useMutation({
        mutationFn: async ({ phone, display_name }: { phone: string; display_name?: string }) => {
            const { data, error } = await supabase.functions.invoke('add-manual-target', {
                body: { phone, display_name }
            });
            if (error) throw error;
            return data;
        },
        onSuccess: (data) => {
            toast({
                title: 'Número adicionado',
                description: `${data.target.display_name} foi adicionado aos contatos.`,
            });
            queryClient.invalidateQueries({ queryKey: ['wa_targets', teamId] });
        },
        onError: (error: any) => {
            toast({
                variant: 'destructive',
                title: 'Erro ao adicionar número',
                description: error.message,
            });
        },
    });

    return {
        targets,
        isLoading,
        sync: syncMutation.mutate,
        isSyncing: syncMutation.isPending,
        addManualTarget: addManualMutation.mutate,
        isAddingManual: addManualMutation.isPending,
    };
}
