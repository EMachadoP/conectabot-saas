import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "npm:stripe@17.7.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_STATUSES = new Set(["active", "trialing", "past_due", "unpaid"]);

function normalizePeriodEnd(timestamp?: number | null) {
  return timestamp ? new Date(timestamp * 1000).toISOString() : null;
}

function scoreSubscription(subscription: Stripe.Subscription, workspaceId: string) {
  let score = 0;

  if (subscription.metadata?.workspace_id === workspaceId) score += 100;
  if (subscription.status === "active") score += 20;
  if (subscription.status === "trialing") score += 15;
  if (subscription.status === "past_due") score += 5;

  return score;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");

    if (!stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY não configurada");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const workspaceId = String(body.workspaceId || "");

    if (!workspaceId) {
      return new Response(JSON.stringify({ error: "workspaceId é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: membership, error: membershipError } = await supabaseAdmin
      .from("tenant_members")
      .select("role, is_active")
      .eq("tenant_id", workspaceId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError) {
      throw new Error(`Falha ao validar permissão: ${membershipError.message}`);
    }

    if (!membership?.is_active || !["owner", "admin"].includes(membership.role)) {
      return new Response(JSON.stringify({ error: "Apenas admins ou owners podem sincronizar billing" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: localSubscription, error: localSubscriptionError } = await supabaseAdmin
      .from("subscriptions")
      .select("id, stripe_customer_id, stripe_subscription_id")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (localSubscriptionError) {
      throw new Error(`Falha ao carregar subscription local: ${localSubscriptionError.message}`);
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2024-06-20",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const candidateSubscriptions: Stripe.Subscription[] = [];
    const seenSubscriptionIds = new Set<string>();

    const pushCandidate = (subscription: Stripe.Subscription | null | undefined) => {
      if (!subscription) return;
      if (!ALLOWED_STATUSES.has(subscription.status)) return;
      if (seenSubscriptionIds.has(subscription.id)) return;
      seenSubscriptionIds.add(subscription.id);
      candidateSubscriptions.push(subscription);
    };

    if (localSubscription?.stripe_subscription_id) {
      try {
        const existing = await stripe.subscriptions.retrieve(localSubscription.stripe_subscription_id);
        pushCandidate(existing);
      } catch (error) {
        console.warn("[sync-stripe-subscription] assinatura local não encontrada no Stripe", error);
      }
    }

    const customerIds = new Set<string>();
    if (localSubscription?.stripe_customer_id) {
      customerIds.add(localSubscription.stripe_customer_id);
    }

    if (user.email) {
      const customers = await stripe.customers.list({ email: user.email, limit: 10 });
      customers.data.forEach((customer) => customerIds.add(customer.id));
    }

    for (const customerId of customerIds) {
      const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 20 });
      subscriptions.data.forEach((subscription) => pushCandidate(subscription));
    }

    if (!candidateSubscriptions.length) {
      return new Response(JSON.stringify({
        synchronized: false,
        error: "Nenhuma assinatura Stripe elegível foi encontrada para este usuário/workspace",
      }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    candidateSubscriptions.sort((left, right) => {
      const scoreDiff = scoreSubscription(right, workspaceId) - scoreSubscription(left, workspaceId);
      if (scoreDiff !== 0) return scoreDiff;
      return right.created - left.created;
    });

    const stripeSubscription = candidateSubscriptions[0];
    const item = stripeSubscription.items.data[0];
    const stripePriceId = item?.price?.id;
    const planIdFromMetadata = stripeSubscription.metadata?.plan_id || null;

    let resolvedPlanId: string | null = planIdFromMetadata;

    if (!resolvedPlanId && stripePriceId) {
      const { data: planByPrice, error: planError } = await supabaseAdmin
        .from("plans")
        .select("id")
        .eq("stripe_price_id", stripePriceId)
        .maybeSingle();

      if (planError) {
        throw new Error(`Falha ao localizar plano por price_id: ${planError.message}`);
      }

      resolvedPlanId = planByPrice?.id || null;
    }

    if (!resolvedPlanId) {
      return new Response(JSON.stringify({
        synchronized: false,
        error: `Não foi possível mapear a assinatura Stripe para um plano local${stripePriceId ? ` (price ${stripePriceId})` : ""}`,
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = {
      workspace_id: workspaceId,
      plan_id: resolvedPlanId,
      status: stripeSubscription.status,
      stripe_customer_id: typeof stripeSubscription.customer === "string" ? stripeSubscription.customer : stripeSubscription.customer?.id || null,
      stripe_subscription_id: stripeSubscription.id,
      current_period_end: normalizePeriodEnd(stripeSubscription.current_period_end),
    };

    if (localSubscription?.id) {
      const { error: updateError } = await supabaseAdmin
        .from("subscriptions")
        .update({
          plan_id: payload.plan_id,
          status: payload.status,
          stripe_customer_id: payload.stripe_customer_id,
          stripe_subscription_id: payload.stripe_subscription_id,
          current_period_end: payload.current_period_end,
        })
        .eq("id", localSubscription.id);

      if (updateError) {
        throw new Error(`Falha ao atualizar subscription local: ${updateError.message}`);
      }
    } else {
      const { error: insertError } = await supabaseAdmin
        .from("subscriptions")
        .insert(payload);

      if (insertError) {
        throw new Error(`Falha ao criar subscription local: ${insertError.message}`);
      }
    }

    return new Response(JSON.stringify({
      synchronized: true,
      workspace_id: workspaceId,
      plan_id: resolvedPlanId,
      stripe_subscription_id: stripeSubscription.id,
      stripe_price_id: stripePriceId,
      status: stripeSubscription.status,
      current_period_end: payload.current_period_end,
      matched_by_workspace_metadata: stripeSubscription.metadata?.workspace_id === workspaceId,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[sync-stripe-subscription]", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
