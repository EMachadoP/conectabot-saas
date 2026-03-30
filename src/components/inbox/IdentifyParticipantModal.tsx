import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from 'sonner';

interface Participant {
  id: string;
  name: string;
  role_type?: string | null;
  confidence: number;
  entity_id?: string | null;
  contact_id: string;
}

interface IdentifyParticipantModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  conversationId: string;
  existingParticipant?: Participant | null;
  onSaved: () => void;
}

export function IdentifyParticipantModal({
  open,
  onOpenChange,
  contactId,
  conversationId,
  existingParticipant,
  onSaved,
}: IdentifyParticipantModalProps) {
  const { activeTenant } = useTenant();
  const [name, setName] = useState('');
  const [roleType, setRoleType] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const hydrateExistingParticipant = async () => {
      if (!open) return;

      if (existingParticipant) {
        setName(existingParticipant.name);
        setRoleType(existingParticipant.role_type || '');

        if (existingParticipant.entity_id) {
          const { data } = await supabase
            .from('entities')
            .select('name')
            .eq('id', existingParticipant.entity_id)
            .maybeSingle();

          setCompanyName(data?.name || '');
        } else {
          setCompanyName('');
        }
      } else {
        setName('');
        setRoleType('');
        setCompanyName('');
      }
    };

    void hydrateExistingParticipant();
  }, [open, existingParticipant]);

  const resolveEntityId = async (rawCompanyName: string) => {
    const normalizedCompanyName = rawCompanyName.trim();
    if (!normalizedCompanyName) return null;

    const { data: existingEntity, error: searchError } = await supabase
      .from('entities')
      .select('id')
      .eq('name', normalizedCompanyName)
      .maybeSingle();

    if (searchError) throw searchError;
    if (existingEntity?.id) return existingEntity.id;

    const { data: newEntity, error: entityError } = await supabase
      .from('entities')
      .insert({
        name: normalizedCompanyName,
        type: 'empresa',
      })
      .select('id')
      .single();

    if (entityError) throw entityError;
    return newEntity.id;
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    if (!activeTenant) {
      toast.error('Nenhum workspace ativo selecionado');
      return;
    }

    setLoading(true);

    try {
      const finalEntityId = await resolveEntityId(companyName);

      if (existingParticipant) {
        const { error } = await supabase
          .from('participants')
          .update({
            workspace_id: activeTenant.id,
            name: name.trim(),
            role_type: roleType.trim() || null,
            entity_id: finalEntityId,
            confidence: 1.0,
          })
          .eq('id', existingParticipant.id);

        if (error) throw error;
      } else {
        const { data: newParticipant, error } = await supabase
          .from('participants')
          .insert({
            workspace_id: activeTenant.id,
            contact_id: contactId,
            name: name.trim(),
            role_type: roleType.trim() || null,
            entity_id: finalEntityId,
            confidence: 1.0,
            is_primary: true,
          })
          .select()
          .single();

        if (error) throw error;

        await supabase
          .from('conversation_participant_state')
          .upsert({
            conversation_id: conversationId,
            current_participant_id: newParticipant.id,
            last_confirmed_at: new Date().toISOString(),
            identification_asked: true,
          }, { onConflict: 'conversation_id' });
      }

      toast.success('Remetente identificado com sucesso');
      onSaved();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving participant:', error);
      toast.error(error?.message || 'Erro ao salvar identificação');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Identificar Remetente</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nome da pessoa"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Função</Label>
            <Input
              id="role"
              value={roleType}
              onChange={(e) => setRoleType(e.target.value)}
              placeholder="Ex.: Diretor, Financeiro, Compras"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="company">Empresa</Label>
            <Input
              id="company"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Nome da empresa"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
