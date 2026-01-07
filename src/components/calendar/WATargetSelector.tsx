import { useState } from 'react';
import { Check, ChevronsUpDown, Users, User, RefreshCw, Plus, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useWATargets, WATarget } from '@/hooks/useWATargets';
import { normalizePhoneToE164BR, looksLikePhone, formatPhoneDisplay } from '@/lib/phone-utils';
import { useToast } from '@/hooks/use-toast';

interface WATargetSelectorProps {
    value?: WATarget;
    onChange: (target: WATarget | undefined) => void;
    placeholder?: string;
}

export function WATargetSelector({ value, onChange, placeholder = "Buscar contato/grupo..." }: WATargetSelectorProps) {
    const [open, setOpen] = useState(false);
    const [showManualDialog, setShowManualDialog] = useState(false);
    const [manualPhone, setManualPhone] = useState('');
    const [manualName, setManualName] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    const { targets, isLoading, sync, isSyncing, addManualTarget, isAddingManual } = useWATargets();
    const { toast } = useToast();

    const persons = targets.filter(t => t.type === 'person');
    const groups = targets.filter(t => t.type === 'group');

    const handleAddManual = async () => {
        const normalized = normalizePhoneToE164BR(manualPhone);

        if (!normalized) {
            toast({
                variant: 'destructive',
                title: 'Número inválido',
                description: 'Digite um número de telefone válido (ex: 11 99999-9999)',
            });
            return;
        }

        try {
            await addManualTarget({
                phone: normalized,
                display_name: manualName || normalized,
            });

            // Reset and close
            setManualPhone('');
            setManualName('');
            setShowManualDialog(false);
            setOpen(true); // Reopen selector to show new entry
        } catch (error) {
            // Error already handled by hook
        }
    };

    const showAddManualOption = looksLikePhone(searchQuery);

    return (
        <>
            <div className="flex gap-2">
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={open}
                            className="flex-1 justify-between"
                        >
                            {value ? (
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                    {value.type === 'group' ? <Users className="w-4 h-4 shrink-0" /> : <User className="w-4 h-4 shrink-0" />}
                                    <span className="truncate">{value.display_name}</span>
                                    {value.phone_e164 && (
                                        <span className="text-muted-foreground text-xs shrink-0">
                                            ({value.phone_e164.substring(2)})
                                        </span>
                                    )}
                                    <Badge
                                        variant={value.source === 'sync' ? 'secondary' : 'outline'}
                                        className="ml-auto text-[10px] shrink-0"
                                    >
                                        {value.source === 'sync' ? '📱' : '✏️'}
                                    </Badge>
                                </div>
                            ) : (
                                placeholder
                            )}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0" align="start">
                        <Command shouldFilter={false}>
                            <CommandInput
                                placeholder="Digite para buscar..."
                                value={searchQuery}
                                onValueChange={setSearchQuery}
                            />
                            <CommandEmpty>
                                {isLoading ? (
                                    <div className="p-4 text-sm text-center text-muted-foreground">
                                        Carregando...
                                    </div>
                                ) : showAddManualOption ? (
                                    <div className="p-2">
                                        <p className="text-sm text-muted-foreground mb-2 px-2">
                                            Nenhum contato encontrado.
                                        </p>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="w-full justify-start"
                                            onClick={() => {
                                                setManualPhone(searchQuery);
                                                setShowManualDialog(true);
                                                setOpen(false);
                                            }}
                                        >
                                            <Plus className="w-4 h-4 mr-2" />
                                            Adicionar número: {searchQuery}
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="p-4 text-sm text-center text-muted-foreground">
                                        Nenhum contato encontrado.
                                    </div>
                                )}
                            </CommandEmpty>

                            {persons.length > 0 && (
                                <CommandGroup heading="Pessoas">
                                    {persons
                                        .filter(target =>
                                            !searchQuery ||
                                            target.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                            target.phone_e164?.includes(searchQuery.replace(/\D/g, ''))
                                        )
                                        .map((target) => (
                                            <CommandItem
                                                key={target.id}
                                                value={target.id}
                                                onSelect={() => {
                                                    onChange(target);
                                                    setOpen(false);
                                                    setSearchQuery('');
                                                }}
                                            >
                                                <Check
                                                    className={cn(
                                                        "mr-2 h-4 w-4",
                                                        value?.id === target.id ? "opacity-100" : "opacity-0"
                                                    )}
                                                />
                                                <User className="w-4 h-4 mr-2 text-muted-foreground" />
                                                <div className="flex flex-col flex-1 min-w-0">
                                                    <span className="truncate">{target.display_name}</span>
                                                    {target.phone_e164 && (
                                                        <span className="text-xs text-muted-foreground">
                                                            {formatPhoneDisplay(target.phone_e164)}
                                                        </span>
                                                    )}
                                                </div>
                                                <Badge
                                                    variant={target.source === 'sync' ? 'secondary' : 'outline'}
                                                    className="ml-2 text-[10px]"
                                                >
                                                    {target.source === 'sync' ? '📱' : '✏️'}
                                                </Badge>
                                            </CommandItem>
                                        ))}
                                </CommandGroup>
                            )}

                            {groups.length > 0 && (
                                <CommandGroup heading="Grupos">
                                    {groups
                                        .filter(target =>
                                            !searchQuery ||
                                            target.display_name.toLowerCase().includes(searchQuery.toLowerCase())
                                        )
                                        .map((target) => (
                                            <CommandItem
                                                key={target.id}
                                                value={target.id}
                                                onSelect={() => {
                                                    onChange(target);
                                                    setOpen(false);
                                                    setSearchQuery('');
                                                }}
                                            >
                                                <Check
                                                    className={cn(
                                                        "mr-2 h-4 w-4",
                                                        value?.id === target.id ? "opacity-100" : "opacity-0"
                                                    )}
                                                />
                                                <Users className="w-4 h-4 mr-2 text-muted-foreground" />
                                                <span className="flex-1 truncate">{target.display_name}</span>
                                                <Badge variant="secondary" className="ml-2 text-[10px]">
                                                    📱
                                                </Badge>
                                            </CommandItem>
                                        ))}
                                </CommandGroup>
                            )}
                        </Command>
                    </PopoverContent>
                </Popover>
                <Button
                    variant="outline"
                    size="icon"
                    onClick={() => sync()}
                    disabled={isSyncing}
                    title="Sincronizar contatos/grupos do WhatsApp"
                >
                    <RefreshCw className={cn("w-4 h-4", isSyncing && "animate-spin")} />
                </Button>
            </div>

            {/* Manual Entry Dialog */}
            <Dialog open={showManualDialog} onOpenChange={setShowManualDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Adicionar número manualmente</DialogTitle>
                        <DialogDescription>
                            Digite o número de telefone e um nome opcional para identificação.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="phone">
                                Telefone <span className="text-destructive">*</span>
                            </Label>
                            <div className="flex gap-2">
                                <Phone className="w-4 h-4 mt-3 text-muted-foreground" />
                                <Input
                                    id="phone"
                                    placeholder="(11) 99999-9999"
                                    value={manualPhone}
                                    onChange={(e) => setManualPhone(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Formato: DDD + número (ex: 11 99999-9999)
                            </p>
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="name">Nome (opcional)</Label>
                            <Input
                                id="name"
                                placeholder="Ex: João Silva"
                                value={manualName}
                                onChange={(e) => setManualName(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setShowManualDialog(false);
                                setManualPhone('');
                                setManualName('');
                            }}
                        >
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleAddManual}
                            disabled={!manualPhone || isAddingManual}
                        >
                            {isAddingManual ? 'Adicionando...' : 'Adicionar'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
