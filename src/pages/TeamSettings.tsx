import { useEffect, useMemo, useState } from 'react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { Users, Shield, UserRound, Mail, RefreshCw, UserPlus, Trash2, KeyRound } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useToast } from '@/hooks/use-toast';
import { useUserRole } from '@/hooks/useUserRole';
import { useAuth } from '@/hooks/useAuth';

type MemberRole = 'owner' | 'admin' | 'agent';

interface WorkspaceMemberRow {
  id: string | null;
  user_id: string | null;
  workspace_id: string | null;
  role: string | null;
  is_active: boolean | null;
  created_at: string | null;
}

interface ProfileRow {
  id: string;
  email: string;
  name: string;
  display_name: string | null;
  avatar_url: string | null;
  is_active: boolean;
}

interface TeamMember extends WorkspaceMemberRow {
  profile: ProfileRow | null;
  status: 'active' | 'pending';
}

const memberRoleLabels: Record<MemberRole, string> = {
  owner: 'Owner',
  admin: 'Administrador',
  agent: 'Agente',
};

const parseFunctionError = async (error: unknown) => {
  if (error instanceof FunctionsHttpError) {
    try {
      const response = await error.context.json();
      return response?.error || error.message;
    } catch {
      return error.message;
    }
  }

  return error instanceof Error ? error.message : 'Erro inesperado';
};

