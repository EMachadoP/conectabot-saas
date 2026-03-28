import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Save, Loader2, Share2, Info, Activity, RefreshCw, Copy, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ZAPISettings {
  id: string;
  team_id: string | null;
  zapi_instance_id: string | null;
  zapi_token: string | null;
  zapi_security_token: string | null;
  open_tickets_group_id: string | null;
  enable_group_notifications: boolean;
  last_webhook_received_at?: string | null;
  forward_webhook_url?: string | null;
}

export default function AdminZAPIPage() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSignal, setLastSignal] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<'webhook' | null>(null);
  
  const [settings, setSettings] = useState<ZAPISettings>({
    id: '',
    team_id: null,
    zapi_instance_id: '',
    zapi_token: '',
    zapi_security_token: '',
    open_tickets_group_id: '',
    enable_group_notifications: false,
    forward_webhook_url: '',
  });

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('zapi_settings').select('*').is('team_id', null).maybeSingle();
      if (error) throw error;
      if (data) {
        setSettings(data);
        setLastSignal(data.last_webhook_received_at);
      }
    } catch (error: any) {
      console.error('Error fetching settings:', error);
      toast({ variant: 'destructive', title: 'Erro ao carregar', description: error.message });
    } finally {
      setLoading(false);
    }
  };

  const fetchSignalOnly = async () => {
    try {
      const { data } = await supabase
        .from('zapi_settings')
        .select('last_webhook_received_at')
        .is('team_id', null)
        .maybeSingle();
      
      if (data) {
        setLastSignal(data.last_webhook_received_at);
      }
    } catch (error) {
      console.error('Error fetching signal:', error);
    }
  };

  useEffect(() => {
    if (user && isAdmin) {
      fetchSettings();
      const interval = setInterval(fetchSignalOnly, 10000);
      return () => clearInterval(interval);
    }
  }, [user, isAdmin]);

  const webhookUrl = `${(import.meta.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '')}/functions/v1/zapi-webhook`;

  const handleCopy = async (value: string, field: 'webhook') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      toast({ title: 'Copiado', description: 'Valor copiado para a área de transferência.' });
      window.setTimeout(() => setCopiedField(null), 2000);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Erro ao copiar', description: error.message });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        zapi_instance_id: settings.zapi_instance_id || null,
        zapi_token: settings.zapi_token || null,
        zapi_security_token: settings.zapi_security_token || null,
        forward_webhook_url: settings.forward_webhook_url || null,
        team_id: null
      };

      if (settings.id) {
        const { error } = await supabase.from('zapi_settings').update(payload).eq('id', settings.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('zapi_settings').insert(payload).select().single();
        if (error) throw error;
        if (data) setSettings(data);
      }
      toast({ title: 'Configurações salvas com sucesso!' });
    } catch (error: any) {
      console.error('Save error:', error);
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: error.message });
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || roleLoading) return <div className="p-8 text-center">Carregando permissões...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/inbox" replace />;

  const signalTimeDisplay = lastSignal 
    ? formatDistanceToNow(new Date(lastSignal), { addSuffix: true, locale: ptBR })
    : 'Nunca';

  const isOnline = lastSignal && 
    (new Date().getTime() - new Date(lastSignal).getTime() < 120000);

  return (
    <AppLayout>
      <div className="p-6 space-y-6 overflow-auto h-full max-w-4xl mx-auto">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold">Configurações Z-API</h1>
            <p className="text-muted-foreground">Gerencie a conexão com o WhatsApp</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchSettings}>
              <RefreshCw className="w-4 h-4 mr-2" /> Atualizar
            </Button>
            <Button onClick={handleSave} disabled={saving || loading}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin h-8 w-8" /></div>
        ) : (
          <>
            <Card className={isOnline ? 'border-green-500/50 bg-green-500/5' : 'border-primary/50 bg-primary/5'}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Activity className={isOnline ? 'text-green-500 animate-bounce' : 'text-primary animate-pulse'} />
                  Status do Webhook
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold">{lastSignal ? 'Recebendo mensagens' : 'Sem sinal'}</p>
                    <p className="text-xs text-muted-foreground mt-1">Sinal detectado: {signalTimeDisplay}</p>
                  </div>
                  <Badge variant={lastSignal ? "default" : "destructive"}>
                    {isOnline ? 'CONECTADO' : 'AGUARDANDO'}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6">
              <Card>
                <CardHeader><CardTitle>Instância Z-API</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>ID da Instância</Label>
                      <Input 
                        value={settings.zapi_instance_id || ''} 
                        onChange={(e) => setSettings({ ...settings, zapi_instance_id: e.target.value })} 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Token</Label>
                      <Input 
                        type="password" 
                        value={settings.zapi_token || ''} 
                        onChange={(e) => setSettings({ ...settings, zapi_token: e.target.value })} 
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Security Token (Client Token)</Label>
                    <Input 
                      value={settings.zapi_security_token || ''} 
                      onChange={(e) => setSettings({ ...settings, zapi_security_token: e.target.value })} 
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-blue-500/30 bg-blue-500/5">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Info className="w-4 h-4" /> Webhook para configurar na Z-API
                  </CardTitle>
                  <CardDescription>
                    Copie esta URL e cole nos campos de webhook da sua instância Z-API.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>URL do Webhook do Conectbot</Label>
                    <div className="flex gap-2">
                      <Input value={webhookUrl} readOnly />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleCopy(webhookUrl, 'webhook')}
                      >
                        {copiedField === 'webhook' ? (
                          <CheckCircle2 className="w-4 h-4 mr-2" />
                        ) : (
                          <Copy className="w-4 h-4 mr-2" />
                        )}
                        {copiedField === 'webhook' ? 'Copiado' : 'Copiar'}
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-lg border bg-background p-4 text-sm space-y-2">
                    <p className="font-medium">Na Z-API, use essa mesma URL nestes campos:</p>
                    <p>`Ao receber`</p>
                    <p>`Receber status da mensagem`</p>
                    <p>`Ao conectar`</p>
                    <p>`Ao desconectar`</p>
                    <p className="text-muted-foreground pt-2">
                      O mínimo para começar é preencher `Ao receber`, mas o ideal é configurar os quatro para o painel acompanhar o sinal corretamente.
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-amber-500/30">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Share2 className="w-4 h-4" /> Multiplicador (Evolvy)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Label>URL do Evolvy</Label>
                  <Input 
                    placeholder="https://app.evolvy.co/..." 
                    value={settings.forward_webhook_url || ''} 
                    onChange={(e) => setSettings({ ...settings, forward_webhook_url: e.target.value })} 
                  />
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
