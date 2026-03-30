import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import type { Json } from '@/integrations/supabase/types';
import { Save, RotateCcw, Play, Loader2, Plus, Trash2, Pencil, Copy, Info } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AISettings {
  id: string;
  workspace_id: string;
  tenant_id?: string;
  enabled_global: boolean;
  timezone: string;
  base_system_prompt: string;
  system_prompt?: string | null;
  model_name?: string | null;
  temperature?: number | null;
  fallback_offhours_message: string;
  policies_json: Record<string, unknown>;
  memory_message_count: number;
  enable_auto_summary: boolean;
  anti_spam_seconds: number;
  max_messages_per_hour: number;
  human_request_pause_hours: number;
  schedule_json: ScheduleJson;
}

interface AITeamSettings {
  id: string;
  team_id: string;
  enabled: boolean;
  prompt_override: string | null;
  schedule_json: ScheduleJson;
  throttling_json: ThrottlingJson;
  teams?: { name: string };
}

interface DaySchedule {
  enabled: boolean;
  start: string;
  end: string;
}

interface ScheduleException {
  date: string;
  enabled: boolean;
  message?: string;
}

interface ScheduleJson {
  days: Record<string, DaySchedule>;
  exceptions: ScheduleException[];
}

interface ThrottlingJson {
  anti_spam_seconds: number | null;
  max_messages_per_hour: number | null;
}

interface AIProviderConfig {
  id: string;
  provider: string;
  model: string;
  temperature: number;
  max_tokens: number;
  top_p: number;
  active: boolean;
  key_ref: string | null;
}

interface AILog {
  id: string;
  conversation_id: string | null;
  team_id: string | null;
  provider: string;
  model: string;
  request_id: string | null;
  input_excerpt: string | null;
  output_text: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  latency_ms: number | null;
  status: string;
  error_message: string | null;
  created_at: string;
  teams?: { name: string } | null;
}

interface Team {
  id: string;
  name: string;
}

const DEFAULT_PROMPT = `Você é um assistente virtual profissional e prestativo da empresa.

Diretrizes:
- Seja educado, claro e objetivo
- Responda em português brasileiro
- Se não souber algo, diga que vai verificar com a equipe
- Não invente preços ou informações não confirmadas
- Se o cliente pedir atendimento humano, informe que está transferindo

Variáveis disponíveis:
- Nome do cliente: {{customer_name}}
- Fuso horário: {{timezone}}
- Horário comercial: {{business_hours}}`;

const TIMEZONES = [
  'America/Sao_Paulo',
  'America/Recife',
  'America/Fortaleza',
  'America/Manaus',
  'America/Cuiaba',
  'America/Porto_Velho',
  'America/Rio_Branco',
];

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Segunda' },
  { key: 'tuesday', label: 'Terça' },
  { key: 'wednesday', label: 'Quarta' },
  { key: 'thursday', label: 'Quinta' },
  { key: 'friday', label: 'Sexta' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
];

