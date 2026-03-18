import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface UsageStatsProps {
  label: string;
  used: number;
  limit: number | null;
  unit: string;
}

function getUsageTone(ratio: number) {
  if (ratio >= 1) {
    return {
      badge: 'destructive' as const,
      barClassName: 'bg-destructive',
      label: 'Limite atingido',
    };
  }
  if (ratio >= 0.8) {
    return {
      badge: 'secondary' as const,
      barClassName: 'bg-amber-500',
      label: 'Atenção',
    };
  }
  return {
    badge: 'outline' as const,
    barClassName: 'bg-emerald-500',
    label: 'Saudável',
  };
}

export function UsageStats({ label, used, limit, unit }: UsageStatsProps) {
  const ratio = limit && limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
  const tone = getUsageTone(limit && limit > 0 ? used / limit : 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">{label}</CardTitle>
          <Badge variant={tone.badge}>{limit ? tone.label : 'Sem limite'}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-end justify-between gap-4">
          <div className="text-2xl font-semibold">
            {used.toLocaleString('pt-BR')}
          </div>
          <div className="text-sm text-muted-foreground">
            {limit ? `${limit.toLocaleString('pt-BR')} ${unit}` : `Ilimitado ${unit}`}
          </div>
        </div>
        <Progress
          value={limit ? ratio : 100}
          indicatorClassName={tone.barClassName}
          className={cn('h-3', !limit && 'opacity-60')}
        />
        <p className="text-xs text-muted-foreground">
          {limit
            ? `${used.toLocaleString('pt-BR')} de ${limit.toLocaleString('pt-BR')} ${unit} usados neste ciclo`
            : 'Este plano não possui limite configurado para esta métrica.'}
        </p>
      </CardContent>
    </Card>
  );
}
