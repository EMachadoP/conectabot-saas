import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Loader2, Pencil, Plus, RefreshCw, Save, Share2, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useTenant } from '@/contexts/TenantContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import WhatsAppSessionCard from '@/components/whatsapp/WhatsAppSessionCard';
import WhatsAppHealthDashboard from '@/components/whatsapp/WhatsAppHealthDashboard';

type IntegrationsSettings = {
  id: string;
  whatsapp_group_id: string | null;
  whatsapp_notifications_enabled: boolean;
};

type Agent = {
  id: string;
  name: string;
  phone: string | null;
  role: string;
  can_close_protocols: boolean;
  is_active: boolean;
};

export default function AdminIntegrationsPage() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { activeTenant } = useTenant();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<IntegrationsSettings | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [stats, setStats] = useState<{ queue: number; dlq: number } | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [agentDialogOpen, setAgentDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [agentForm, setAgentForm] = useState({
    name: '',
    phone: '',
    role: 'agent',
    can_close_protocols: false,
    is_active: true,
  });

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const { data, error } = await supabase.functions.invoke('queue-stats');
      if (error) throw error;
      if (data?.ok) {
        setStats({ queue: data.queueLength || 0, dlq: data.dlqLength || 0 });
      }
    } catch (error) {
      console.error('Error fetching queue stats:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchData = async () => {
    if (!activeTenant) return;

    setLoading(true);
    try {
      const { data: settingsData, error: settingsError } = await supabase
        .from('integrations_settings')
        .select('id, whatsapp_group_id, whatsapp_notifications_enabled')
        .eq('workspace_id', activeTenant.id)
        .limit(1)
        .maybeSingle();

      if (settingsError) throw settingsError;
      setSettings(settingsData as IntegrationsSettings | null);

      const { data: agentsData, error: agentsError } = await supabase
        .from('agents')
        .select('id, name, phone, role, can_close_protocols, is_active')
        .eq('workspace_id', activeTenant.id)
        .order('name');

      if (agentsError) throw agentsError;
      setAgents((agentsData as Agent[]) || []);

      await fetchStats();
    } catch (error) {
      console.error('Error fetching integrations:', error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao carregar integrações' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && isAdmin && activeTenant?.id) {
      fetchData();
    }
  }, [user, isAdmin, activeTenant?.id]);

  const handleSaveSettings = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('integrations_settings')
        .update({
          whatsapp_group_id: settings.whatsapp_group_id,
          whatsapp_notifications_enabled: settings.whatsapp_notifications_enabled,
        })
        .eq('id', settings.id);

      if (error) throw error;
      toast({ title: 'Configurações salvas!' });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao salvar configurações' });
    } finally {
      setSaving(false);
    }
  };

  const openAgentDialog = (agent?: Agent) => {
    if (agent) {
      setEditingAgent(agent);
      setAgentForm({
        name: agent.name,
        phone: agent.phone || '',
        role: agent.role,
        can_close_protocols: agent.can_close_protocols,
        is_active: agent.is_active,
      });
    } else {
      setEditingAgent(null);
      setAgentForm({
        name: '',
        phone: '',
        role: 'agent',
        can_close_protocols: false,
        is_active: true,
      });
    }

    setAgentDialogOpen(true);
  };

  const handleSaveAgent = async () => {
    if (!agentForm.name.trim()) {
      toast({ variant: 'destructive', title: 'Nome é obrigatório' });
      return;
    }

    try {
      if (editingAgent) {
        const { error } = await supabase
          .from('agents')
          .update({
            name: agentForm.name.trim(),
            phone: agentForm.phone || null,
            role: agentForm.role,
            can_close_protocols: agentForm.can_close_protocols,
            is_active: agentForm.is_active,
          })
          .eq('id', editingAgent.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('agents')
          .insert({
            workspace_id: activeTenant?.id,
            name: agentForm.name.trim(),
            phone: agentForm.phone || null,
            role: agentForm.role,
            can_close_protocols: agentForm.can_close_protocols,
            is_active: agentForm.is_active,
          });

        if (error) throw error;
      }

      toast({ title: editingAgent ? 'Agente atualizado!' : 'Agente criado!' });
      setAgentDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error saving agent:', error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao salvar agente' });
    }
  };

  const handleDeleteAgent = async (agentId: string) => {
    if (!confirm('Tem certeza que deseja excluir este agente?')) return;

    try {
      const { error } = await supabase.from('agents').delete().eq('id', agentId);
      if (error) throw error;
      toast({ title: 'Agente removido!' });
      fetchData();
    } catch (error) {
      console.error('Error deleting agent:', error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao remover agente' });
    }
  };

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/inbox" replace />;

  return (
    <AppLayout>
      <div className="p-6 space-y-6 overflow-auto h-full">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold">Integrações</h1>
            <p className="text-muted-foreground">Tela limpa para o cliente, com foco na operação atual da plataforma.</p>
          </div>
          <Button onClick={handleSaveSettings} disabled={saving || !settings}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="whatsapp" className="space-y-6">
            <TabsList>
              <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
              <TabsTrigger value="agents">Agentes</TabsTrigger>
              <TabsTrigger value="monitoring">Monitoramento</TabsTrigger>
              <TabsTrigger value="system">Sistema</TabsTrigger>
            </TabsList>

            <TabsContent value="whatsapp" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Grupo de Notificações</CardTitle>
                  <CardDescription>Configure o grupo que recebe protocolos e alertas automáticos.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Switch
                      checked={settings?.whatsapp_notifications_enabled || false}
                      onCheckedChange={(checked) =>
                        settings && setSettings({ ...settings, whatsapp_notifications_enabled: checked })
                      }
                    />
                    <Label>Ativar notificações no grupo</Label>
                  </div>
                  <div className="space-y-2">
                    <Label>ID do Grupo WhatsApp</Label>
                    <Input
                      placeholder="5511999999999-1234567890@g.us"
                      value={settings?.whatsapp_group_id || ''}
                      onChange={(event) => settings && setSettings({ ...settings, whatsapp_group_id: event.target.value })}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-primary/30">
                <CardHeader>
                  <CardTitle>Canal Oficial</CardTitle>
                  <CardDescription>Z-API é o provedor oficial desta base. A Evolution foi removida desta interface.</CardDescription>
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge>Ativo</Badge>
                      <span className="text-sm font-medium">Z-API</span>
                    </div>
                    <p className="text-sm text-muted-foreground">Abra a tela dedicada para configurar token, instância e webhook do cliente.</p>
                  </div>
                  <Button asChild>
                    <Link to="/admin/zapi">
                      <Share2 className="w-4 h-4 mr-2" />
                      Abrir Z-API
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              <WhatsAppSessionCard refreshKey={0} />
            </TabsContent>

            <TabsContent value="agents" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <CardTitle>Agentes Autorizados</CardTitle>
                      <CardDescription>Controle quem opera o atendimento e o encerramento de protocolos.</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={fetchData}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Atualizar
                      </Button>
                      <Button size="sm" onClick={() => openAgentDialog()}>
                        <Plus className="w-4 h-4 mr-2" />
                        Novo Agente
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Função</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {agents.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            Nenhum agente cadastrado
                          </TableCell>
                        </TableRow>
                      ) : (
                        agents.map((agent) => (
                          <TableRow key={agent.id}>
                            <TableCell className="font-medium">{agent.name}</TableCell>
                            <TableCell>{agent.phone || '-'}</TableCell>
                            <TableCell className="capitalize">{agent.role}</TableCell>
                            <TableCell>{agent.is_active ? 'Ativo' : 'Inativo'}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="sm" onClick={() => openAgentDialog(agent)}>
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleDeleteAgent(agent.id)}>
                                  <Trash2 className="w-4 h-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="monitoring" className="space-y-6">
              <WhatsAppHealthDashboard />
            </TabsContent>

            <TabsContent value="system" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Status do Motor</CardTitle>
                  <CardDescription>Visão rápida da fila principal e da fila de falhas.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Fila ativa</p>
                        <p className="text-2xl font-bold">{stats?.queue ?? 0}</p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={fetchStats} disabled={loadingStats}>
                        <RefreshCw className={`w-4 h-4 ${loadingStats ? 'animate-spin' : ''}`} />
                      </Button>
                    </div>
                  </div>
                  <div className="rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Fila de falhas</p>
                        <p className="text-2xl font-bold text-destructive">{stats?.dlq ?? 0}</p>
                      </div>
                      <Button variant="ghost" size="icon" onClick={fetchStats} disabled={loadingStats}>
                        <RefreshCw className={`w-4 h-4 ${loadingStats ? 'animate-spin' : ''}`} />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        <Dialog open={agentDialogOpen} onOpenChange={setAgentDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingAgent ? 'Editar Agente' : 'Novo Agente'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={agentForm.name} onChange={(event) => setAgentForm({ ...agentForm, name: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={agentForm.phone} onChange={(event) => setAgentForm({ ...agentForm, phone: event.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Função</Label>
                <Input value={agentForm.role} onChange={(event) => setAgentForm({ ...agentForm, role: event.target.value })} />
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={agentForm.can_close_protocols} onCheckedChange={(checked) => setAgentForm({ ...agentForm, can_close_protocols: checked })} />
                <Label>Pode encerrar protocolos</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={agentForm.is_active} onCheckedChange={(checked) => setAgentForm({ ...agentForm, is_active: checked })} />
                <Label>Agente ativo</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAgentDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveAgent}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
