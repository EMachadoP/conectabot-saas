import { useEffect, useState } from 'react';
import { Building2, Loader2, Save, UserRound, NotebookPen } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

interface ContactMemoryPanelProps {
  contact: {
    id: string;
    name?: string | null;
    workspace_id?: string | null;
    tenant_id?: string | null;
  };
  currentUserId?: string;
}

interface ContactMemoryState {
  contact_name: string;
  company_name: string;
  role_title: string;
  notes: string;
}

const emptyState: ContactMemoryState = {
  contact_name: '',
  company_name: '',
  role_title: '',
  notes: '',
};

export function ContactMemoryPanel({ contact, currentUserId }: ContactMemoryPanelProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [memoryId, setMemoryId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [form, setForm] = useState<ContactMemoryState>({
    ...emptyState,
    contact_name: contact.name || '',
  });

  useEffect(() => {
    const fetchMemory = async () => {
      if (!contact?.id) return;

      setLoading(true);
      try {
        const client = supabase as any;
        const { data, error } = await client
          .from('contact_memory')
          .select('id, contact_name, company_name, role_title, notes')
          .eq('contact_id', contact.id)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setMemoryId(data.id);
          setForm({
            contact_name: data.contact_name || contact.name || '',
            company_name: data.company_name || '',
            role_title: data.role_title || '',
            notes: data.notes || '',
          });
          setIsExpanded(false);
        } else {
          setMemoryId(null);
          setForm({
            ...emptyState,
            contact_name: contact.name || '',
          });
          setIsExpanded(false);
        }
      } catch (error: any) {
        toast({
          variant: 'destructive',
          title: 'Erro ao carregar dados do contato',
          description: error.message,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchMemory();
  }, [contact?.id, contact?.name, toast]);

  const handleChange = (field: keyof ContactMemoryState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSave = async () => {
    if (!contact?.id || !contact.workspace_id || !contact.tenant_id) {
      toast({
        variant: 'destructive',
        title: 'Contato incompleto',
        description: 'Não foi possível identificar o workspace deste contato.',
      });
      return;
    }

    setSaving(true);
    try {
      const client = supabase as any;
      const payload = {
        contact_id: contact.id,
        workspace_id: contact.workspace_id,
        tenant_id: contact.tenant_id,
        contact_name: form.contact_name || null,
        company_name: form.company_name || null,
        role_title: form.role_title || null,
        notes: form.notes || null,
        updated_by: currentUserId || null,
      };

      const { data, error } = await client
        .from('contact_memory')
        .upsert({
          id: memoryId || undefined,
          ...payload,
          created_by: currentUserId || null,
        }, {
          onConflict: 'contact_id',
        })
        .select('id')
        .single();

      if (error) throw error;
      setMemoryId(data.id);

      if (form.contact_name && form.contact_name !== contact.name) {
        const { error: contactError } = await supabase
          .from('contacts')
          .update({ name: form.contact_name })
          .eq('id', contact.id);

        if (contactError) throw contactError;
      }

      setIsExpanded(false);
      toast({
        title: 'Dados do contato salvos',
        description: 'A IA poderá usar essas informações nas próximas interações.',
      });
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar dados do contato',
        description: error.message,
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="border-b border-border bg-muted/20 px-4 py-3">
        <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando dados do contato...
        </div>
      </div>
    );
  }

  if (!isExpanded) {
    return (
      <div className="border-b border-border bg-muted/20 px-4 py-3">
        <div className="flex items-center justify-end">
          <Button size="sm" variant="outline" onClick={() => setIsExpanded(true)}>
            <NotebookPen className="mr-2 h-4 w-4" />
            {memoryId ? 'Editar memória do contato' : 'Abrir memória do contato'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-border bg-muted/20 px-4 py-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Memória do contato</p>
          <p className="text-xs text-muted-foreground">
            Esses dados ajudam a IA a identificar, contextualizar e encaminhar o cliente mais rápido.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setIsExpanded(false)} disabled={saving}>
            Ocultar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar dados
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="contact-memory-name" className="flex items-center gap-2">
            <UserRound className="h-4 w-4" /> Nome
          </Label>
          <Input
            id="contact-memory-name"
            value={form.contact_name}
            onChange={(event) => handleChange('contact_name', event.target.value)}
            placeholder="Nome do cliente"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="contact-memory-company" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Empresa
          </Label>
          <Input
            id="contact-memory-company"
            value={form.company_name}
            onChange={(event) => handleChange('company_name', event.target.value)}
            placeholder="Empresa ou condomínio"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="contact-memory-role" className="flex items-center gap-2">
            <UserRound className="h-4 w-4" /> Função
          </Label>
          <Input
            id="contact-memory-role"
            value={form.role_title}
            onChange={(event) => handleChange('role_title', event.target.value)}
            placeholder="Cargo ou papel do contato"
          />
        </div>

        <div className="space-y-2 md:col-span-3">
          <Label htmlFor="contact-memory-notes" className="flex items-center gap-2">
            <NotebookPen className="h-4 w-4" /> Observações para a IA
          </Label>
          <Textarea
            id="contact-memory-notes"
            value={form.notes}
            onChange={(event) => handleChange('notes', event.target.value)}
            placeholder="Ex.: cliente prefere tratar com Sérgio, pediu proposta comercial, atua no financeiro."
            rows={3}
          />
        </div>
      </div>
    </div>
  );
}
