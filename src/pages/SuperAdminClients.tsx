import { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Loader2, Plus, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/contexts/TenantContext';

type WorkspaceOverview = {
  workspace_id: string;
  workspace_name: string;
  workspace_slug: string;
  owner_name: string | null;
  owner_email: string | null;
  members_count: number;
  active_members_count: number;
  subscription_status: string | null;
  plan_name: string | null;
  current_period_end: string | null;
  messages_sent: number | null;
  ai_replies: number | null;
  ai_tokens: number | null;
  created_at: string | null;
};

const formatDate = (value: string | null) => {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('pt-BR');
};

export default function SuperAdminClientsPage() {
  const { toast } = useToast();
  const { activeTenant, refreshTenants, switchTenant } = useTenant();
  const [workspaces, setWorkspaces] = useState<WorkspaceOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingDemo, setCreatingDemo] = useState(false);
  const [resettingWorkspaceId, setResettingWorkspaceId] = useState<string | null>(null);
  const [demoName, setDemoName] = useState('Workspace Demo G7');
  const [workspaceToReset, setWorkspaceToReset] = useState<WorkspaceOverview | null>(null);

  const currentWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.workspace_id === activeTenant?.id) ?? null,
    [activeTenant?.id, workspaces],
  );

  const fetchWorkspaces = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('platform_list_workspaces');
      if (error) throw error;
      setWorkspaces((data ?? []) as WorkspaceOverview[]);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar clientes',
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const handleCreateDemoWorkspace = async () => {
    setCreatingDemo(true);
    try {
      const { data, error } = await supabase.rpc('platform_create_demo_workspace', {
        p_name: demoName,
      });

      if (error) throw error;

      await refreshTenants();
      await supabase.auth.refreshSession();
      await fetchWorkspaces();

      const createdWorkspaceId = (data as { id?: string } | null)?.id;

      toast({
        title: 'Workspace demo criado',
        description: createdWorkspaceId
          ? 'O workspace já está disponível para uso e troca no contexto.'
          : 'O workspace demo foi criado com sucesso.',
      });

      if (createdWorkspaceId) {
        await switchTenant(createdWorkspaceId);
      }
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Falha ao criar workspace demo',
        description: error.message,
      });
    } finally {
      setCreatingDemo(false);
    }
  };

  const handleResetWorkspace = async () => {
    if (!workspaceToReset) return;

    setResettingWorkspaceId(workspaceToReset.workspace_id);
    try {
      const { error } = await supabase.rpc('platform_reset_workspace_integrations', {
        p_workspace_id: workspaceToReset.workspace_id,
      });

      if (error) throw error;

      toast({
        title: 'Integrações limpas',
        description: `${workspaceToReset.workspace_name} voltou para um estado neutro de demonstração.`,
      });

      await fetchWorkspaces();
      setWorkspaceToReset(null);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Falha ao limpar workspace',
        description: error.message,
      });
    } finally {
      setResettingWorkspaceId(null);
    }
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6 overflow-auto h-full">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold">Clientes</h1>
            <p className="text-muted-foreground">
              Gerencie workspaces, crie demos limpas e resete integrações antigas sem abrir o banco.
            </p>
          </div>
          <Button variant="outline" onClick={fetchWorkspaces} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr,2fr]">
          <Card>
            <CardHeader>
              <CardTitle>Workspace Demo</CardTitle>
              <CardDescription>
                Cria um workspace novo, limpo e pronto para demonstração no seu usuário atual.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Nome do demo</label>
                <Input
                  value={demoName}
                  onChange={(event) => setDemoName(event.target.value)}
                  placeholder="Workspace Demo G7"
                />
              </div>
              <Button onClick={handleCreateDemoWorkspace} disabled={creatingDemo || !demoName.trim()}>
                {creatingDemo ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 mr-2" />
                )}
                Criar workspace demo
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Workspace Atual</CardTitle>
              <CardDescription>
                Atalho rápido para o contexto em que você está trabalhando agora.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {currentWorkspace ? (
                <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
                  <div className="space-y-1">
                    <p className="font-semibold">{currentWorkspace.workspace_name}</p>
                    <p className="text-sm text-muted-foreground">{currentWorkspace.owner_email || currentWorkspace.owner_name || 'Sem owner identificado'}</p>
                  </div>
                  <Button
                    variant="destructive"
                    onClick={() => setWorkspaceToReset(currentWorkspace)}
                    disabled={resettingWorkspaceId === currentWorkspace.workspace_id}
                  >
                    {resettingWorkspaceId === currentWorkspace.workspace_id ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4 mr-2" />
                    )}
                    Limpar integrações
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhum workspace ativo selecionado.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Carteira de Clientes</CardTitle>
            <CardDescription>
              Visão geral de planos, uso e owner principal de cada workspace.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Membros</TableHead>
                    <TableHead>Uso do Mês</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workspaces.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                        Nenhum workspace encontrado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    workspaces.map((workspace) => (
                      <TableRow key={workspace.workspace_id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{workspace.workspace_name}</p>
                            <p className="text-xs text-muted-foreground">{workspace.workspace_slug}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm">{workspace.owner_name || '-'}</p>
                            <p className="text-xs text-muted-foreground">{workspace.owner_email || '-'}</p>
                          </div>
                        </TableCell>
                        <TableCell>{workspace.plan_name || '-'}</TableCell>
                        <TableCell>
                          <Badge variant={workspace.subscription_status === 'active' ? 'default' : 'secondary'}>
                            {workspace.subscription_status || 'sem assinatura'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {workspace.active_members_count}/{workspace.members_count}
                        </TableCell>
                        <TableCell>
                          <div className="text-xs space-y-1">
                            <p>Msgs: {workspace.messages_sent ?? 0}</p>
                            <p>IA: {workspace.ai_replies ?? 0}</p>
                            <p>Tokens: {workspace.ai_tokens ?? 0}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs space-y-1">
                            <p>{formatDate(workspace.created_at)}</p>
                            <p className="text-muted-foreground">Renova: {formatDate(workspace.current_period_end)}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setWorkspaceToReset(workspace)}
                            disabled={resettingWorkspaceId === workspace.workspace_id}
                          >
                            {resettingWorkspaceId === workspace.workspace_id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4 text-destructive" />
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <AlertDialog open={Boolean(workspaceToReset)} onOpenChange={(open) => !open && setWorkspaceToReset(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Limpar integrações do workspace?</AlertDialogTitle>
              <AlertDialogDescription>
                Isso remove Z-API, integrações legadas da Evolution, instâncias antigas e zera grupo de notificações do workspace{' '}
                <strong>{workspaceToReset?.workspace_name}</strong>.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleResetWorkspace}>
                Confirmar limpeza
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
