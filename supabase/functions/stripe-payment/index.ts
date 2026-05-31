// Stripe Payment - Create Checkout Session for an order
// Deploy with: supabase functions deploy stripe-payment
//
// Required secrets (Supabase Dashboard → Edge Functions → Secrets):
//   STRIPE_SECRET_KEY   — sk_test_... (or sk_live_... when MB is registered)
//   SITE_URL            — e.g. https://mediju-puslapio-projektas.vercel.app
//
// Flow: client posts { order_id }, server re-reads price + creator from DB
// (never trusts client amount), creates Checkout Session. Funds land in the
// platform's Stripe balance (escrow). Transfer to creator happens later in
// order-approve once the client confirms (or auto-approves after 7 days).

import Stripe from "https://esm.sh/stripe@17.5.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
    httpClient: Stripe.createFetchHttpClient(),
});

const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { ...CORS, "Content-Type": "application/json" },
    });

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

    try {
        const authHeader = req.headers.get("Authorization") ?? "";
        const token = authHeader.replace(/^Bearer\s+/i, "");
        if (!token) return json({ error: "Missing token" }, 401);

        const { order_id } = await req.json();
        if (!order_id) return json({ error: "order_id is required" }, 400);

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const siteUrl = Deno.env.get("SITE_URL") ?? "";

        // Resolve caller from JWT
        const userClient = createClient(supabaseUrl, serviceKey, {
            global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: userData, error: userErr } = await userClient.auth.getUser(token);
        if (userErr || !userData?.user) return json({ error: "Invalid token" }, 401);
        const userId = userData.user.id;

        // Service-role client for trusted reads/writes
        const admin = createClient(supabaseUrl, serviceKey);

        // Re-fetch order from DB — never trust client-provided amount
        const { data: order, error: orderErr } = await admin
            .from("orders")
            .select("id, user_id, creator_id, service_id, service_name, amount, stripe_checkout_session_id, paid_at")
            .eq("id", order_id)
            .single();

        if (orderErr || !order) return json({ error: "Order not found" }, 404);
        if (order.user_id !== userId) return json({ error: "Not authorized for this order" }, 403);
        if (order.paid_at) return json({ error: "Order already paid" }, 409);

        // If a session already exists for this order, return its URL (idempotent)
        if (order.stripe_checkout_session_id) {
            const existing = await stripe.checkout.sessions.retrieve(order.stripe_checkout_session_id);
            if (existing.status === "open" && existing.url) return json({ url: existing.url });
        }

        const { data: creator, error: creatorErr } = await admin
            .from("creators")
            .select("id, stripe_account_id, stripe_charges_enabled")
            .eq("id", order.creator_id)
            .single();

        if (creatorErr || !creator) return json({ error: "Creator not found" }, 404);
        if (!creator.stripe_account_id || !creator.stripe_charges_enabled) {
            return json({ error: "Kūrėjas dar neprijungė mokėjimų. Susisiekite su juo." }, 422);
        }

        const amountCents = Math.round(Number(order.amount) * 100);
        if (!Number.isFinite(amountCents) || amountCents < 50) {
            return json({ error: "Invalid amount" }, 400);
        }

        // No transfer_data / application_fee_amount: funds land in platform balance.
        // The 90% transfer to the creator is initiated in order-approve.
        const session = await stripe.checkout.sessions.create({
            mode: "payment",
            payment_method_types: ["card"],
            line_items: [{
                quantity: 1,
                price_data: {
                    currency: "eur",
                    unit_amount: amountCents,
                    product_data: { name: order.service_name ?? "Medijus paslauga" },
                },
            }],
            payment_intent_data: {
                metadata: { order_id: order.id, creator_id: creator.id, user_id: userId },
            },
            metadata: { order_id: order.id },
            client_reference_id: order.id,
            success_url: `${siteUrl}/checkout-success.html?order=${order.id}&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${siteUrl}/checkout-cancel.html?order=${order.id}`,
        }, {
            idempotencyKey: `checkout_session_${order.id}`,
        });

        const PLATFORM_FEE_PERCENT = 10;
        const feeCents = Math.round((amountCents * PLATFORM_FEE_PERCENT) / 100);

        await admin.from("orders").update({
            stripe_checkout_session_id: session.id,
            amount_cents: amountCents,
            platform_fee_cents: feeCents,
            currency: "EUR",
            stripe_status: "pending",
        }).eq("id", order.id);

        return json({ url: session.url });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return json({ error: message }, 500);
    }
});
