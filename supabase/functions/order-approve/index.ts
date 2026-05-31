// order-approve: client confirms delivered work → 90% transferred to creator.
// Also used by the cron job (with service-role bypass) for auto-approval after 7d.
// Also used to early-resolve a 'rejected' order if both sides agree (caller is client).
// Deploy: supabase functions deploy order-approve

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
        const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
        if (!token) return json({ error: "Missing token" }, 401);

        const { order_id } = await req.json();
        if (!order_id) return json({ error: "order_id is required" }, 400);

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

        const userClient = createClient(supabaseUrl, serviceKey, {
            global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: userData, error: userErr } = await userClient.auth.getUser(token);
        if (userErr || !userData?.user) return json({ error: "Invalid token" }, 401);
        const userId = userData.user.id;

        const admin = createClient(supabaseUrl, serviceKey);

        const { data: order, error: orderErr } = await admin
            .from("orders")
            .select("id, user_id, creator_id, amount_cents, platform_fee_cents, status, stripe_transfer_id, stripe_payment_intent_id")
            .eq("id", order_id)
            .single();

        if (orderErr || !order) return json({ error: "Order not found" }, 404);
        if (order.user_id !== userId) return json({ error: "Not authorized for this order" }, 403);
        if (!["delivered", "rejected"].includes(order.status)) {
            return json({ error: `Cannot approve order in status: ${order.status}` }, 409);
        }

        // Idempotency: if already transferred, return success
        if (order.stripe_transfer_id) {
            return json({ ok: true, transfer_id: order.stripe_transfer_id, already_done: true });
        }

        const { data: creator } = await admin
            .from("creators")
            .select("stripe_account_id, stripe_charges_enabled")
            .eq("id", order.creator_id)
            .single();

        if (!creator?.stripe_account_id) return json({ error: "Creator has no Stripe account" }, 422);

        const transferAmount = (order.amount_cents ?? 0) - (order.platform_fee_cents ?? 0);
        if (transferAmount < 1) return json({ error: "Invalid transfer amount" }, 400);

        // Look up the charge ID from the PaymentIntent to use as source_transaction.
        // This links the transfer to the original customer payment and ensures
        // Stripe only releases it once the charge has settled.
        let sourceCharge: string | undefined;
        if (order.stripe_payment_intent_id) {
            const pi = await stripe.paymentIntents.retrieve(order.stripe_payment_intent_id);
            const latestCharge = pi.latest_charge;
            sourceCharge = typeof latestCharge === "string" ? latestCharge : latestCharge?.id;
        }

        const transfer = await stripe.transfers.create({
            amount: transferAmount,
            currency: "eur",
            destination: creator.stripe_account_id,
            source_transaction: sourceCharge,
            metadata: { order_id: order.id, type: "client_approval" },
        }, {
            idempotencyKey: `transfer_${order.id}`,
        });

        await admin.from("orders").update({
            status: "approved",
            approved_at: new Date().toISOString(),
            stripe_transfer_id: transfer.id,
        }).eq("id", order.id);

        return json({ ok: true, transfer_id: transfer.id });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return json({ error: message }, 500);
    }
});
