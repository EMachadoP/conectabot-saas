import { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { ArrowRightCircle, Loader2, Plus, RefreshCw, Shield, Sparkles, Trash2, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/contexts/TenantContext';
import { FunctionsHttpError } from '@supabase/supabase-js';

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

type MemberRole = 'owner' | 'admin' | 'agent';

type WorkspaceMember = {
  membership_id: string;
  workspace_id: string;
  user_id: string | null;
  role: MemberRole;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
  profile_email: string | null;
  profile_name: string | null;
  profile_display_name: string | null;
  avatar_url: string | null;
};

const memberRoleLabels: Record<MemberRole, string> = {
  owner: 'Owner',
  admin: 'Administrador',
  agent: 'Usuário',
};

const formatDate = (value: string | null) => {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('pt-BR');
};

export default function SuperAdminClientsPage() {
  const { toast } = useToast();
  const { activeTenant, refreshTenants, switchTenant, tenants } = useTenant();
  const [workspaces, setWorkspaces] = useState<WorkspaceOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingDemo, setCreatingDemo] = useState(false);
  const [accessingWorkspaceId, setAccessingWorkspaceId] = useState<string | null>(null);
  const [archivingWorkspaceId, setArchivingWorkspaceId] = useState<string | null>(null);
  const [resettingWorkspaceId, setResettingWorkspaceId] = useState<string | null>(null);
  const [trialWorkspaceId, setTrialWorkspaceId] = useState<string | null>(null);
  const [trialDays, setTrialDays] = useState('5');
  const [demoName, setDemoName] = useState('Workspace Demo G7');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'trialing' | 'inactive'>('all');
  const [membersOpen, setMembersOpen] = useState(false);
  const [membersLoading, setMembersLoading] = useState(false);
  const [selectedWorkspaceMembers, setSelectedWorkspaceMembers] = useState<WorkspaceMember[]>([]);
  const [workspaceToManage, setWorkspaceToManage] = useState<WorkspaceOverview | null>(null);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'agent'>('agent');
  const [invitingMember, setInvitingMember] = useState(false);
  const [directUserName, setDirectUserName] = useState('');
  const [directUserEmail, setDirectUserEmail] = useState('');
  const [directUserPassword, setDirectUserPassword] = useState('');
  const [directUserRole, setDirectUserRole] = useState<'admin' | 'agent'>('agent');
  const [creatingDirectUser, setCreatingDirectUser] = useState(false);
  const [workspaceToReset, setWorkspaceToReset] = useState<WorkspaceOverview | null>(null);
  const [workspaceToArchive, setWorkspaceToArchive] = useState<WorkspaceOverview | null>(null);
  const [workspaceToTrial, setWorkspaceToTrial] = useState<WorkspaceOverview | null>(null);

  const currentWorkspace = useMemo(
    () => workspaces.find((workspace) => workspace.workspace_id === activeTenant?.id) ?? null,
    [activeTenant?.id, workspaces],
  );

  const accessibleWorkspaceIds = useMemo(
    () => new Set(tenants.map((tenant) => tenant.id)),
    [tenants],
  );

  const filteredWorkspaces = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return workspaces.filter((workspace) => {
      const status = (workspace.subscription_status ?? '').toLowerCase();
      const matchesStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'inactive'
          ? !status || ['canceled', 'past_due', 'unpaid'].includes(status)
          : status === statusFilter;

      if (!matchesStatus) return false;

      if (!query) return true;

      return [
        workspace.workspace_name,
        workspace.workspace_slug,
        workspace.owner_name,
        workspace.owner_email,
      ]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query));
    });
  }, [searchTerm, statusFilter, workspaces]);

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

  const handleAccessWorkspace = async (workspace: WorkspaceOverview) => {
    if (workspace.workspace_id === activeTenant?.id) {
      toast({
        title: 'Workspace já ativo',
        description: `Você já está operando no contexto de ${workspace.workspace_name}.`,
      });
      return;
    }

    if (!accessibleWorkspaceIds.has(workspace.workspace_id)) {
      toast({
        variant: 'destructive',
        title: 'Sem acesso operacional',
        description: `Sua conta ainda não é membro do workspace ${workspace.workspace_name}. Adicione seu usuário como admin ou owner na equipe do cliente para operar o sistema por dentro.`,
      });
      return;
    }

    setAccessingWorkspaceId(workspace.workspace_id);
    await switchTenant(workspace.workspace_id);
    setAccessingWorkspaceId(null);
  };

  const loadWorkspaceMembers = async (workspace: WorkspaceOverview) => {
    setMembersLoading(true);
    setWorkspaceToManage(workspace);
    setMembersOpen(true);

    try {
      const { data, error } = await supabase.rpc('platform_list_workspace_members', {
        p_workspace_id: workspace.workspace_id,
      });

      if (error) throw error;

      setSelectedWorkspaceMembers((data ?? []) as WorkspaceMember[]);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar usuários',
        description: error.message,
      });
    } finally {
      setMembersLoading(false);
    }
  };

  const handleInviteMember = async () => {
    if (!workspaceToManage) return;

    if (!inviteEmail.trim()) {
      toast({
        variant: 'destructive',
        title: 'Informe um e-mail',
        description: 'Preencha o e-mail do usuário que será convidado.',
      });
      return;
    }

    setInvitingMember(true);
    const { data, error } = await supabase.functions.invoke('invite-user', {
      body: {
        email: inviteEmail.trim(),
        role: inviteRole,
        workspace_id: workspaceToManage.workspace_id,
      },
    });
    setInvitingMember(false);

    if (error) {
      let description = error.message;

      if (error instanceof FunctionsHttpError) {
        try {
          const response = await error.context.json();
          description = response?.error || description;
        } catch {
          // Keep generic description if the body isn't JSON
        }
      }

      toast({
        variant: 'destructive',
        title: 'Falha ao enviar convite',
        description,
      });
      return;
    }

    toast({
      title: 'Convite enviado',
      description:
        data && typeof data === 'object' && 'mode' in data && data.mode === 'existing_user'
          ? `${inviteEmail.trim()} já tinha conta e foi vinculado(a) ao cliente ${workspaceToManage.workspace_name}.`
          : `${inviteEmail.trim()} foi adicionado(a) ao cliente ${workspaceToManage.workspace_name}.`,
    });
    setInviteEmail('');
    setInviteRole('agent');
    await loadWorkspaceMembers(workspaceToManage);
    await fetchWorkspaces();
  };

  const handleCreateDirectMember = async () => {
    if (!workspaceToManage) return;

    if (!directUserName.trim() || !directUserEmail.trim() || !directUserPassword.trim()) {
      toast({
        variant: 'destructive',
        title: 'Preencha os dados do usuário',
        description: 'Nome, e-mail e senha são obrigatórios para cadastro direto.',
      });
      return;
    }

    const hasMinLength = directUserPassword.length >= 8;
    const hasLowercase = /[a-z]/.test(directUserPassword);
    const hasUppercase = /[A-Z]/.test(directUserPassword);
    const hasNumber = /[0-9]/.test(directUserPassword);

    if (!hasMinLength || !hasLowercase || !hasUppercase || !hasNumber) {
      toast({
        variant: 'destructive',
        title: 'Senha fraca',
        description: 'A senha deve ter pelo menos 8 caracteres, incluindo letras maiúsculas, minúsculas e números.',
      });
      return;
    }

    setCreatingDirectUser(true);
    const { data, error } = await supabase.functions.invoke('create-agent', {
      body: {
        name: directUserName.trim(),
        email: directUserEmail.trim().toLowerCase(),
        password: directUserPassword,
        workspace_id: workspaceToManage.workspace_id,
        workspace_role: directUserRole,
      },
    });
    setCreatingDirectUser(false);

    if (error) {
      let description = error.message;

      if (error instanceof FunctionsHttpError) {
        try {
          const response = await error.context.json();
          description = response?.error || description;
        } catch {
          // noop
        }
      }

      toast({
        variant: 'destructive',
        title: 'Falha ao cadastrar usuário',
        description,
      });
      return;
    }

    toast({
      title: 'Usuário cadastrado',
      description: `${directUserEmail.trim()} já pode entrar no cliente ${workspaceToManage.workspace_name} com a senha definida agora.`,
    });

    setDirectUserName('');
    setDirectUserEmail('');
    setDirectUserPassword('');
    setDirectUserRole('agent');
    await loadWorkspaceMembers(workspaceToManage);
    await fetchWorkspaces();
  };

  const handleCreateDemoWorkspace = async () => {
    setCreatingDemo(true);
    try {
      const parsedDays = Number(trialDays);
      const { data, error } = await supabase.rpc('platform_create_demo_workspace', {
        p_name: demoName,
      });

      if (error) throw error;

      await refreshTenants();
      await supabase.auth.refreshSession();
      await fetchWorkspaces();

      const createdWorkspaceId = (data as { id?: string } | null)?.id;

      if (createdWorkspaceId && Number.isFinite(parsedDays) && parsedDays > 0) {
        const { error: trialError } = await supabase.rpc('platform_start_workspace_trial', {
          p_workspace_id: createdWorkspaceId,
          p_days: parsedDays,
          p_plan_name: 'start',
        });

        if (trialError) throw trialError;
      }

      toast({
        title: 'Workspace demo criado',
        description: createdWorkspaceId
          ? `O workspace já está disponível para uso e troca no contexto${Number.isFinite(parsedDays) && parsedDays > 0 ? `, com ${parsedDays} dia(s) de teste` : ''}.`
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

  const handleStartTrial = async () => {
    if (!workspaceToTrial) return;

    const parsedDays = Number(trialDays);
    if (!Number.isFinite(parsedDays) || parsedDays < 1) {
      toast({
        variant: 'destructive',
        title: 'Dias de teste inválidos',
        description: 'Informe um número de dias maior que zero.',
      });
      return;
    }

    setTrialWorkspaceId(workspaceToTrial.workspace_id);
    try {
      const { error } = await supabase.rpc('platform_start_workspace_trial', {
        p_workspace_id: workspaceToTrial.workspace_id,
        p_days: parsedDays,
        p_plan_name: 'start',
      });

      if (error) throw error;

      toast({
        title: 'Teste liberado',
        description: `${workspaceToTrial.workspace_name} recebeu ${parsedDays} dia(s) de acesso em teste.`,
      });

      await fetchWorkspaces();
      setWorkspaceToTrial(null);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Falha ao liberar teste',
        description: error.message,
      });
    } finally {
      setTrialWorkspaceId(null);
    }
  };

  const handleArchiveWorkspace = async () => {
    if (!workspaceToArchive) return;

    setArchivingWorkspaceId(workspaceToArchive.workspace_id);
    try {
      const { error } = await supabase.rpc('platform_archive_workspace', {
        p_workspace_id: workspaceToArchive.workspace_id,
      });

      if (error) throw error;

      if (activeTenant?.id === workspaceToArchive.workspace_id) {
        localStorage.removeItem('activeTenantId');
        await refreshTenants();
      }

      await fetchWorkspaces();

      toast({
        title: 'Workspace arquivado',
        description: `${workspaceToArchive.workspace_name} foi removido da carteira ativa.`,
      });

      setWorkspaceToArchive(null);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Falha ao arquivar workspace',
        description: error.message,
      });
    } finally {
      setArchivingWorkspaceId(null);
    }
  };

  const handleMemberRoleChange = async (member: WorkspaceMember, nextRole: 'admin' | 'agent') => {
    if (!workspaceToManage) return;

    setUpdatingMemberId(member.membership_id);
    try {
      const { error } = await supabase.rpc('platform_update_workspace_member_role', {
        p_workspace_id: workspaceToManage.workspace_id,
        p_membership_id: member.membership_id,
        p_role: nextRole,
      });

      if (error) throw error;

      toast({
        title: 'Permissão atualizada',
        description: `${member.profile_email ?? member.profile_name ?? 'O usuário'} agora é ${memberRoleLabels[nextRole].toLowerCase()}.`,
      });

      await loadWorkspaceMembers(workspaceToManage);
      await fetchWorkspaces();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Falha ao atualizar permissão',
        description: error.message,
      });
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const handleRemoveMember = async (member: WorkspaceMember) => {
    if (!workspaceToManage) return;

    setRemovingMemberId(member.membership_id);
    try {
      const { error } = await supabase.rpc('platform_remove_workspace_member', {
        p_workspace_id: workspaceToManage.workspace_id,
        p_membership_id: member.membership_id,
      });

      if (error) throw error;

      toast({
        title: 'Usuário removido',
        description: `${member.profile_email ?? member.profile_name ?? 'O usuário'} perdeu acesso a este cliente.`,
      });

      await loadWorkspaceMembers(workspaceToManage);
      await fetchWorkspaces();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Falha ao remover usuário',
        description: error.message,
      });
    } finally {
      setRemovingMemberId(null);
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
          <div className="flex items-center gap-2 flex-wrap">
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar por cliente, slug ou e-mail"
              className="w-[280px]"
            />
            <Select value={statusFilter} onValueChange={(value: 'all' | 'active' | 'trialing' | 'inactive') => setStatusFilter(value)}>
              <SelectTrigger className="w-[190px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="trialing">Em trial</SelectItem>
                <SelectItem value="inactive">Sem assinatura</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={fetchWorkspaces} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
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
              <div className="grid gap-4 md:grid-cols-[1.7fr,0.7fr]">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nome do demo</label>
                  <Input
                    value={demoName}
                    onChange={(event) => setDemoName(event.target.value)}
                    placeholder="Workspace Demo G7"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Dias de trial</label>
                  <Input
                    type="number"
                    min={1}
                    value={trialDays}
                    onChange={(event) => setTrialDays(event.target.value)}
                    placeholder="5"
                  />
                </div>
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
                  {filteredWorkspaces.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                        Nenhum workspace encontrado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredWorkspaces.map((workspace) => {
                      const isCurrentWorkspace = workspace.workspace_id === activeTenant?.id;
                      const canAccessWorkspace = accessibleWorkspaceIds.has(workspace.workspace_id);

                      return (
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
                          <div className="flex justify-end gap-2">
                            <Button
                              variant={isCurrentWorkspace ? 'secondary' : 'outline'}
                              size="sm"
                              onClick={() => handleAccessWorkspace(workspace)}
                              disabled={accessingWorkspaceId === workspace.workspace_id}
                              title={canAccessWorkspace ? 'Entrar no contexto deste cliente' : 'Sua conta ainda não faz parte deste workspace'}
                            >
                              {accessingWorkspaceId === workspace.workspace_id ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : (
                                <ArrowRightCircle className="w-4 h-4 mr-2" />
                              )}
                              {isCurrentWorkspace ? 'No contexto' : 'Acessar'}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => loadWorkspaceMembers(workspace)}
                            >
                              <Users className="w-4 h-4 mr-2" />
                              Usuários
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setWorkspaceToTrial(workspace)}
                              disabled={trialWorkspaceId === workspace.workspace_id}
                            >
                              {trialWorkspaceId === workspace.workspace_id ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              ) : null}
                              Trial
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setWorkspaceToArchive(workspace)}
                              disabled={archivingWorkspaceId === workspace.workspace_id}
                            >
                              {archivingWorkspaceId === workspace.workspace_id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4 text-destructive" />
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
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

        <AlertDialog open={Boolean(workspaceToTrial)} onOpenChange={(open) => !open && setWorkspaceToTrial(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Liberar período de teste?</AlertDialogTitle>
              <AlertDialogDescription>
                Defina quantos dias de acesso em teste o workspace <strong>{workspaceToTrial?.workspace_name}</strong> deve receber
                antes de exigir plano ativo.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2">
              <label className="text-sm font-medium">Dias de trial</label>
              <Input
                type="number"
                min={1}
                value={trialDays}
                onChange={(event) => setTrialDays(event.target.value)}
                placeholder="5"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleStartTrial}>
                Liberar teste
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={Boolean(workspaceToArchive)} onOpenChange={(open) => !open && setWorkspaceToArchive(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Arquivar workspace?</AlertDialogTitle>
              <AlertDialogDescription>
                Isso remove <strong>{workspaceToArchive?.workspace_name}</strong> da carteira ativa e desativa seus vínculos. Use
                essa ação para apagar demos e workspaces de teste sem abrir o banco.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleArchiveWorkspace}>
                Arquivar workspace
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={membersOpen} onOpenChange={setMembersOpen}>
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Usuários do cliente</DialogTitle>
              <DialogDescription>
                {workspaceToManage
                  ? `Gerencie acessos e permissões do workspace ${workspaceToManage.workspace_name}.`
                  : 'Gerencie acessos e permissões deste cliente.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="rounded-lg border p-4 space-y-4">
                <div>
                  <p className="font-medium">Convidar usuário</p>
                  <p className="text-sm text-muted-foreground">
                    Envie um convite direto para este cliente e defina a permissão inicial.
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-[1.6fr,0.8fr,0.6fr]">
                  <Input
                    type="email"
                    placeholder="usuario@empresa.com"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                  />
                  <Select value={inviteRole} onValueChange={(value: 'admin' | 'agent') => setInviteRole(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Administrador</SelectItem>
                      <SelectItem value="agent">Usuário</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={handleInviteMember} disabled={invitingMember}>
                    {invitingMember ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Convidar'}
                  </Button>
                </div>
              </div>

              {membersLoading ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : selectedWorkspaceMembers.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                  Nenhum usuário encontrado para este cliente.
                </div>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuário</TableHead>
                        <TableHead>E-mail</TableHead>
                        <TableHead>Permissão</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedWorkspaceMembers.map((member) => {
                        const isOwner = member.role === 'owner';
                        const identity = member.profile_display_name || member.profile_name || member.profile_email || 'Usuário sem nome';

                        return (
                          <TableRow key={member.membership_id}>
                            <TableCell className="font-medium">{identity}</TableCell>
                            <TableCell>{member.profile_email || '-'}</TableCell>
                            <TableCell className="w-[220px]">
                              {isOwner ? (
                                <Badge className="gap-1">
                                  <Shield className="w-3 h-3" />
                                  Owner
                                </Badge>
                              ) : (
                                <Select
                                  value={member.role}
                                  onValueChange={(value: 'admin' | 'agent') => handleMemberRoleChange(member, value)}
                                  disabled={updatingMemberId === member.membership_id}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="admin">Administrador</SelectItem>
                                    <SelectItem value="agent">Usuário</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={member.is_active ? 'default' : 'secondary'}>
                                {member.is_active ? 'ativo' : 'inativo'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {isOwner ? (
                                <span className="text-xs text-muted-foreground">Owner fixo</span>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemoveMember(member)}
                                  disabled={removingMemberId === member.membership_id}
                                >
                                  {removingMemberId === member.membership_id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                  )}
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setMembersOpen(false)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}



