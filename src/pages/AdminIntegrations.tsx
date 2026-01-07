import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Save, Loader2, Plus, Trash2, Pencil, RefreshCw, Check, X, Copy, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useTenant } from '@/contexts/TenantContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { PRODUCT } from '@/config/product';
import WhatsAppSessionCard from '@/components/whatsapp/WhatsAppSessionCard';

interface IntegrationsSettings {
  id: string;
  whatsapp_group_id: string | null;
  whatsapp_notifications_enabled: boolean;
  asana_enabled: boolean;
  asana_project_id: string | null;
  asana_section_operacional: string | null;
  asana_section_financeiro: string | null;
  asana_section_support: string | null;
  asana_section_admin: string | null;
}

interface Agent {
  id: string;
  profile_id: string | null;
  name: string;
  phone: string | null;
  role: string;
  can_close_protocols: boolean;
  is_active: boolean;
}

interface EvolutionIntegration {
  id?: string;
  is_enabled: boolean;
  instance_name: string;
  base_url: string;
  api_key: string;
  webhook_secret: string;
}

export default function AdminIntegrationsPage() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { activeTenant } = useTenant();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<IntegrationsSettings | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [dispatchRunning, setDispatchRunning] = useState(false);
  const [dispatchResult, setDispatchResult] = useState<{
    total: number,
    enqueued: number,
    ignored: number,
    failed: number
  } | null>(null);

  const [evoConfig, setEvoConfig] = useState<EvolutionIntegration>({
    is_enabled: false,
    instance_name: '',
    base_url: '',
    api_key: '',
    webhook_secret: '',
  });
  const [testingEvo, setTestingEvo] = useState(false);

  // Agent dialog
  const [agentDialogOpen, setAgentDialogOpen] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [agentForm, setAgentForm] = useState({
    name: '',
    phone: '',
    role: 'agent',
    can_close_protocols: false,
    is_active: true,
  });

  const [stats, setStats] = useState<{ queue: number, dlq: number } | null>(null);
  const [errorLogs, setErrorLogs] = useState<any[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const [dlqItems, setDlqItems] = useState<any[]>([]);
  const [loadingDlq, setLoadingDlq] = useState(false);
  const [requeueing, setRequeueing] = useState(false);
  const [evolutionHealth, setEvolutionHealth] = useState<any>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [qrCode, setQrCode] = useState<{ type: string; value: string } | null>(null);
  const [loadingQr, setLoadingQr] = useState(false);
  const [pollingStatus, setPollingStatus] = useState(false);
  const [sessionAction, setSessionAction] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch settings
      const { data: settingsData } = await supabase
        .from('integrations_settings')
        .select('*')
        .limit(1)
        .single();

      if (settingsData) {
        setSettings(settingsData as IntegrationsSettings);
      }

      // Fetch agents
      const { data: agentsData } = await supabase
        .from('agents')
        .select('*')
        .order('name');

      if (agentsData) {
        setAgents(agentsData as Agent[]);
      }

      // Fetch Evolution Integration
      const { data: evoData } = await supabase
        .from('tenant_integrations')
        .select('*')
        .eq('provider', 'evolution')
        .maybeSingle();

      if (evoData) {
        setEvoConfig(evoData as EvolutionIntegration);
      }

      // Fetch Stats and Logs
      await Promise.all([fetchStats(), fetchErrorLogs(), fetchDlqItems()]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao carregar dados' });
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const { data, error } = await supabase.functions.invoke('queue-stats');
      if (error) throw error;

      if (data?.ok) {
        setStats({
          queue: data.queueLength || 0,
          dlq: data.dlqLength || 0,
        });
      }
    } catch (err) {
      console.error('Error fetching queue stats:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  const fetchErrorLogs = async () => {
    try {
      // Get team_id from profile
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('team_id')
        .eq('id', user.id)
        .single();

      const teamId = profile?.team_id;
      if (!teamId) return;

      // Fetch error logs filtered by team_id
      const { data, error } = await supabase
        .from('reminder_attempt_logs')
        .select('*')
        .eq('tenant_id', teamId) // Using tenant_id as team_id
        .in('result', ['failed', 'retry_scheduled', 'dlq'])
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setErrorLogs(data || []);
    } catch (err) {
      console.error('Error fetching logs:', err);
    }
  };

  const fetchDlqItems = async () => {
    setLoadingDlq(true);
    try {
      const { data, error } = await supabase.functions.invoke('dlq-manager', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (error) throw error;

      if (data?.ok) {
        setDlqItems(data.items || []);
      }
    } catch (err) {
      console.error('Error fetching DLQ items:', err);
    } finally {
      setLoadingDlq(false);
    }
  };

  const handleRequeue = async (index: number) => {
    if (!confirm('Reprocessar este item da DLQ?')) return;

    setRequeueing(true);
    try {
      const { data, error } = await supabase.functions.invoke('dlq-manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ index }),
      });

      if (error) throw error;

      if (data?.ok) {
        toast({ title: 'Item reenfileirado!', description: 'O item será reprocessado em breve.' });
        await Promise.all([fetchDlqItems(), fetchStats()]);
      } else {
        throw new Error(data?.error || 'Falha ao reenfileirar');
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    } finally {
      setRequeueing(false);
    }
  };

  const handleRequeueAll = async () => {
    const count = dlqItems.length;
    if (!confirm(`Reprocessar todos os ${count} itens da DLQ do seu time?`)) return;

    setRequeueing(true);
    try {
      const { data, error } = await supabase.functions.invoke('dlq-manager', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'requeue-all', limit: count }),
      });

      if (error) throw error;

      if (data?.ok) {
        toast({
          title: 'Itens reenfileirados!',
          description: `${data.requeued} itens foram reenfileirados. ${data.skipped} ignorados.`
        });
        await Promise.all([fetchDlqItems(), fetchStats()]);
      } else {
        throw new Error(data?.error || 'Falha ao reenfileirar');
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro', description: err.message });
    } finally {
      setRequeueing(false);
    }
  };

  const fetchEvolutionHealth = async () => {
    setLoadingHealth(true);
    try {
      // Get team_id from profile
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('team_id')
        .eq('id', user.id)
        .single();

      const teamId = profile?.team_id;
      if (!teamId) return;

      const { data, error } = await supabase.functions.invoke('evolution-health', {
        body: { team_id: teamId },
      });

      if (error) throw error;
      setEvolutionHealth(data);
    } catch (err) {
      console.error('Error fetching Evolution health:', err);
      setEvolutionHealth({ ok: false, error: String(err) });
    } finally {
      setLoadingHealth(false);
    }
  };

  const copyHealthJson = () => {
    if (!evolutionHealth) return;
    navigator.clipboard.writeText(JSON.stringify(evolutionHealth, null, 2));
    toast({ title: 'JSON copiado!', description: 'Diagnóstico copiado para área de transferência' });
  };

  useEffect(() => {
    if (user && isAdmin) {
      fetchData();
    }
  }, [user, isAdmin]);

  const handleSaveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('integrations_settings')
        .update({
          whatsapp_group_id: settings.whatsapp_group_id,
          whatsapp_notifications_enabled: settings.whatsapp_notifications_enabled,
          asana_enabled: settings.asana_enabled,
          asana_project_id: settings.asana_project_id,
          asana_section_operacional: settings.asana_section_operacional,
          asana_section_financeiro: settings.asana_section_financeiro,
          asana_section_support: settings.asana_section_support,
          asana_section_admin: settings.asana_section_admin,
        })
        .eq('id', settings.id);

      if (error) throw error;
      toast({ title: 'Configurações salvas!' });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao salvar' });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEvoConfig = async () => {
    if (!activeTenant) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('tenant_integrations')
        .upsert({
          tenant_id: activeTenant.id,
          provider: 'evolution',
          is_enabled: evoConfig.is_enabled,
          instance_name: evoConfig.instance_name,
          base_url: evoConfig.base_url,
          api_key: evoConfig.api_key,
          webhook_secret: evoConfig.webhook_secret,
        }, { onConflict: 'tenant_id,provider' });

      if (error) throw error;
      toast({ title: 'Configuração Evolution salva!' });
    } catch (error: any) {
      console.error('Error saving Evo config:', error);
      toast({ variant: 'destructive', title: 'Erro', description: error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateWebhookSecret = () => {
    const secret = Math.random().toString(36).substring(2, 12) + Math.random().toString(36).substring(2, 12);
    setEvoConfig({ ...evoConfig, webhook_secret: secret.toUpperCase() });
  };

  const handleTestEvoConnection = async () => {
    setTestingEvo(true);
    // Mock testing
    setTimeout(() => {
      setTestingEvo(false);
      if (evoConfig.base_url.startsWith('http')) {
        toast({ title: 'Conexão bem-sucedida!', description: 'A instância respondeu corretamente (Simulado).' });
      } else {
        toast({ variant: 'destructive', title: 'Erro na conexão', description: 'URL base inválida ou não responde.' });
      }
    }, 1500);
  };

  const handleOpenAgentDialog = (agent?: Agent) => {
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
    if (!agentForm.name) {
      toast({ variant: 'destructive', title: 'Nome é obrigatório' });
      return;
    }

    try {
      if (editingAgent) {
        const { error } = await supabase
          .from('agents')
          .update({
            name: agentForm.name,
            phone: agentForm.phone || null,
            role: agentForm.role,
            can_close_protocols: agentForm.can_close_protocols,
            is_active: agentForm.is_active,
          })
          .eq('id', editingAgent.id);

        if (error) throw error;
        toast({ title: 'Agente atualizado!' });
      } else {
        const { error } = await supabase
          .from('agents')
          .insert({
            tenant_id: activeTenant?.id,
            name: agentForm.name,
            phone: agentForm.phone || null,
            role: agentForm.role,
            can_close_protocols: agentForm.can_close_protocols,
            is_active: agentForm.is_active,
          });

        if (error) throw error;
        toast({ title: 'Agente criado!' });
      }

      setAgentDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error saving agent:', error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao salvar agente' });
    }
  };

  const handleDeleteAgent = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este agente?')) return;

    try {
      const { error } = await supabase
        .from('agents')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: 'Agente removido!' });
      fetchData();
    } catch (error) {
      console.error('Error deleting agent:', error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao remover' });
    }
  };

  const handleToggleAgentPermission = async (agent: Agent) => {
    try {
      const { error } = await supabase
        .from('agents')
        .update({ can_close_protocols: !agent.can_close_protocols })
        .eq('id', agent.id);

      if (error) throw error;
      toast({ title: agent.can_close_protocols ? 'Permissão removida' : 'Permissão concedida' });
      fetchData();
    } catch (error) {
      console.error('Error updating agent:', error);
      toast({ variant: 'destructive', title: 'Erro' });
    }
  };

  if (authLoading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/inbox" replace />;
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6 overflow-auto h-full">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold">Integrações</h1>
            <p className="text-muted-foreground">Configure WhatsApp{PRODUCT.flags.enableAsana ? ', Asana' : ''} e agentes autorizados</p>
          </div>
          <Button onClick={handleSaveSettings} disabled={saving}>
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
              {PRODUCT.flags.enableAsana && <TabsTrigger value="asana">Asana</TabsTrigger>}
              <TabsTrigger value="agents">Agentes</TabsTrigger>
              <TabsTrigger value="system">Sistema</TabsTrigger>
            </TabsList>

            {/* WHATSAPP TAB */}
            <TabsContent value="whatsapp" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Grupo de Notificações</CardTitle>
                  <CardDescription>
                    Configure o grupo WhatsApp onde os protocolos serão notificados
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Switch
                      checked={settings?.whatsapp_notifications_enabled || false}
                      onCheckedChange={(checked) => settings && setSettings({ ...settings, whatsapp_notifications_enabled: checked })}
                    />
                    <Label>Ativar notificações no grupo</Label>
                  </div>

                  <div className="space-y-2">
                    <Label>ID do Grupo WhatsApp</Label>
                    <Input
                      placeholder="5511999999999-1234567890@g.us"
                      value={settings?.whatsapp_group_id || ''}
                      onChange={(e) => settings && setSettings({ ...settings, whatsapp_group_id: e.target.value })}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* EVOLUTION CONFIG */}
              <Card>
                <CardHeader>
                  <CardTitle>WhatsApp - Evolution API (Multi-tenant)</CardTitle>
                  <CardDescription>
                    Configure sua própria instância da Evolution API para envios e recebimentos
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center gap-4">
                    <Switch
                      checked={evoConfig.is_enabled}
                      onCheckedChange={(checked) => setEvoConfig({ ...evoConfig, is_enabled: checked })}
                    />
                    <Label className="font-semibold text-primary">Ativar Integração Evolution</Label>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label>Base URL (API)</Label>
                      <Input
                        placeholder="https://api.empresa.com.br"
                        value={evoConfig.base_url}
                        onChange={(e) => setEvoConfig({ ...evoConfig, base_url: e.target.value })}
                      />
                      <p className="text-[10px] text-muted-foreground">URL onde a Evolution API está hospedada</p>
                    </div>

                    <div className="space-y-2">
                      <Label>Nome da Instância</Label>
                      <Input
                        placeholder="tenant-01"
                        value={evoConfig.instance_name}
                        onChange={(e) => setEvoConfig({ ...evoConfig, instance_name: e.target.value })}
                      />
                      <p className="text-[10px] text-muted-foreground">O nome da instância configurado no Evolution</p>
                    </div>

                    <div className="space-y-2">
                      <Label>API Key (Global/Instance)</Label>
                      <Input
                        type="password"
                        placeholder="Digite sua chave de API"
                        value={evoConfig.api_key}
                        onChange={(e) => setEvoConfig({ ...evoConfig, api_key: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Webhook Secret / Security Key</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Secret para validar webhooks"
                          value={evoConfig.webhook_secret}
                          onChange={(e) => setEvoConfig({ ...evoConfig, webhook_secret: e.target.value })}
                        />
                        <Button variant="outline" size="icon" onClick={handleGenerateWebhookSecret} title="Gerar Segredo" type="button">
                          <RefreshCw className="w-4 h-4" />
                        </Button>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Use este segredo no header "apikey" da configuração de webhook no Evolution</p>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button variant="outline" onClick={handleTestEvoConnection} disabled={testingEvo || !evoConfig.base_url} type="button">
                      {testingEvo ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                      Testar Conexão
                    </Button>
                    <Button onClick={handleSaveEvoConfig} disabled={saving} type="button">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                      Salvar Integração
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* WHATSAPP SESSION MANAGEMENT */}
              <WhatsAppSessionCard />
            </TabsContent>

            {/* ASANA TAB */}
            {PRODUCT.flags.enableAsana && (
              <TabsContent value="asana" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Integração Asana</CardTitle>
                    <CardDescription>
                      Configure a criação automática de tarefas no Asana para cada protocolo
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-4">
                      <Switch
                        checked={settings?.asana_enabled || false}
                        onCheckedChange={(checked) => settings && setSettings({ ...settings, asana_enabled: checked })}
                      />
                      <Label>Ativar integração Asana</Label>
                    </div>

                    <div className="space-y-2">
                      <Label>Project ID</Label>
                      <Input
                        placeholder="1234567890123456"
                        value={settings?.asana_project_id || ''}
                        onChange={(e) => settings && setSettings({ ...settings, asana_project_id: e.target.value })}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Section ID - Operacional</Label>
                        <Input
                          placeholder="1234567890123456"
                          value={settings?.asana_section_operacional || ''}
                          onChange={(e) => settings && setSettings({ ...settings, asana_section_operacional: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Section ID - Financeiro</Label>
                        <Input
                          placeholder="1234567890123456"
                          value={settings?.asana_section_financeiro || ''}
                          onChange={(e) => settings && setSettings({ ...settings, asana_section_financeiro: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Section ID - Suporte</Label>
                        <Input
                          placeholder="1234567890123456"
                          value={settings?.asana_section_support || ''}
                          onChange={(e) => settings && setSettings({ ...settings, asana_section_support: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Section ID - Administrativo</Label>
                        <Input
                          placeholder="1234567890123456"
                          value={settings?.asana_section_admin || ''}
                          onChange={(e) => settings && setSettings({ ...settings, asana_section_admin: e.target.value })}
                        />
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground">
                      Os Section IDs são opcionais. Se preenchidos, as tarefas serão criadas na seção correspondente à categoria do protocolo.
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>
            )}

            {/* AGENTS TAB */}
            <TabsContent value="agents" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Agentes Autorizados</CardTitle>
                      <CardDescription>
                        Gerencie quem pode encerrar protocolos pelo grupo WhatsApp
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={fetchData}>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Atualizar
                      </Button>
                      <Button size="sm" onClick={() => handleOpenAgentDialog()}>
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
                        <TableHead>Pode Encerrar</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {agents.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground">
                            Nenhum agente cadastrado
                          </TableCell>
                        </TableRow>
                      ) : (
                        agents.map((agent) => (
                          <TableRow key={agent.id}>
                            <TableCell className="font-medium">{agent.name}</TableCell>
                            <TableCell>{agent.phone || '-'}</TableCell>
                            <TableCell className="capitalize">{agent.role}</TableCell>
                            <TableCell>
                              <Button
                                variant={agent.can_close_protocols ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => handleToggleAgentPermission(agent)}
                              >
                                {agent.can_close_protocols ? (
                                  <><Check className="w-4 h-4 mr-1" /> Sim</>
                                ) : (
                                  <><X className="w-4 h-4 mr-1" /> Não</>
                                )}
                              </Button>
                            </TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 rounded text-xs ${agent.is_active ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300'}`}>
                                {agent.is_active ? 'Ativo' : 'Inativo'}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button variant="ghost" size="sm" onClick={() => handleOpenAgentDialog(agent)}>
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

            {/* SYSTEM TAB */}
            <TabsContent value="system" className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="py-4">
                    <CardTitle className="text-sm font-medium">Fila Ativa (Upstash)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <p className="text-2xl font-bold">{stats?.queue ?? 0}</p>
                      <Button variant="ghost" size="icon" onClick={fetchStats} disabled={loadingStats}>
                        <RefreshCw className={`w-4 h-4 ${loadingStats ? 'animate-spin' : ''}`} />
                      </Button>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1 text-amber-600 font-medium">Trabalhos aguardando processamento</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="py-4">
                    <CardTitle className="text-sm font-medium text-destructive">DLQ (Dead Letter Queue)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <p className="text-2xl font-bold text-destructive">{stats?.dlq ?? 0}</p>
                      <Button variant="ghost" size="icon" onClick={fetchStats} disabled={loadingStats}>
                        <RefreshCw className={`w-4 h-4 ${loadingStats ? 'animate-spin' : ''}`} />
                      </Button>
                    </div>
                    <p className="text-[10px] text-destructive mt-1 font-medium italic">Falhas fatais ou exaustão de retries</p>
                  </CardContent>
                </Card>

                {/* EVOLUTION STATUS */}
                <Card className="md:col-span-2">
                  <CardHeader className="py-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-medium">Evolution API Status</CardTitle>
                      <div className="flex gap-2">
                        {evolutionHealth && (
                          <Button variant="ghost" size="sm" onClick={copyHealthJson} title="Copiar JSON de diagnóstico">
                            <Copy className="w-4 h-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={fetchEvolutionHealth} disabled={loadingHealth}>
                          <RefreshCw className={`w-4 h-4 ${loadingHealth ? 'animate-spin' : ''}`} />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {loadingHealth ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      </div>
                    ) : !evolutionHealth ? (
                      <div className="text-center py-4">
                        <p className="text-sm text-muted-foreground mb-2">Clique em "Testar conexão" para verificar</p>
                        <Button size="sm" onClick={fetchEvolutionHealth}>
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Testar Conexão
                        </Button>
                      </div>
                    ) : evolutionHealth.ok === false ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <XCircle className="w-5 h-5 text-destructive" />
                          <span className="font-semibold text-destructive">Erro ao verificar</span>
                        </div>
                        <p className="text-xs text-muted-foreground">{evolutionHealth.error}</p>
                      </div>
                    ) : (
                      <div className="grid gap-3">
                        {/* Server Status */}
                        <div className="flex items-center justify-between p-2 border rounded">
                          <div className="flex items-center gap-2">
                            {evolutionHealth.server?.reachable ? (
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                            ) : (
                              <XCircle className="w-4 h-4 text-destructive" />
                            )}
                            <div>
                              <p className="text-xs font-medium">Servidor</p>
                              <p className="text-[10px] text-muted-foreground">{evolutionHealth.server?.base_url_masked}</p>
                            </div>
                          </div>
                          {evolutionHealth.server?.latency_ms && (
                            <span className="text-xs text-muted-foreground">{evolutionHealth.server.latency_ms}ms</span>
                          )}
                        </div>

                        {/* Instance Status */}
                        <div className="flex items-center justify-between p-2 border rounded">
                          <div className="flex items-center gap-2">
                            {evolutionHealth.instance?.status === 'CONNECTED' ? (
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                            ) : evolutionHealth.instance?.status === 'DISCONNECTED' ? (
                              <AlertCircle className="w-4 h-4 text-amber-600" />
                            ) : evolutionHealth.instance?.status === 'NOT_FOUND' ? (
                              <XCircle className="w-4 h-4 text-destructive" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-muted-foreground" />
                            )}
                            <div>
                              <p className="text-xs font-medium">Instância</p>
                              <p className="text-[10px] text-muted-foreground">{evolutionHealth.instance?.key}</p>
                            </div>
                          </div>
                          <Badge
                            variant={
                              evolutionHealth.instance?.status === 'CONNECTED' ? 'default' :
                                evolutionHealth.instance?.status === 'DISCONNECTED' ? 'secondary' :
                                  'destructive'
                            }
                            className="text-[10px]"
                          >
                            {evolutionHealth.instance?.status || 'UNKNOWN'}
                          </Badge>
                        </div>

                        {/* Auth Status */}
                        <div className="flex items-center justify-between p-2 border rounded">
                          <div className="flex items-center gap-2">
                            {evolutionHealth.auth?.valid ? (
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                            ) : (
                              <XCircle className="w-4 h-4 text-destructive" />
                            )}
                            <div>
                              <p className="text-xs font-medium">Autenticação</p>
                              <p className="text-[10px] text-muted-foreground">
                                {evolutionHealth.auth?.valid ? 'API Key válida' : 'API Key inválida'}
                              </p>
                            </div>
                          </div>
                          {evolutionHealth.auth?.http_status && (
                            <span className="text-xs text-muted-foreground">HTTP {evolutionHealth.auth.http_status}</span>
                          )}
                        </div>

                        {/* Diagnostic Messages */}
                        {evolutionHealth.instance?.status === 'NOT_CONFIGURED' && (
                          <div className="p-2 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded">
                            <p className="text-xs text-amber-800 dark:text-amber-200">
                              ⚠️ Configure a instância Evolution na aba WhatsApp
                            </p>
                          </div>
                        )}
                        {evolutionHealth.instance?.status === 'NOT_FOUND' && (
                          <div className="p-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded">
                            <p className="text-xs text-red-800 dark:text-red-200">
                              ❌ Instância não encontrada. Verifique o instance_key.
                            </p>
                          </div>
                        )}
                        {evolutionHealth.instance?.status === 'DISCONNECTED' && (
                          <div className="p-2 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded">
                            <p className="text-xs text-blue-800 dark:text-blue-200">
                              📱 Aguardando conexão do telefone (QR Code)
                            </p>
                          </div>
                        )}
                        {!evolutionHealth.auth?.valid && (
                          <div className="p-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded">
                            <p className="text-xs text-red-800 dark:text-red-200">
                              🔑 API Key inválida. Verifique as credenciais.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Ferramentas do Sistema</CardTitle>
                  <CardDescription>
                    Ações manuais para manutenção do motor de disparos
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex flex-col gap-4 p-4 border rounded-lg bg-muted/30">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1">
                        <h4 className="font-semibold text-sm">Disparador de Lembretes (Motor SAC)</h4>
                        <p className="text-xs text-muted-foreground">
                          Processa manualmente todos os jobs de lembretes pendentes (faz o papel do Cron).
                        </p>

                        {dispatchResult && (
                          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2 border-t pt-4">
                            <div className="p-2 border rounded bg-background">
                              <p className="text-[10px] uppercase text-muted-foreground font-bold">Selecionados</p>
                              <p className="text-lg font-bold">{dispatchResult.total}</p>
                            </div>
                            <div className="p-2 border rounded bg-background">
                              <p className="text-[10px] uppercase text-green-600 font-bold">Enfileirados</p>
                              <p className="text-lg font-bold text-green-600">{dispatchResult.enqueued}</p>
                            </div>
                            <div className="p-2 border rounded bg-background">
                              <p className="text-[10px] uppercase text-amber-600 font-bold">Ignorados</p>
                              <p className="text-lg font-bold text-amber-600">{dispatchResult.ignored}</p>
                            </div>
                            <div className="p-2 border rounded bg-background">
                              <p className="text-[10px] uppercase text-destructive font-bold">Falhas</p>
                              <p className="text-lg font-bold text-destructive">{dispatchResult.failed}</p>
                            </div>
                          </div>
                        )}
                      </div>
                      <Button
                        variant="secondary"
                        className="whitespace-nowrap"
                        disabled={dispatchRunning}
                        onClick={async () => {
                          setDispatchRunning(true);
                          setDispatchResult(null);
                          try {
                            const { data, error } = await supabase.functions.invoke('reminder-dispatcher');
                            if (error) throw error;

                            const results = data.results || [];
                            setDispatchResult({
                              total: results.length,
                              enqueued: results.filter((r: any) => r.status === 'enqueued').length,
                              ignored: results.filter((r: any) => r.status === 'ignored').length,
                              failed: results.filter((r: any) => r.status === 'error' || r.status === 'failed').length,
                            });

                            toast({ title: 'Dispatcher Executado' });
                            fetchStats(); // Update stats after running
                          } catch (error: any) {
                            toast({ variant: 'destructive', title: 'Falha no Dispatcher', description: error.message });
                          } finally {
                            setDispatchRunning(false);
                          }
                        }}
                      >
                        {dispatchRunning ? (
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4 mr-2" />
                        )}
                        Rodar Dispatcher
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Logs de Erro (Últimos 20)</CardTitle>
                  <CardDescription>
                    Histórico detalhado de falhas na entrega de mensagens (Evolution/Worker)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Horário</TableHead>
                        <TableHead>Destinatário</TableHead>
                        <TableHead>Erro</TableHead>
                        <TableHead>HTTP</TableHead>
                        <TableHead>Provedor</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {errorLogs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            Nenhum erro registrado recentemente
                          </TableCell>
                        </TableRow>
                      ) : (
                        errorLogs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="text-xs whitespace-nowrap">
                              {log.created_at ? new Date(log.created_at).toLocaleString('pt-BR') : '-'}
                            </TableCell>
                            <TableCell className="text-xs font-medium">
                              {log.target_ref || 'Desconhecido'}
                            </TableCell>
                            <TableCell className="text-xs text-destructive max-w-xs truncate">
                              {log.error || 'Erro desconhecido'}
                            </TableCell>
                            <TableCell className="text-xs">
                              {log.http_status ? (
                                <span className={`px-1.5 py-0.5 rounded font-bold ${log.http_status >= 500 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                  {log.http_status}
                                </span>
                              ) : '-'}
                            </TableCell>
                            <TableCell className="text-xs capitalize">
                              {log.provider || 'n/a'}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* DLQ VIEWER */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Dead Letter Queue (DLQ)</CardTitle>
                      <CardDescription>
                        Itens que falharam após todas as tentativas de retry (filtrado por seu time)
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={fetchDlqItems} disabled={loadingDlq}>
                        <RefreshCw className={`w-4 h-4 mr-2 ${loadingDlq ? 'animate-spin' : ''}`} />
                        Atualizar
                      </Button>
                      {dlqItems.length > 0 && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={handleRequeueAll}
                          disabled={requeueing}
                        >
                          {requeueing ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4 mr-2" />
                          )}
                          Reprocessar Todos ({dlqItems.length})
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingDlq ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Falhou em</TableHead>
                          <TableHead>Destinatário</TableHead>
                          <TableHead>Erro</TableHead>
                          <TableHead>HTTP</TableHead>
                          <TableHead>Provider</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dlqItems.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                              ✅ Nenhum item na DLQ (tudo funcionando!)
                            </TableCell>
                          </TableRow>
                        ) : (
                          dlqItems.map((item, index) => {
                            const payload = item.payload_original;
                            const isIncomplete = !payload?.recipient_id || !payload?.reminder_id || !payload?.team_id;

                            return (
                              <TableRow key={index} className={isIncomplete ? 'opacity-50' : ''}>
                                <TableCell className="text-xs whitespace-nowrap">
                                  {item.at ? new Date(item.at).toLocaleString('pt-BR') : '-'}
                                </TableCell>
                                <TableCell className="text-xs font-medium">
                                  {payload?.recipient_id ? (
                                    <code className="text-[10px]">{payload.recipient_id.substring(0, 8)}...</code>
                                  ) : (
                                    <span className="text-destructive">Incompleto</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-xs text-destructive max-w-xs truncate">
                                  {item.error_summary || 'Erro desconhecido'}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {item.http_status ? (
                                    <span className={`px-1.5 py-0.5 rounded font-bold ${item.http_status >= 500 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                                      {item.http_status}
                                    </span>
                                  ) : '-'}
                                </TableCell>
                                <TableCell className="text-xs capitalize">
                                  {item.provider || 'n/a'}
                                </TableCell>
                                <TableCell className="text-right">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRequeue(item._index)}
                                    disabled={requeueing || isIncomplete}
                                    title={isIncomplete ? 'Payload incompleto' : 'Reprocessar este item'}
                                  >
                                    <RefreshCw className="w-4 h-4" />
                                  </Button>
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
            </TabsContent>
          </Tabs>
        )}

        {/* Agent Dialog */}
        <Dialog open={agentDialogOpen} onOpenChange={setAgentDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingAgent ? 'Editar Agente' : 'Novo Agente'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input
                  placeholder="Nome do agente"
                  value={agentForm.name}
                  onChange={(e) => setAgentForm({ ...agentForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input
                  placeholder="5511999999999"
                  value={agentForm.phone}
                  onChange={(e) => setAgentForm({ ...agentForm, phone: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Apenas números, sem espaços ou caracteres especiais
                </p>
              </div>
              <div className="space-y-2">
                <Label>Função</Label>
                <Select
                  value={agentForm.role}
                  onValueChange={(value) => setAgentForm({ ...agentForm, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="manager">Gerente</SelectItem>
                    <SelectItem value="tech">Técnico</SelectItem>
                    <SelectItem value="agent">Agente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-4">
                <Switch
                  checked={agentForm.can_close_protocols}
                  onCheckedChange={(checked) => setAgentForm({ ...agentForm, can_close_protocols: checked })}
                />
                <Label>Pode encerrar protocolos pelo grupo</Label>
              </div>
              <div className="flex items-center gap-4">
                <Switch
                  checked={agentForm.is_active}
                  onCheckedChange={(checked) => setAgentForm({ ...agentForm, is_active: checked })}
                />
                <Label>Agente ativo</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAgentDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveAgent}>
                {editingAgent ? 'Atualizar' : 'Criar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
