import { CreditCard, Loader2, Sparkles, TicketPercent, Users, MessageSquare } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useBillingOverview } from '@/hooks/useBillingOverview';
import { useTenant } from '@/contexts/TenantContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UsageStats } from '@/components/billing/UsageStats';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

function formatPrice(priceCents: number, interval: string) {
  const value = priceCents / 100;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value) + `/${interval === 'year' ? 'ano' : 'mês'}`;
}

function getStatusLabel(status: string | undefined) {
  switch (status) {
    case 'active':
      return 'Ativa';
    case 'trialing':
      return 'Em trial';
    case 'past_due':
      return 'Pagamento pendente';
    case 'canceled':
      return 'Cancelada';
    case 'unpaid':
      return 'Inadimplente';
    default:
      return 'Sem assinatura';
  }
}

export default function BillingSettingsPage() {
  const { activeTenant } = useTenant();
  const { toast } = useToast();
  const { data, isLoading } = useBillingOverview();
  const [checkoutPlanId, setCheckoutPlanId] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const isSuccess = searchParams.get('success') === 'true';
    const isCanceled = searchParams.get('canceled') === 'true';

    if (!isSuccess && !isCanceled) {
      return;
    }

    if (isSuccess) {
      toast({
        title: 'Assinatura confirmada!',
        description: 'Bem-vindo ao próximo nível. Seus limites serão atualizados automaticamente.',
      });
    }

    if (isCanceled) {
      toast({
        variant: 'destructive',
        title: 'Checkout cancelado',
        description: 'Nenhuma cobrança foi concluída. Você pode tentar novamente quando quiser.',
      });
    }

    navigate(location.pathname, { replace: true });
  }, [location.pathname, location.search, navigate, toast]);

  const normalizedCouponCode = couponCode.trim().toUpperCase();

  const handleCheckout = async (planId: string, isCurrent: boolean, hasStripePrice: boolean) => {
    if (isCurrent) {
      toast({
        title: 'Plano atual',
        description: 'Este workspace já está utilizando esse plano.',
      });
      return;
    }

    if (!activeTenant?.id) {
      toast({
        variant: 'destructive',
        title: 'Workspace não encontrado',
        description: 'Selecione um workspace ativo antes de fazer upgrade.',
      });
      return;
    }

    if (!hasStripePrice) {
      toast({
        variant: 'destructive',
        title: 'Plano ainda indisponível',
        description: 'Este plano ainda não está configurado com Stripe Price ID.',
      });
      return;
    }

    try {
      setCheckoutPlanId(planId);
      const { data: result, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          workspaceId: activeTenant.id,
          planId,
          couponCode: normalizedCouponCode || undefined,
          returnUrl: `${window.location.origin}/settings/billing`,
        },
      });

      if (error) {
        throw error;
      }

      if (!result?.url) {
        throw new Error('Checkout não retornou uma URL válida');
      }

      window.location.assign(result.url);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Falha ao iniciar checkout';
      toast({
        variant: 'destructive',
        title: 'Erro ao abrir checkout',
        description: message,
      });
    } finally {
      setCheckoutPlanId(null);
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  const subscription = data?.subscription;
  const currentPlan = subscription?.plans ?? null;

  return (
    <AppLayout>
      <div className="h-full overflow-auto p-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                <h1 className="text-2xl font-bold">Plano & Uso</h1>
              </div>
              <p className="text-muted-foreground">
                Acompanhe consumo, plano atual e próximos upgrades do workspace {activeTenant?.name ? `"${activeTenant.name}"` : ''}.
              </p>
            </div>
            <Card className="min-w-[280px]">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Plano Atual</CardTitle>
                <CardDescription>Visão rápida do ciclo ativo</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xl font-semibold capitalize">
                    {currentPlan?.name ?? 'free'}
                  </div>
                  <Badge variant={subscription?.status === 'active' || subscription?.status === 'trialing' ? 'outline' : 'destructive'}>
                    {getStatusLabel(subscription?.status)}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {currentPlan
                    ? `${formatPrice(currentPlan.price_cents, currentPlan.billing_interval)} • ${currentPlan.description ?? 'Plano configurado para este workspace.'}`
                    : 'Este workspace ainda está no plano inicial.'}
                </p>
                {subscription?.current_period_end && (
                  <p className="text-xs text-muted-foreground">
                    Ciclo atual até {new Date(subscription.current_period_end).toLocaleDateString('pt-BR')}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <section className="grid gap-4 md:grid-cols-3">
            {data?.usageMetrics.map((metric) => (
              <UsageStats
                key={metric.metric}
                label={metric.label}
                used={metric.used}
                limit={metric.limit}
                unit={metric.unit}
              />
            ))}
          </section>

          <Tabs defaultValue="plans" className="space-y-6">
            <TabsList>
              <TabsTrigger value="plans">Planos</TabsTrigger>
              <TabsTrigger value="coupon">Cupom de desconto</TabsTrigger>
            </TabsList>

            <TabsContent value="plans" className="space-y-6">
              <section className="grid gap-4 lg:grid-cols-[1.3fr,0.7fr]">
                <Card>
                  <CardHeader>
                    <CardTitle>Comparativo de Planos</CardTitle>
                    <CardDescription>
                      Escolha o nível de operação ideal para o seu volume de atendimento.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-3">
                    {data?.plans.map((plan) => {
                      const isCurrent = plan.id === currentPlan?.id;
                      return (
                        <div
                          key={plan.id}
                          className={`rounded-xl border p-4 ${isCurrent ? 'border-primary bg-primary/5' : 'bg-card'}`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-lg font-semibold capitalize">{plan.name}</div>
                            {isCurrent && <Badge>Atual</Badge>}
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {plan.description || 'Plano configurado para o workspace.'}
                          </p>
                          <div className="mt-4 text-2xl font-bold">
                            {formatPrice(plan.price_cents, plan.billing_interval)}
                          </div>
                          <div className="mt-4 space-y-2 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <MessageSquare className="h-4 w-4" />
                              {plan.max_messages ? `${plan.max_messages.toLocaleString('pt-BR')} mensagens/mês` : 'Mensagens ilimitadas'}
                            </div>
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              {plan.max_members ? `${plan.max_members} membros` : 'Membros ilimitados'}
                            </div>
                            <div className="flex items-center gap-2">
                              <Sparkles className="h-4 w-4" />
                              {plan.ai_enabled
                                ? `${plan.max_ai_tokens?.toLocaleString('pt-BR') ?? 'IA liberada'} tokens de IA`
                                : 'IA desabilitada'}
                            </div>
                          </div>
                          {normalizedCouponCode && !isCurrent && (
                            <div className="mt-4 rounded-lg border border-dashed border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                              Cupom preparado para o checkout: <strong>{normalizedCouponCode}</strong>
                            </div>
                          )}
                          <Button
                            className="mt-5 w-full"
                            variant={isCurrent ? 'outline' : 'default'}
                            disabled={checkoutPlanId === plan.id}
                            onClick={() => handleCheckout(plan.id, isCurrent, Boolean(plan.stripe_price_id))}
                          >
                            {checkoutPlanId === plan.id
                              ? 'Abrindo checkout...'
                              : isCurrent
                                ? 'Plano em uso'
                                : normalizedCouponCode
                                  ? 'Fechar pedido com cupom'
                                  : 'Fazer upgrade'}
                          </Button>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Leituras do Paywall</CardTitle>
                    <CardDescription>
                      O backend já bloqueia envio e IA quando a assinatura fica pendente ou o limite estoura.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm text-muted-foreground">
                    <div>
                      <div className="font-medium text-foreground">Mensagens</div>
                      <p>Envio de texto e arquivo já conta consumo automaticamente.</p>
                    </div>
                    <div>
                      <div className="font-medium text-foreground">IA</div>
                      <p>Respostas com IA registram tokens e quantidade de replies por workspace.</p>
                    </div>
                    <div>
                      <div className="font-medium text-foreground">Próxima etapa</div>
                      <p>Checkout e webhook Stripe já estão conectados ao fluxo de upgrade.</p>
                    </div>
                  </CardContent>
                </Card>
              </section>
            </TabsContent>

            <TabsContent value="coupon" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <TicketPercent className="h-5 w-5 text-primary" />
                    <CardTitle>Cupom de desconto</CardTitle>
                  </div>
                  <CardDescription>
                    Informe um cupom promocional para aplicar no checkout e fechar o pedido com desconto.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
                    <div className="space-y-2">
                      <Label htmlFor="coupon-code">Código do cupom</Label>
                      <Input
                        id="coupon-code"
                        value={couponCode}
                        onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                        placeholder="Ex: FECHAR10"
                      />
                    </div>
                    <Button type="button" variant="outline" onClick={() => setCouponCode('')}>
                      Limpar cupom
                    </Button>
                  </div>

                  <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                    {normalizedCouponCode ? (
                      <>
                        O cupom <strong className="text-foreground">{normalizedCouponCode}</strong> será enviado ao Stripe ao clicar em um plano na aba <strong className="text-foreground">Planos</strong>.
                      </>
                    ) : (
                      <>
                        Nenhum cupom informado. Se existir um cupom válido no Stripe, preencha aqui antes de abrir o checkout.
                      </>
                    )}
                  </div>

                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>O código é validado no backend antes de abrir o checkout.</p>
                    <p>Se o cupom estiver inválido, expirado ou inativo, o sistema bloqueia o pedido e mostra o erro.</p>
                    <p>Mesmo com cupom aplicado, o checkout do Stripe continua permitindo promoção quando habilitada.</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
}
