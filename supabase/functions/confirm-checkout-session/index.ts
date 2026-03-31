import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "npm:stripe@17.7.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { buildCorsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  const corsHeaders = buildCorsHeaders(req);
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
    const sessionId = String(body.sessionId || "");

    if (!workspaceId || !sessionId) {
      return new Response(JSON.stringify({ error: "workspaceId e sessionId são obrigatórios" }), {
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
      return new Response(JSON.stringify({ error: "Apenas admins ou owners podem reconciliar billing" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2024-06-20",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["subscription"],
    });

    if (session.mode !== "subscription") {
      return new Response(JSON.stringify({ error: "Checkout session inválida para assinatura" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sessionWorkspaceId = String(session.metadata?.workspace_id || "");
    const planId = String(session.metadata?.plan_id || "");

    if (sessionWorkspaceId !== workspaceId || !planId) {
      return new Response(JSON.stringify({ error: "Metadados da sessão não correspondem ao workspace atual" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const subscriptionId = typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id || null;
    const customerId = typeof session.customer === "string"
      ? session.customer
      : session.customer?.id || null;

    if (!subscriptionId || session.payment_status !== "paid") {
      return new Response(JSON.stringify({
        synchronized: false,
        payment_status: session.payment_status,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripeSubscription = typeof session.subscription === "string"
      ? await stripe.subscriptions.retrieve(subscriptionId)
      : session.subscription;

    const currentPeriodEnd = stripeSubscription.current_period_end
      ? new Date(stripeSubscription.current_period_end * 1000).toISOString()
      : null;

    const { error: updateError } = await supabaseAdmin
      .from("subscriptions")
      .update({
        plan_id: planId,
        status: "active",
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        current_period_end: currentPeriodEnd,
      })
      .eq("workspace_id", workspaceId);

    if (updateError) {
      throw new Error(`Falha ao atualizar subscription: ${updateError.message}`);
    }

    return new Response(JSON.stringify({
      synchronized: true,
      workspace_id: workspaceId,
      plan_id: planId,
      stripe_subscription_id: subscriptionId,
      current_period_end: currentPeriodEnd,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[confirm-checkout-session]", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