const AVAILABLE_MODELS = {
  openai: [
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Recomendado)' },
    { value: 'gpt-4o', label: 'GPT-4o' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'gpt-5-2025-08-07', label: 'GPT-5 (Mais Recente)' },
    { value: 'gpt-5-mini-2025-08-07', label: 'GPT-5 Mini' },
  ],
  gemini: [
    { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash Preview (Mais Recente)' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Recomendado)' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { value: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
    { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
  ],
};

const PROVIDER_INFO = {
  openai: {
    name: 'OpenAI',
    description: 'Acesso direto à API OpenAI',
    pros: ['Modelos mais precisos', 'Controle total'],
    cons: ['Requer API key paga', 'Custo por uso'],
    keyRef: 'OPENAI_API_KEY',
  },
  gemini: {
    name: 'Google Gemini',
    description: 'Acesso direto à API Google Gemini',
    pros: ['Free tier generoso', 'Alta velocidade'],
    cons: ['Requer configuração de API key'],
    keyRef: 'GEMINI_API_KEY',
  },
};

const PROMPT_PRESETS = [
  {
    key: 'default',
    label: 'Atendimento Padrão',
    description: 'Equilibrado para suporte diário e triagem geral.',
    prompt: `Você é o assistente virtual da empresa {{company_name}}.

Atenda em português brasileiro, com clareza, cordialidade e objetividade.
O cliente atual chama-se {{contact_name}}.
Se houver um protocolo em andamento, considere o código {{protocol_number}}.
Seu papel é acolher, esclarecer e encaminhar quando necessário.
Nunca invente preços, prazos ou informações não confirmadas.
Se o cliente pedir atendimento humano, informe que a equipe seguirá a tratativa.`,
  },
  {
    key: 'strict-support',
    label: 'Suporte Rigoroso',
    description: 'Mais conservador, ideal para operação técnica e protocolos.',
    prompt: `Você é o assistente técnico da empresa {{company_name}}.

Responda com tom direto, profissional e preciso.
O cliente atual chama-se {{contact_name}}.
Priorize coleta objetiva de dados, diagnóstico inicial e abertura correta de protocolo.
Nunca improvise solução sem confirmação.
Se faltar informação essencial, peça apenas o mínimo necessário para avançar.`,
  },
  {
    key: 'appointments',
    label: 'Agendamento',
    description: 'Focado em confirmar horários, disponibilidade e próximos passos.',
    prompt: `Você é o assistente de agendamentos da empresa {{company_name}}.

Atenda de forma simpática, organizada e clara.
O cliente atual chama-se {{contact_name}}.
Seu objetivo é confirmar interesse, organizar datas e explicar os próximos passos.
Sempre deixe a conversa objetiva e sem ambiguidade.
Se não puder confirmar algo, diga que a equipe humana validará a agenda.`,
  },
];

const WORKSPACE_MODEL_OPTIONS = [
  {
    value: 'google/gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    hint: 'Rápido e eficiente para alto volume.',
  },
  {
    value: 'google/gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    hint: 'Melhor para contextos longos e respostas mais refinadas.',
  },
  {
    value: 'openai/gpt-5-mini',
    label: 'GPT-5 Mini',
    hint: 'Bom equilíbrio entre custo, velocidade e consistência.',
  },
  {
    value: 'openai/gpt-5',
    label: 'GPT-5',
    hint: 'Mais robusto para fluxos premium e instruções complexas.',
  },
  {
    value: 'gpt-4o-mini',
    label: 'GPT-4o Mini',
    hint: 'Ágil para suporte e operação de rotina.',
  },
];

function getTemperatureProfile(value: number) {
  if (value <= 0.3) {
    return 'Conservadora e precisa. Ideal para suporte técnico e protocolos.';
  }
  if (value <= 0.6) {
    return 'Equilibrada. Boa para atendimento geral e operação.';
  }
  return 'Criativa e variada. Melhor para vendas, relacionamento e marketing.';
}

export default function AdminAIPage() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { activeTenant } = useTenant();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  // Data states
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [teamSettings, setTeamSettings] = useState<AITeamSettings[]>([]);
  const [providers, setProviders] = useState<AIProviderConfig[]>([]);
  const [logs, setLogs] = useState<AILog[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

  // Dialog states
  const [providerDialogOpen, setProviderDialogOpen] = useState(false);
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<AIProviderConfig | null>(null);
  const [editingTeamSetting, setEditingTeamSetting] = useState<AITeamSettings | null>(null);

  // Form states
  const [providerForm, setProviderForm] = useState({
    provider: 'gemini' as string,
    model: 'gemini-2.5-flash',
    customModel: '',
    useCustomModel: false,
    temperature: 0.7,
    max_tokens: 1024,
    top_p: 1.0,
    active: false,
    key_ref: '',
  });

  // Test playground states
  const [testMessage, setTestMessage] = useState('');
  const [testTeamId, setTestTeamId] = useState<string>('');
  const [testProviderId, setTestProviderId] = useState<string>('');
  const [testResult, setTestResult] = useState<{
    response: string;
    prompt_rendered: string;
    provider: string;
    model: string;
    tokens_in: number;
    tokens_out: number;
    latency_ms: number;
  } | null>(null);

  // Logs filter
  const [logsFilter, setLogsFilter] = useState({
    status: 'all',
    provider: 'all',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch settings
      const { data: settingsData } = await supabase
        .from('ai_settings')
        .select('*')
        .eq('workspace_id', activeTenant?.id ?? '')
        .limit(1)
        .maybeSingle();
      
      if (settingsData) {
        // Cast schedule_json properly
        const scheduleJson = settingsData.schedule_json as unknown as ScheduleJson | null;
        const defaultSchedule: ScheduleJson = {
          days: {
            monday: { enabled: true, start: '08:00', end: '18:00' },
            tuesday: { enabled: true, start: '08:00', end: '18:00' },
            wednesday: { enabled: true, start: '08:00', end: '18:00' },
            thursday: { enabled: true, start: '08:00', end: '18:00' },
            friday: { enabled: true, start: '08:00', end: '18:00' },
            saturday: { enabled: true, start: '08:00', end: '12:00' },
            sunday: { enabled: false, start: '08:00', end: '12:00' },
          },
          exceptions: [],
        };
        
        setSettings({
          ...settingsData,
          policies_json: settingsData.policies_json as Record<string, unknown> ?? {},
          schedule_json: scheduleJson ?? defaultSchedule,
        } as AISettings);
      } else if (activeTenant?.id) {
        setSettings({
          id: crypto.randomUUID(),
          workspace_id: activeTenant.id,
          tenant_id: activeTenant.id,
          enabled_global: false,
          timezone: 'America/Fortaleza',
          base_system_prompt: DEFAULT_PROMPT,
          system_prompt: DEFAULT_PROMPT,
          model_name: null,
          temperature: 0.7,
          fallback_offhours_message: 'Recebemos sua mensagem e retornaremos no próximo horário útil.',
          policies_json: {},
          memory_message_count: 12,
          enable_auto_summary: false,
          anti_spam_seconds: 5,
          max_messages_per_hour: 6,
          human_request_pause_hours: 2,
          schedule_json: {
            days: {
              monday: { enabled: true, start: '08:00', end: '18:00' },
              tuesday: { enabled: true, start: '08:00', end: '18:00' },
              wednesday: { enabled: true, start: '08:00', end: '18:00' },
              thursday: { enabled: true, start: '08:00', end: '18:00' },
              friday: { enabled: true, start: '08:00', end: '18:00' },
              saturday: { enabled: true, start: '08:00', end: '12:00' },
              sunday: { enabled: false, start: '08:00', end: '12:00' },
            },
            exceptions: [],
          },
        });
      }

      // Fetch team settings
      const { data: teamSettingsData } = await supabase
        .from('ai_team_settings')
        .select('*, teams(name)')
        .order('created_at');
      
      if (teamSettingsData) {
        setTeamSettings(teamSettingsData as unknown as AITeamSettings[]);
      }

      // Fetch providers
      const { data: providersData } = await supabase
        .from('ai_provider_configs')
        .select('*')
        .order('created_at');
      
      if (providersData) {
        setProviders(providersData as AIProviderConfig[]);
      }

      // Fetch teams
      const { data: teamsData } = await supabase
        .from('teams')
        .select('id, name')
        .order('name');
      
      if (teamsData) {
        setTeams(teamsData);
      }

      // Fetch logs
      const { data: logsData } = await supabase
        .from('ai_logs')
        .select('*, teams(name)')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (logsData) {
        setLogs(logsData as unknown as AILog[]);
      }
    } catch (error) {
      console.error('Error fetching AI data:', error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao carregar dados' });
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
    if (!settings || !activeTenant?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('ai_settings')
        .upsert({
          id: settings.id,
          workspace_id: activeTenant.id,
          tenant_id: activeTenant.id,
          enabled_global: settings.enabled_global,
          timezone: settings.timezone,
          base_system_prompt: settings.base_system_prompt,
          system_prompt: settings.base_system_prompt,
          fallback_offhours_message: settings.fallback_offhours_message,
          policies_json: settings.policies_json as Json,
          memory_message_count: settings.memory_message_count,
          enable_auto_summary: settings.enable_auto_summary,
          anti_spam_seconds: settings.anti_spam_seconds,
          max_messages_per_hour: settings.max_messages_per_hour,
          human_request_pause_hours: settings.human_request_pause_hours,
          schedule_json: settings.schedule_json as unknown as Json,
          temperature: settings.temperature ?? null,
          model_name: settings.model_name ?? null,
        })
        .select('id')
        .single();

      if (error) throw error;
      toast({ title: 'Configurações salvas!' });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao salvar' });
    } finally {
      setSaving(false);
    }
  };

  const handleResetPrompt = () => {
    if (!settings) return;
    setSettings({ ...settings, base_system_prompt: DEFAULT_PROMPT });
  };

  const handleOpenProviderDialog = (provider?: AIProviderConfig) => {
    if (provider) {
      // Check if the model is a custom one (not in the available models list)
      const availableModels = AVAILABLE_MODELS[provider.provider as keyof typeof AVAILABLE_MODELS] || [];
      const isCustomModel = !availableModels.some(m => m.value === provider.model);
      
      setEditingProvider(provider);
      setProviderForm({
        provider: provider.provider,
        model: isCustomModel ? '' : provider.model,
        customModel: isCustomModel ? provider.model : '',
        useCustomModel: isCustomModel,
        temperature: Number(provider.temperature),
        max_tokens: provider.max_tokens,
        top_p: Number(provider.top_p),
        active: provider.active,
        key_ref: provider.key_ref || '',
      });
    } else {
      setEditingProvider(null);
      setProviderForm({
        provider: 'gemini',
        model: 'gemini-2.5-flash',
        customModel: '',
        useCustomModel: false,
        temperature: 0.7,
        max_tokens: 1024,
        top_p: 1.0,
        active: false,
        key_ref: 'GEMINI_API_KEY',
      });
    }
    setProviderDialogOpen(true);
  };

  const handleSaveProvider = async () => {
    // Determine which model to use
    const modelToSave = providerForm.useCustomModel ? providerForm.customModel : providerForm.model;
    
    if (!modelToSave) {
      toast({ variant: 'destructive', title: 'Erro', description: 'Selecione ou digite um modelo' });
      return;
    }
    
    try {
      if (editingProvider) {
        const { error } = await supabase
          .from('ai_provider_configs')
          .update({
            provider: providerForm.provider,
            model: modelToSave,
            temperature: providerForm.temperature,
            max_tokens: providerForm.max_tokens,
            top_p: providerForm.top_p,
            active: providerForm.active,
            key_ref: providerForm.key_ref || null,
          })
          .eq('id', editingProvider.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('ai_provider_configs')
          .insert({
            provider: providerForm.provider,
            model: modelToSave,
            temperature: providerForm.temperature,
            max_tokens: providerForm.max_tokens,
            top_p: providerForm.top_p,
            active: providerForm.active,
            key_ref: providerForm.key_ref || null,
          });

        if (error) throw error;
      }

      toast({ title: editingProvider ? 'Provedor atualizado!' : 'Provedor criado!' });
      setProviderDialogOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error saving provider:', error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao salvar provedor' });
    }
  };

  const handleDeleteProvider = async (id: string) => {
    try {
      const { error } = await supabase
        .from('ai_provider_configs')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: 'Provedor removido!' });
      fetchData();
    } catch (error) {
      console.error('Error deleting provider:', error);
      toast({ variant: 'destructive', title: 'Erro', description: 'Falha ao remover' });
    }
  };

  const handleToggleProviderActive = async (provider: AIProviderConfig) => {
    try {
      // If activating, deactivate others first
      if (!provider.active) {
        await supabase
          .from('ai_provider_configs')
          .update({ active: false })
          .neq('id', provider.id);
      }

      const { error } = await supabase
        .from('ai_provider_configs')
        .update({ active: !provider.active })
        .eq('id', provider.id);

      if (error) throw error;
      toast({ title: provider.active ? 'Provedor desativado!' : 'Provedor ativado!' });
      fetchData();
    } catch (error) {
      console.error('Error toggling provider:', error);
      toast({ variant: 'destructive', title: 'Erro' });
    }
  };

  const handleTestAI = async () => {
    if (!testMessage.trim()) {
      toast({ variant: 'destructive', title: 'Digite uma mensagem para testar' });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('ai-test', {
        body: {
          message: testMessage,
          teamId: testTeamId || null,
          providerId: testProviderId || null,
          workspaceId: activeTenant?.id || null,
        },
      });

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      setTestResult(data);
      toast({ title: 'Teste concluído!' });
    } catch (error) {
      console.error('Test error:', error);
      const message = error instanceof Error ? error.message : 'Falha ao testar IA';
      toast({ 
        variant: 'destructive', 
        title: 'Erro no teste', 
        description: message,
      });
    } finally {
      setTesting(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    if (logsFilter.status !== 'all' && log.status !== logsFilter.status) return false;
    if (logsFilter.provider !== 'all' && log.provider !== logsFilter.provider) return false;
    return true;
  });

  const workspaceModelOptions = [
    ...WORKSPACE_MODEL_OPTIONS,
    ...providers
      .map((provider) => ({
        value: provider.model,
        label: `${provider.provider.toUpperCase()} - ${provider.model}`,
        hint: PROVIDER_INFO[provider.provider as keyof typeof PROVIDER_INFO]?.description || 'Modelo disponível no provedor configurado.',
      }))
      .filter((option, index, list) => list.findIndex((entry) => entry.value === option.value) === index),
  ];

  const resolvedWorkspaceModel =
    settings?.model_name ||
    providers.find((provider) => provider.active)?.model ||
    'google/gemini-2.5-flash';
  const resolvedWorkspaceTemperature = Number(settings?.temperature ?? 0.7);

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
            <h1 className="text-2xl font-bold">Central de IA</h1>
            <p className="text-muted-foreground">Configure a automação de respostas com IA</p>
          </div>
          {settings && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={settings.enabled_global}
                  onCheckedChange={(checked) => setSettings({ ...settings, enabled_global: checked })}
                />
                <Label>IA Ativa Globalmente</Label>
              </div>
              <Button onClick={handleSaveSettings} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Salvar
              </Button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Tabs defaultValue="prompt" className="space-y-6">
            <TabsList className="flex-wrap">
              <TabsTrigger value="prompt">Prompt & Persona</TabsTrigger>
              <TabsTrigger value="schedule">Horários & Regras</TabsTrigger>
              <TabsTrigger value="providers">Provedores</TabsTrigger>
              <TabsTrigger value="context">Ferramentas & Contexto</TabsTrigger>
              <TabsTrigger value="test">Testar IA</TabsTrigger>
              <TabsTrigger value="logs">Logs</TabsTrigger>
            </TabsList>

            {/* PROMPT TAB */}
            <TabsContent value="prompt" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Prompt do Sistema</CardTitle>
                  <CardDescription>
                    Configure as instruções base para a IA. Use variáveis como {'{{'}'customer_name{'}}'}, {'{{'}'timezone{'}}'}, etc.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Label>Modelo do Workspace</Label>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-4 h-4 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent className="max-w-xs">
                              Escolha o modelo padrão usado por este workspace nas respostas automáticas.
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      <Select
                        value={resolvedWorkspaceModel}
                        onValueChange={(value) => settings && setSettings({ ...settings, model_name: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um modelo" />
                        </SelectTrigger>
                        <SelectContent>
                          {workspaceModelOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        {workspaceModelOptions.find((option) => option.value === resolvedWorkspaceModel)?.hint || 'Modelo padrão para este cliente.'}
                      </p>
                    </div>

                    <div className="space-y-3 rounded-lg border p-4">
                      <div className="flex items-center justify-between">
                        <Label>Criatividade da IA</Label>
                        <Badge variant="secondary">{resolvedWorkspaceTemperature.toFixed(1)}</Badge>
                      </div>
                      <Slider
                        value={[resolvedWorkspaceTemperature]}
                        min={0}
                        max={1}
                        step={0.1}
                        onValueChange={([value]) => settings && setSettings({ ...settings, temperature: value })}
                      />
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>0.0 Precisa</span>
                        <span>1.0 Criativa</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {getTemperatureProfile(resolvedWorkspaceTemperature)}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-lg border p-4">
                    <div>
                      <Label>Biblioteca de Prompts</Label>
                      <p className="text-xs text-muted-foreground">
                        Use um preset como ponto de partida e depois ajuste para o tom do cliente.
                      </p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      {PROMPT_PRESETS.map((preset) => (
                        <button
                          key={preset.key}
                          type="button"
                          onClick={() => settings && setSettings({ ...settings, base_system_prompt: preset.prompt })}
                          className="rounded-lg border bg-background p-3 text-left transition-colors hover:border-primary hover:bg-muted"
                        >
                          <div className="font-medium">{preset.label}</div>
                          <div className="mt-1 text-xs text-muted-foreground">{preset.description}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Prompt Base</Label>
                      <span className="text-xs text-muted-foreground">
                        {settings?.base_system_prompt?.length || 0} caracteres
                      </span>
                    </div>
                    <Textarea
                      value={settings?.base_system_prompt || ''}
                      onChange={(e) => settings && setSettings({ ...settings, base_system_prompt: e.target.value })}
                      className="min-h-[300px] font-mono text-sm"
                      placeholder="Digite o prompt do sistema..."
                    />
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={handleResetPrompt}>
                        <RotateCcw className="w-4 h-4 mr-2" />
                        Restaurar Padrão
                      </Button>
                      <Badge variant="outline" className="font-normal">
                        Workspace atual: {activeTenant?.name || 'Não selecionado'}
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Mensagem de Fallback (Fora do Horário)</Label>
                    <Textarea
                      value={settings?.fallback_offhours_message || ''}
                      onChange={(e) => settings && setSettings({ ...settings, fallback_offhours_message: e.target.value })}
                      className="min-h-[80px]"
                      placeholder="Mensagem enviada quando fora do horário..."
                    />
                  </div>

                  <div className="p-4 bg-muted rounded-lg">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Info className="w-4 h-4" />
                      Variáveis Disponíveis
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {['{{customer_name}}', '{{contact_name}}', '{{company_name}}', '{{agent_name}}', '{{team_name}}', '{{protocol_number}}', '{{timezone}}', '{{business_hours}}', '{{policies}}'].map(v => (
                        <Badge key={v} variant="secondary" className="font-mono text-xs">
                          {v}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* SCHEDULE TAB */}
            <TabsContent value="schedule" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Configurações Globais de Horário</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Fuso Horário</Label>
                      <Select
                        value={settings?.timezone || 'America/Recife'}
                        onValueChange={(v) => settings && setSettings({ ...settings, timezone: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TIMEZONES.map(tz => (
                            <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Anti-Spam (segundos)</Label>
                      <Input
                        type="number"
                        value={settings?.anti_spam_seconds || 5}
                        onChange={(e) => settings && setSettings({ ...settings, anti_spam_seconds: parseInt(e.target.value) || 5 })}
                        min={0}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Máx. msgs/hora por conversa</Label>
                      <Input
                        type="number"
                        value={settings?.max_messages_per_hour || 6}
                        onChange={(e) => settings && setSettings({ ...settings, max_messages_per_hour: parseInt(e.target.value) || 6 })}
                        min={1}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Pausa quando cliente pede humano (horas)</Label>
                    <Input
                      type="number"
                      value={settings?.human_request_pause_hours || 2}
                      onChange={(e) => settings && setSettings({ ...settings, human_request_pause_hours: parseInt(e.target.value) || 2 })}
                      min={1}
                      className="w-32"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Global Schedule Card */}
              <Card>
                <CardHeader>
                  <CardTitle>Horário de Funcionamento Global da IA</CardTitle>
                  <CardDescription>
                    Define quando a IA responde automaticamente. Aplica-se a todas as conversas sem configuração de equipe.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    {DAYS_OF_WEEK.map(day => {
                      const daySchedule = settings?.schedule_json?.days?.[day.key] || { enabled: false, start: '08:00', end: '18:00' };
                      return (
                        <div key={day.key} className="flex items-center gap-4 p-3 border rounded-lg">
                          <Switch
                            checked={daySchedule.enabled}
                            onCheckedChange={(checked) => {
                              if (!settings) return;
                              const newSchedule = { ...settings.schedule_json };
                              newSchedule.days[day.key] = { ...daySchedule, enabled: checked };
                              setSettings({ ...settings, schedule_json: newSchedule });
                            }}
                          />
                          <span className="w-24 font-medium">{day.label}</span>
                          <div className="flex items-center gap-2">
                            <Input
                              type="time"
                              value={daySchedule.start}
                              onChange={(e) => {
                                if (!settings) return;
                                const newSchedule = { ...settings.schedule_json };
                                newSchedule.days[day.key] = { ...daySchedule, start: e.target.value };
                                setSettings({ ...settings, schedule_json: newSchedule });
                              }}
                              disabled={!daySchedule.enabled}
                              className="w-32"
                            />
                            <span className="text-muted-foreground">até</span>
                            <Input
                              type="time"
                              value={daySchedule.end}
                              onChange={(e) => {
                                if (!settings) return;
                                const newSchedule = { ...settings.schedule_json };
                                newSchedule.days[day.key] = { ...daySchedule, end: e.target.value };
                                setSettings({ ...settings, schedule_json: newSchedule });
                              }}
                              disabled={!daySchedule.enabled}
                              className="w-32"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Fora do horário, a IA envia a mensagem de fallback configurada no prompt.
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Configurações por Equipe</CardTitle>
                      <CardDescription>Horários e regras específicas por equipe</CardDescription>
                    </div>
                    <Button onClick={() => setTeamDialogOpen(true)} disabled={teams.length === 0}>
                      <Plus className="w-4 h-4 mr-2" />
                      Adicionar Equipe
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {teamSettings.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      Nenhuma configuração de equipe. As regras globais serão usadas.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {teamSettings.map(ts => (
                        <div key={ts.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center gap-4">
                            <Switch
                              checked={ts.enabled}
                              onCheckedChange={async (checked) => {
                                await supabase
                                  .from('ai_team_settings')
                                  .update({ enabled: checked })
                                  .eq('id', ts.id);
                                fetchData();
                              }}
                            />
                            <div>
                              <p className="font-medium">{ts.teams?.name || 'Equipe'}</p>
                              <p className="text-sm text-muted-foreground">
                                {ts.prompt_override ? 'Prompt personalizado' : 'Usando prompt global'}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingTeamSetting(ts);
                                setTeamDialogOpen(true);
                              }}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={async () => {
                                await supabase.from('ai_team_settings').delete().eq('id', ts.id);
                                fetchData();
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* PROVIDERS TAB */}
            <TabsContent value="providers" className="space-y-6">
              {/* Comparison Card */}
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Info className="w-5 h-5" />
                    Comparativo de Provedores
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {Object.entries(PROVIDER_INFO).map(([key, info]) => (
                      <div key={key} className="p-4 rounded-lg border bg-background">
                        <h4 className="font-semibold mb-1">{info.name}</h4>
                        <p className="text-xs text-muted-foreground mb-3">{info.description}</p>
                        <div className="space-y-2 text-xs">
                          <div>
                            <span className="text-green-600 font-medium">✓ Vantagens:</span>
                            <ul className="ml-4 list-disc">
                              {info.pros.map((p, i) => <li key={i}>{p}</li>)}
                            </ul>
                          </div>
                          <div>
                            <span className="text-orange-600 font-medium">○ Considerações:</span>
                            <ul className="ml-4 list-disc">
                              {info.cons.map((c, i) => <li key={i}>{c}</li>)}
                            </ul>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Provedores de IA</CardTitle>
                      <CardDescription>Configure os provedores de IA disponíveis. Apenas um pode estar ativo por vez.</CardDescription>
                    </div>
                    <Button onClick={() => handleOpenProviderDialog()}>
                      <Plus className="w-4 h-4 mr-2" />
                      Adicionar Provedor
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {providers
                      .filter(provider => provider.provider === 'openai' || provider.provider === 'gemini')
                      .map(provider => {
                      const providerInfo = PROVIDER_INFO[provider.provider as keyof typeof PROVIDER_INFO];
                      const expectedKeyRef = providerInfo?.keyRef;
                      const hasCorrectKeyRef = provider.key_ref === expectedKeyRef;
                      
                      return (
                        <div key={provider.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div className="flex items-center gap-4">
                            <Switch
                              checked={provider.active}
                              onCheckedChange={() => handleToggleProviderActive(provider)}
                            />
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium capitalize">{provider.provider}</p>
                                {provider.active && <Badge variant="default">Ativo</Badge>}
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <Badge variant={hasCorrectKeyRef ? "secondary" : "destructive"}>
                                        {hasCorrectKeyRef ? "Secret OK" : "Secret Incorreto"}
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Esperado: {expectedKeyRef}</p>
                                      <p>Atual: {provider.key_ref || 'não definido'}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              </div>
                              <p className="text-sm text-muted-foreground font-mono">{provider.model}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-sm text-muted-foreground">
                              Temp: {provider.temperature} | Tokens: {provider.max_tokens}
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => handleOpenProviderDialog(provider)}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteProvider(provider.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                    {providers.filter(provider => provider.provider === 'openai' || provider.provider === 'gemini').length === 0 && (
                      <p className="text-muted-foreground text-center py-8">
                        Nenhum provedor configurado. Adicione um para usar a IA.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* CONTEXT TAB */}
            <TabsContent value="context" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Memória de Conversa</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Mensagens anteriores para contexto</Label>
                      <Input
                        type="number"
                        value={settings?.memory_message_count || 20}
                        onChange={(e) => settings && setSettings({ ...settings, memory_message_count: parseInt(e.target.value) || 20 })}
                        min={5}
                        max={50}
                      />
                      <p className="text-xs text-muted-foreground">
                        Quantidade de mensagens da conversa enviadas junto com cada pergunta
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={settings?.enable_auto_summary || false}
                          onCheckedChange={(checked) => settings && setSettings({ ...settings, enable_auto_summary: checked })}
                        />
                        <Label>Resumo automático</Label>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Gera resumo da conversa para contexto (em desenvolvimento)
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Políticas de Negócio</CardTitle>
                  <CardDescription>
                    Configure informações que a IA pode usar nas respostas (JSON)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={JSON.stringify(settings?.policies_json || {}, null, 2)}
                    onChange={(e) => {
                      try {
                        const parsed = JSON.parse(e.target.value);
                        settings && setSettings({ ...settings, policies_json: parsed });
                      } catch {
                        // Invalid JSON, ignore
                      }
                    }}
                    className="font-mono text-sm min-h-[200px]"
                    placeholder='{"sla": "24h", "garantia": "30 dias"}'
                  />
                </CardContent>
              </Card>
            </TabsContent>

            {/* TEST TAB */}
            <TabsContent value="test" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Playground de Teste</CardTitle>
                  <CardDescription>Teste a IA antes de ativar em produção</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Equipe (opcional)</Label>
                      <Select value={testTeamId || "__global__"} onValueChange={(v) => setTestTeamId(v === "__global__" ? "" : v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Usar configuração global" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__global__">Global</SelectItem>
                          {teams.map(team => (
                            <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Provedor (opcional)</Label>
                      <Select value={testProviderId || "__active__"} onValueChange={(v) => setTestProviderId(v === "__active__" ? "" : v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Usar provedor ativo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__active__">Ativo</SelectItem>
                          {providers
                            .filter(p => p.provider === 'openai' || p.provider === 'gemini')
                            .map(p => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.provider} - {p.model}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Mensagem do Cliente</Label>
                    <Textarea
                      value={testMessage}
                      onChange={(e) => setTestMessage(e.target.value)}
                      placeholder="Digite uma mensagem simulando um cliente..."
                      className="min-h-[100px]"
                    />
                  </div>

                  <Button onClick={handleTestAI} disabled={testing || !testMessage.trim()}>
                    {testing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                    Gerar Resposta
                  </Button>

                  {testResult && (
                    <div className="space-y-4 pt-4 border-t">
                      <div className="rounded-lg border bg-muted/40 p-4">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">Debug Mode</Badge>
                          <p className="text-sm font-medium">Prompt enviado ao modelo</p>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Aqui você confere como as variáveis do workspace foram resolvidas antes da chamada ao LLM.
                        </p>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="text-xs text-muted-foreground">Provedor</p>
                          <p className="font-medium capitalize">{testResult.provider}</p>
                        </div>
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="text-xs text-muted-foreground">Modelo</p>
                          <p className="font-medium text-sm">{testResult.model}</p>
                        </div>
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="text-xs text-muted-foreground">Tokens</p>
                          <p className="font-medium">{testResult.tokens_in} → {testResult.tokens_out}</p>
                        </div>
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="text-xs text-muted-foreground">Latência</p>
                          <p className="font-medium">{testResult.latency_ms}ms</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Resposta da IA</Label>
                        <div className="p-4 bg-primary/10 rounded-lg whitespace-pre-wrap">
                          {testResult.response}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Prompt Renderizado</Label>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigator.clipboard.writeText(testResult.prompt_rendered)}
                          >
                            <Copy className="w-4 h-4 mr-2" />
                            Copiar
                          </Button>
                        </div>
                        <ScrollArea className="h-[200px] border rounded-lg p-4">
                          <pre className="text-xs whitespace-pre-wrap">{testResult.prompt_rendered}</pre>
                        </ScrollArea>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* LOGS TAB */}
            <TabsContent value="logs" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                      <CardTitle>Logs de IA</CardTitle>
                      <CardDescription>Histórico de chamadas e respostas</CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Select value={logsFilter.status} onValueChange={(v) => setLogsFilter({ ...logsFilter, status: v })}>
                        <SelectTrigger className="w-[150px]">
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          <SelectItem value="success">Sucesso</SelectItem>
                          <SelectItem value="error">Erro</SelectItem>
                          <SelectItem value="skipped">Ignorado</SelectItem>
                        </SelectContent>
                      </Select>

                      <Select value={logsFilter.provider} onValueChange={(v) => setLogsFilter({ ...logsFilter, provider: v })}>
                        <SelectTrigger className="w-[150px]">
                          <SelectValue placeholder="Provedor" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          <SelectItem value="openai">OpenAI</SelectItem>
                          <SelectItem value="gemini">Gemini</SelectItem>
                          <SelectItem value="system">Sistema</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[500px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Provedor</TableHead>
                          <TableHead>Modelo</TableHead>
                          <TableHead>Tokens</TableHead>
                          <TableHead>Latência</TableHead>
                          <TableHead>Resposta</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredLogs.map(log => (
                          <TableRow key={log.id}>
                            <TableCell className="text-sm">
                              {format(new Date(log.created_at), 'dd/MM HH:mm', { locale: ptBR })}
                            </TableCell>
                            <TableCell>
                              <Badge variant={log.status === 'success' ? 'default' : log.status === 'error' ? 'destructive' : 'secondary'}>
                                {log.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="capitalize">{log.provider}</TableCell>
                            <TableCell className="font-mono text-xs">{log.model}</TableCell>
                            <TableCell className="text-sm">
                              {log.tokens_in && log.tokens_out ? `${log.tokens_in}/${log.tokens_out}` : '-'}
                            </TableCell>
                            <TableCell className="text-sm">
                              {log.latency_ms ? `${log.latency_ms}ms` : '-'}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate text-sm">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="cursor-help">
                                      {log.error_message || log.output_text?.substring(0, 50) || '-'}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-[400px]">
                                    <p className="whitespace-pre-wrap">
                                      {log.error_message || log.output_text || 'Sem conteúdo'}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </TableCell>
                          </TableRow>
                        ))}
                        {filteredLogs.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                              Nenhum log encontrado
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {/* Provider Dialog */}
        <Dialog open={providerDialogOpen} onOpenChange={setProviderDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingProvider ? 'Editar Provedor' : 'Novo Provedor'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Provedor</Label>
                <Select
                  value={providerForm.provider}
                  onValueChange={(v) => {
                    const models = AVAILABLE_MODELS[v as keyof typeof AVAILABLE_MODELS];
                    setProviderForm({
                      ...providerForm,
                      provider: v,
                      model: models?.[0]?.value || '',
                      customModel: '',
                      useCustomModel: false,
                      key_ref: v === 'gemini' ? 'GEMINI_API_KEY' : v === 'openai' ? 'OPENAI_API_KEY' : '',
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="gemini">Google Gemini (Recomendado)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Modelo</Label>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={providerForm.useCustomModel}
                      onCheckedChange={(checked) => setProviderForm({ ...providerForm, useCustomModel: checked })}
                    />
                    <Label className="text-xs text-muted-foreground">Modelo custom</Label>
                  </div>
                </div>
                
                {providerForm.useCustomModel ? (
                  <Input
                    value={providerForm.customModel}
                    onChange={(e) => setProviderForm({ ...providerForm, customModel: e.target.value })}
                    placeholder="Ex: gemini-3-flash-preview"
                  />
                ) : (
                  <Select
                    value={providerForm.model}
                    onValueChange={(v) => setProviderForm({ ...providerForm, model: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um modelo" />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABLE_MODELS[providerForm.provider as keyof typeof AVAILABLE_MODELS]?.map(m => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <p className="text-xs text-muted-foreground">
                  {providerForm.useCustomModel 
                    ? 'Digite o nome exato do modelo da API (ex: gemini-3-flash-preview)'
                    : 'Ative "Modelo custom" para usar modelos não listados'}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Nome do Secret (env var)</Label>
                <Select
                  value={providerForm.key_ref}
                  onValueChange={(v) => setProviderForm({ ...providerForm, key_ref: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o secret" />
                  </SelectTrigger>
                  <SelectContent>
                    {providerForm.provider === 'openai' && (
                      <SelectItem value="OPENAI_API_KEY">OPENAI_API_KEY</SelectItem>
                    )}
                    {providerForm.provider === 'gemini' && (
                      <SelectItem value="GEMINI_API_KEY">GEMINI_API_KEY</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Variável de ambiente configurada no Supabase Secrets
                </p>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Temperatura</Label>
                  <Input
                    type="number"
                    value={providerForm.temperature}
                    onChange={(e) => setProviderForm({ ...providerForm, temperature: parseFloat(e.target.value) || 0.7 })}
                    min={0}
                    max={2}
                    step={0.1}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max Tokens</Label>
                  <Input
                    type="number"
                    value={providerForm.max_tokens}
                    onChange={(e) => setProviderForm({ ...providerForm, max_tokens: parseInt(e.target.value) || 1024 })}
                    min={100}
                    max={4096}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Top P</Label>
                  <Input
                    type="number"
                    value={providerForm.top_p}
                    onChange={(e) => setProviderForm({ ...providerForm, top_p: parseFloat(e.target.value) || 1.0 })}
                    min={0}
                    max={1}
                    step={0.1}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={providerForm.active}
                  onCheckedChange={(checked) => setProviderForm({ ...providerForm, active: checked })}
                />
                <Label>Ativar este provedor</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setProviderDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveProvider}>
                {editingProvider ? 'Salvar' : 'Criar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Team Settings Dialog */}
        <Dialog open={teamDialogOpen} onOpenChange={(open) => {
          setTeamDialogOpen(open);
          if (!open) setEditingTeamSetting(null);
        }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingTeamSetting ? 'Editar Configuração de Equipe' : 'Nova Configuração de Equipe'}
              </DialogTitle>
            </DialogHeader>
            <TeamSettingsForm
              teams={teams.filter(t => !teamSettings.find(ts => ts.team_id === t.id) || editingTeamSetting?.team_id === t.id)}
              existing={editingTeamSetting}
              onSave={async (data) => {
                try {
                  const updateData = {
                    team_id: data.team_id,
                    enabled: data.enabled,
                    prompt_override: data.prompt_override,
                    schedule_json: JSON.parse(JSON.stringify(data.schedule_json)) as Json,
                  };
                  if (editingTeamSetting) {
                    await supabase
                      .from('ai_team_settings')
                      .update(updateData)
                      .eq('id', editingTeamSetting.id);
                  } else {
                    await supabase
                      .from('ai_team_settings')
                      .insert({ ...updateData, team_id: data.team_id! });
                  }
                  toast({ title: 'Configuração salva!' });
                  setTeamDialogOpen(false);
                  setEditingTeamSetting(null);
                  fetchData();
                } catch (error) {
                  toast({ variant: 'destructive', title: 'Erro ao salvar' });
                }
              }}
              onCancel={() => {
                setTeamDialogOpen(false);
                setEditingTeamSetting(null);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

// Team Settings Form Component
function TeamSettingsForm({ 
  teams, 
  existing,
  onSave, 
  onCancel 
}: { 
  teams: Team[];
  existing: AITeamSettings | null;
  onSave: (data: Partial<AITeamSettings>) => void;
  onCancel: () => void;
}) {
  const [teamId, setTeamId] = useState(existing?.team_id || '');
  const [enabled, setEnabled] = useState(existing?.enabled ?? true);
  const [promptOverride, setPromptOverride] = useState(existing?.prompt_override || '');
  const [schedule, setSchedule] = useState<ScheduleJson>(
    existing?.schedule_json || {
      days: {
        monday: { enabled: true, start: '08:00', end: '18:00' },
        tuesday: { enabled: true, start: '08:00', end: '18:00' },
        wednesday: { enabled: true, start: '08:00', end: '18:00' },
        thursday: { enabled: true, start: '08:00', end: '18:00' },
        friday: { enabled: true, start: '08:00', end: '18:00' },
        saturday: { enabled: true, start: '08:00', end: '12:00' },
        sunday: { enabled: false, start: '08:00', end: '12:00' },
      },
      exceptions: [],
    }
  );

  return (
    <div className="space-y-4">
      {!existing && (
        <div className="space-y-2">
          <Label>Equipe</Label>
          <Select value={teamId} onValueChange={setTeamId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma equipe" />
            </SelectTrigger>
            <SelectContent>
              {teams.map(team => (
                <SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Switch checked={enabled} onCheckedChange={setEnabled} />
        <Label>IA ativa para esta equipe</Label>
      </div>

      <div className="space-y-2">
        <Label>Prompt personalizado (opcional)</Label>
        <Textarea
          value={promptOverride}
          onChange={(e) => setPromptOverride(e.target.value)}
          placeholder="Deixe vazio para usar o prompt global..."
          className="min-h-[100px]"
        />
      </div>

      <div className="space-y-2">
        <Label>Horários</Label>
        <div className="space-y-2 max-h-[200px] overflow-auto">
          {DAYS_OF_WEEK.map(day => (
            <div key={day.key} className="flex items-center gap-2">
              <Switch
                checked={schedule.days[day.key]?.enabled || false}
                onCheckedChange={(checked) => {
                  setSchedule({
                    ...schedule,
                    days: {
                      ...schedule.days,
                      [day.key]: { ...schedule.days[day.key], enabled: checked },
                    },
                  });
                }}
              />
              <span className="w-20 text-sm">{day.label}</span>
              <Input
                type="time"
                value={schedule.days[day.key]?.start || '08:00'}
                onChange={(e) => {
                  setSchedule({
                    ...schedule,
                    days: {
                      ...schedule.days,
                      [day.key]: { ...schedule.days[day.key], start: e.target.value },
                    },
                  });
                }}
                className="w-28"
                disabled={!schedule.days[day.key]?.enabled}
              />
              <span className="text-sm">até</span>
              <Input
                type="time"
                value={schedule.days[day.key]?.end || '18:00'}
                onChange={(e) => {
                  setSchedule({
                    ...schedule,
                    days: {
                      ...schedule.days,
                      [day.key]: { ...schedule.days[day.key], end: e.target.value },
                    },
                  });
                }}
                className="w-28"
                disabled={!schedule.days[day.key]?.enabled}
              />
            </div>
          ))}
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button 
          onClick={() => onSave({
            team_id: teamId || existing?.team_id,
            enabled,
            prompt_override: promptOverride || null,
            schedule_json: schedule as unknown as ScheduleJson,
          } as Partial<AITeamSettings>)}
          disabled={!existing && !teamId}
        >
          Salvar
        </Button>
      </DialogFooter>
    </div>
  );
}
