import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';

type Plan = {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  billing_interval: 'month' | 'year';
  stripe_price_id?: string | null;
  max_messages: number | null;
  max_members: number | null;
  ai_enabled: boolean;
  max_ai_tokens: number | null;
  is_active: boolean;
};

type SubscriptionRow = {
  id: string;
  workspace_id: string;
  plan_id: string;
  status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid';
  current_period_end: string | null;
  plans: Plan | null;
};

type UsageMetric = {
  metric: 'messages_sent' | 'members' | 'ai_tokens';
  label: string;
  used: number;
  limit: number | null;
  unit: string;
};

type BillingOverview = {
  plans: Plan[];
  subscription: SubscriptionRow | null;
  usageMetrics: UsageMetric[];
  maxUsageRatio: number;
};

export function useBillingOverview() {
  const { activeTenant } = useTenant();
  const db = supabase as any;

  return useQuery<BillingOverview>({
    queryKey: ['billing-overview', activeTenant?.id],
    enabled: Boolean(activeTenant?.id),
    queryFn: async () => {
      if (!activeTenant?.id) {
        return {
          plans: [],
          subscription: null,
          usageMetrics: [],
          maxUsageRatio: 0,
        };
      }

      const now = new Date();
      const periodMonth = now.getMonth() + 1;
      const periodYear = now.getFullYear();

      const [plansResult, subscriptionResult, usageResult, membersResult] = await Promise.all([
        db
          .from('plans')
          .select('*')
          .eq('is_active', true)
          .order('price_cents', { ascending: true }),
        db
          .from('subscriptions')
          .select('id, workspace_id, plan_id, status, current_period_end, plans(*)')
          .eq('workspace_id', activeTenant.id)
          .maybeSingle(),
        db
          .from('usage_records')
          .select('metric_name, quantity')
          .eq('workspace_id', activeTenant.id)
          .eq('period_month', periodMonth)
          .eq('period_year', periodYear),
        supabase
          .from('tenant_members')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', activeTenant.id)
          .eq('is_active', true),
      ]);

      if (plansResult.error) throw plansResult.error;
      if (subscriptionResult.error) throw subscriptionResult.error;
      if (usageResult.error) throw usageResult.error;
      if (membersResult.error) throw membersResult.error;

      const plans = (plansResult.data ?? []) as Plan[];
      const subscription = (subscriptionResult.data ?? null) as SubscriptionRow | null;
      const usageMap = new Map<string, number>(
        (usageResult.data ?? []).map((record) => [String(record.metric_name), Number(record.quantity ?? 0)]),
      );
      const currentPlan = (subscription?.plans ?? null) as Plan | null;
      const activeMembers = membersResult.count ?? 0;

      const usageMetrics: UsageMetric[] = [
        {
          metric: 'messages_sent',
          label: 'Mensagens enviadas',
          used: usageMap.get('messages_sent') ?? 0,
          limit: currentPlan?.max_messages ?? null,
          unit: 'mensagens',
        },
        {
          metric: 'members',
          label: 'Membros ativos',
          used: activeMembers,
          limit: currentPlan?.max_members ?? null,
          unit: 'membros',
        },
        {
          metric: 'ai_tokens',
          label: 'Tokens de IA',
          used: usageMap.get('ai_tokens') ?? 0,
          limit: currentPlan?.max_ai_tokens ?? null,
          unit: 'tokens',
        },
      ];

      const maxUsageRatio = usageMetrics.reduce((highest, metric) => {
        if (!metric.limit || metric.limit <= 0) return highest;
        return Math.max(highest, metric.used / metric.limit);
      }, 0);

      return {
        plans,
        subscription,
        usageMetrics,
        maxUsageRatio,
      };
    },
  });
}