export default function TeamSettingsPage() {
  const { activeTenant } = useTenant();
  const { role: currentRole } = useUserRole();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'agent'>('agent');
  const [inviting, setInviting] = useState(false);
  const [directCreateOpen, setDirectCreateOpen] = useState(false);
  const [directUserName, setDirectUserName] = useState('');
  const [directUserEmail, setDirectUserEmail] = useState('');
  const [directUserPassword, setDirectUserPassword] = useState('');
  const [directUserRole, setDirectUserRole] = useState<'admin' | 'agent'>('agent');
  const [creatingDirectUser, setCreatingDirectUser] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [passwordTarget, setPasswordTarget] = useState<TeamMember | null>(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState('');
  const [savingAdminPassword, setSavingAdminPassword] = useState(false);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null);

  const canInviteAdmins = currentRole === 'owner' || currentRole === 'admin';

  const loadMembers = async () => {
    if (!activeTenant?.id) {
      setMembers([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data: workspaceMembers, error: membersError } = await supabase
      .from('workspace_members')
      .select('*')
      .eq('workspace_id', activeTenant.id)
      .order('created_at', { ascending: true });

    if (membersError) {
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar equipe',
        description: membersError.message,
      });
      setLoading(false);
      return;
    }

    const userIds = (workspaceMembers ?? [])
      .map((member) => member.user_id)
      .filter((userId): userId is string => Boolean(userId));

    let profilesById: Record<string, ProfileRow> = {};
    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, email, name, display_name, avatar_url, is_active')
        .in('id', userIds);

      if (profilesError) {
        toast({
          variant: 'destructive',
          title: 'Erro ao carregar perfis',
          description: profilesError.message,
        });
      } else {
        profilesById = Object.fromEntries((profiles ?? []).map((profile) => [profile.id, profile]));
      }
    }

    setMembers(
      (workspaceMembers ?? []).map((member) => ({
        ...member,
        profile: member.user_id ? profilesById[member.user_id] ?? null : null,
        status: member.user_id && profilesById[member.user_id] ? 'active' : 'pending',
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    loadMembers();
  }, [activeTenant?.id]);

  const stats = useMemo(() => {
    const total = members.length;
    const active = members.filter((member) => member.status === 'active').length;
    const pending = total - active;
    return { total, active, pending };
  }, [members]);

  const managerCount = useMemo(
    () => members.filter((member) => member.is_active && ['owner', 'admin'].includes(member.role ?? 'agent')).length,
    [members],
  );

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      toast({
        variant: 'destructive',
        title: 'Informe um e-mail',
        description: 'Preencha o e-mail do membro que sera convidado.',
      });
      return;
    }

    setInviting(true);
    const { error } = await supabase.functions.invoke('invite-user', {
      body: { email: inviteEmail.trim(), role: inviteRole },
    });
    setInviting(false);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Falha ao enviar convite',
        description: error.message,
      });
      return;
    }

    toast({
      title: 'Convite enviado',
      description: `${inviteEmail.trim()} foi adicionado(a) a equipe.`,
    });
    setInviteOpen(false);
    setInviteEmail('');
    setInviteRole('agent');
    loadMembers();
  };

  const handleDirectCreate = async () => {
    if (!activeTenant?.id) return;

    if (!directUserName.trim() || !directUserEmail.trim() || !directUserPassword.trim()) {
      toast({
        variant: 'destructive',
        title: 'Preencha os dados do usuário',
        description: 'Nome, e-mail e senha são obrigatórios.',
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
    const { error } = await supabase.functions.invoke('create-agent', {
      body: {
        name: directUserName.trim(),
        email: directUserEmail.trim().toLowerCase(),
        password: directUserPassword,
        workspace_id: activeTenant.id,
        workspace_role: directUserRole,
      },
    });
    setCreatingDirectUser(false);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Falha ao cadastrar usuário',
        description: await parseFunctionError(error),
      });
      return;
    }

    toast({
      title: 'Usuário cadastrado',
      description: `${directUserEmail.trim()} já pode entrar com a senha definida agora.`,
    });

    setDirectCreateOpen(false);
    setDirectUserName('');
    setDirectUserEmail('');
    setDirectUserPassword('');
    setDirectUserRole('agent');
    loadMembers();
  };

  const openPasswordDialog = (member: TeamMember) => {
    setPasswordTarget(member);
    setAdminPassword('');
    setAdminPasswordConfirm('');
    setPasswordDialogOpen(true);
  };

  const handleAdminPasswordUpdate = async () => {
    if (!activeTenant?.id || !passwordTarget?.user_id) return;

    if (!adminPassword.trim()) {
      toast({
        variant: 'destructive',
        title: 'Informe a nova senha',
        description: 'Digite a senha que será aplicada ao usuário.',
      });
      return;
    }

    if (adminPassword !== adminPasswordConfirm) {
      toast({
        variant: 'destructive',
        title: 'As senhas não conferem',
        description: 'Repita a mesma senha nos dois campos.',
      });
      return;
    }

    const hasMinLength = adminPassword.length >= 8;
    const hasLowercase = /[a-z]/.test(adminPassword);
    const hasUppercase = /[A-Z]/.test(adminPassword);
    const hasNumber = /[0-9]/.test(adminPassword);

    if (!hasMinLength || !hasLowercase || !hasUppercase || !hasNumber) {
      toast({
        variant: 'destructive',
        title: 'Senha fraca',
        description: 'A senha deve ter pelo menos 8 caracteres, incluindo letras maiúsculas, minúsculas e números.',
      });
      return;
    }

    setSavingAdminPassword(true);
    const { error } = await supabase.functions.invoke('admin-set-user-password', {
      body: {
        workspace_id: activeTenant.id,
        target_user_id: passwordTarget.user_id,
        password: adminPassword,
      },
    });
    setSavingAdminPassword(false);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Falha ao alterar senha',
        description: await parseFunctionError(error),
      });
      return;
    }

    toast({
      title: 'Senha atualizada',
      description: `A senha de ${passwordTarget.profile?.email ?? 'usuário'} foi alterada com sucesso.`,
    });
    setPasswordDialogOpen(false);
    setPasswordTarget(null);
    setAdminPassword('');
    setAdminPasswordConfirm('');
  };

  const handleRoleChange = async (member: TeamMember, nextRole: 'admin' | 'agent') => {
    if (!activeTenant?.id || !member.user_id) return;

    setUpdatingMemberId(member.user_id);
    const { error } = await supabase
      .from('tenant_members')
      .update({ role: nextRole })
      .eq('tenant_id', activeTenant.id)
      .eq('user_id', member.user_id);
    setUpdatingMemberId(null);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Falha ao atualizar permissão',
        description: error.message,
      });
      return;
    }

    toast({
      title: 'Permissão atualizada',
      description: `${member.profile?.email ?? 'O membro'} agora é ${memberRoleLabels[nextRole].toLowerCase()}.`,
    });
    loadMembers();
  };

  const handleRemoveMember = async (member: TeamMember) => {
    if (!activeTenant?.id || !member.user_id) return;

    setRemovingMemberId(member.user_id);
    const { error } = await supabase
      .from('tenant_members')
      .delete()
      .eq('tenant_id', activeTenant.id)
      .eq('user_id', member.user_id);
    setRemovingMemberId(null);

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Falha ao remover membro',
        description: error.message,
      });
      return;
    }

    toast({
      title: 'Membro removido',
      description: `${member.profile?.email ?? 'O membro'} perdeu acesso a este workspace.`,
    });
    loadMembers();
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6 overflow-auto h-full max-w-6xl mx-auto">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Equipe</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie quem pode operar o workspace {activeTenant?.name ? `"${activeTenant.name}"` : ''}.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={loadMembers} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>

            <Dialog open={directCreateOpen} onOpenChange={setDirectCreateOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <KeyRound className="w-4 h-4 mr-2" />
                  Adicionar usuário
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adicionar usuário com senha</DialogTitle>
                  <DialogDescription>
                    Crie o acesso diretamente neste workspace sem depender de convite por e-mail.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label htmlFor="direct-user-name">Nome</Label>
                    <Input
                      id="direct-user-name"
                      placeholder="Nome completo"
                      value={directUserName}
                      onChange={(event) => setDirectUserName(event.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="direct-user-email">E-mail</Label>
                    <Input
                      id="direct-user-email"
                      type="email"
                      placeholder="pessoa@empresa.com"
                      value={directUserEmail}
                      onChange={(event) => setDirectUserEmail(event.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="direct-user-password">Senha inicial</Label>
                    <Input
                      id="direct-user-password"
                      type="password"
                      placeholder="Minimo 8 caracteres"
                      value={directUserPassword}
                      onChange={(event) => setDirectUserPassword(event.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="direct-user-role">Nivel de acesso</Label>
                    <Select value={directUserRole} onValueChange={(value: 'admin' | 'agent') => setDirectUserRole(value)}>
                      <SelectTrigger id="direct-user-role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {canInviteAdmins && <SelectItem value="admin">Administrador</SelectItem>}
                        <SelectItem value="agent">Agente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setDirectCreateOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleDirectCreate} disabled={creatingDirectUser}>
                    {creatingDirectUser ? 'Cadastrando...' : 'Adicionar usuário'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Convidar membro
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Convidar membro</DialogTitle>
                  <DialogDescription>
                    Envie um convite por e-mail e defina a permissao inicial do novo membro.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label htmlFor="invite-email">E-mail</Label>
                    <Input
                      id="invite-email"
                      type="email"
                      placeholder="pepper@stark.com"
                      value={inviteEmail}
                      onChange={(event) => setInviteEmail(event.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="invite-role">Nivel de acesso</Label>
                    <Select value={inviteRole} onValueChange={(value: 'admin' | 'agent') => setInviteRole(value)}>
                      <SelectTrigger id="invite-role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {canInviteAdmins && <SelectItem value="admin">Administrador</SelectItem>}
                        <SelectItem value="agent">Agente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setInviteOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleInvite} disabled={inviting}>
                    {inviting ? 'Enviando...' : 'Enviar convite'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total</CardDescription>
              <CardTitle className="text-3xl">{stats.total}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Ativos</CardDescription>
              <CardTitle className="text-3xl">{stats.active}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pendentes</CardDescription>
              <CardTitle className="text-3xl">{stats.pending}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Membros do workspace
            </CardTitle>
            <CardDescription>
              Owners e administradores podem acessar configuracoes, integracoes e convites. Agentes ficam focados na operacao.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading && (
              <>
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </>
            )}

            {!loading && members.length === 0 && (
              <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
                Nenhum membro encontrado para este workspace.
              </div>
            )}

            {!loading && members.map((member) => {
              const memberRole = (member.role ?? 'agent') as MemberRole;
              const displayName = member.profile?.display_name || member.profile?.name || member.profile?.email || 'Convite pendente';
              const isSelf = member.user_id === user?.id;
              const isOwnerMember = memberRole === 'owner';
              const isLastManager = managerCount <= 1 && (memberRole === 'owner' || memberRole === 'admin');
              const disableRoleEdit = isSelf || isOwnerMember || updatingMemberId === member.user_id;
              const disableRemove = isSelf || isOwnerMember || isLastManager || removingMemberId === member.user_id;

              return (
                <div key={member.id ?? `${member.workspace_id}-${member.user_id}`} className="rounded-xl border p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{displayName}</span>
                      <Badge variant={memberRole === 'agent' ? 'secondary' : 'default'}>
                        {memberRole === 'agent' ? <UserRound className="w-3 h-3 mr-1" /> : <Shield className="w-3 h-3 mr-1" />}
                        {memberRoleLabels[memberRole]}
                      </Badge>
                      <Badge variant={member.status === 'active' ? 'outline' : 'secondary'}>
                        {member.status === 'active' ? 'Ativo' : 'Pendente'}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      {member.profile?.email ?? 'Aguardando aceite do convite'}
                    </div>
                    {isSelf && (
                      <p className="text-xs text-muted-foreground">
                        Seu próprio acesso não pode ser alterado por esta tela.
                      </p>
                    )}
                    {isLastManager && !isSelf && (
                      <p className="text-xs text-muted-foreground">
                        Este membro não pode ser removido ou rebaixado porque é o último owner/admin do workspace.
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-3 md:items-end">
                    <div className="text-sm text-muted-foreground">
                      Entrou como {memberRoleLabels[memberRole].toLowerCase()} em{' '}
                      {member.created_at ? new Date(member.created_at).toLocaleDateString('pt-BR') : '--'}
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      {memberRole !== 'owner' && (
                        <Select
                          value={memberRole}
                          onValueChange={(value: 'admin' | 'agent') => handleRoleChange(member, value)}
                          disabled={disableRoleEdit}
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Administrador</SelectItem>
                            <SelectItem value="agent">Agente</SelectItem>
                          </SelectContent>
                        </Select>
                      )}

                      {memberRole === 'owner' && (
                        <Button variant="outline" disabled className="w-[180px] justify-start">
                          <Shield className="w-4 h-4 mr-2" />
                          Owner protegido
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        onClick={() => openPasswordDialog(member)}
                        disabled={!member.user_id || member.status !== 'active'}
                      >
                        <KeyRound className="w-4 h-4 mr-2" />
                        Senha
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" disabled={disableRemove}>
                            <Trash2 className="w-4 h-4 mr-2" />
                            Remover
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remover membro</AlertDialogTitle>
                            <AlertDialogDescription>
                              {member.profile?.email ?? 'Este membro'} perderá acesso imediatamente ao workspace {activeTenant?.name}.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleRemoveMember(member)}>
                              Confirmar remoção
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Dialog
          open={passwordDialogOpen}
          onOpenChange={(open) => {
            setPasswordDialogOpen(open);
            if (!open) {
              setPasswordTarget(null);
              setAdminPassword('');
              setAdminPasswordConfirm('');
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Alterar senha do usuário</DialogTitle>
              <DialogDescription>
                Defina uma nova senha para {passwordTarget?.profile?.email ?? 'este usuário'}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="admin-password">Nova senha</Label>
                <Input
                  id="admin-password"
                  type="password"
                  placeholder="Minimo 8 caracteres"
                  value={adminPassword}
                  onChange={(event) => setAdminPassword(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-password-confirm">Confirmar senha</Label>
                <Input
                  id="admin-password-confirm"
                  type="password"
                  placeholder="Repita a senha"
                  value={adminPasswordConfirm}
                  onChange={(event) => setAdminPasswordConfirm(event.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleAdminPasswordUpdate} disabled={savingAdminPassword}>
                {savingAdminPassword ? 'Salvando...' : 'Salvar senha'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
