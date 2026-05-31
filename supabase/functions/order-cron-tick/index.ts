// order-cron-tick: invoked hourly by pg_cron.
// 1. delivered + approval_deadline < now()  → transfer to creator (auto-approve)
// 2. rejected  + resolution_deadline < now() → set status 'disputed' (admin queue)
//
// Authenticated via X-Service-Auth header containing SUPABASE_SERVICE_ROLE_KEY.
// (Cannot rely on verify_jwt because pg_cron doesn't supply user JWTs.)
//
// Deploy: with verify_jwt=false.

import Stripe from "https://esm.sh/stripe@17.5.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
    httpClient: Stripe.createFetchHttpClient(),
});

const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });

Deno.serve(async (req: Request) => {
    if (req.method !== "POST") return json({ error: "POST only" }, 405);

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const providedAuth = req.headers.get("X-Service-Auth") ?? "";
    if (providedAuth !== serviceKey) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const now = new Date().toISOString();

    // 1) Auto-escalate rejected → disputed (no Stripe needed)
    const { data: escalated, error: escErr } = await admin
        .from("orders")
        .update({ status: "disputed" })
        .eq("status", "rejected")
        .lt("resolution_deadline", now)
        .select("id");

    if (escErr) return json({ error: `escalate failed: ${escErr.message}` }, 500);

    // 2) Auto-approve delivered → approved + Stripe transfer
    const { data: pending } = await admin
        .from("orders")
        .select("id, creator_id, amount_cents, platform_fee_cents, stripe_transfer_id, stripe_payment_intent_id")
        .eq("status", "delivered")
        .lt("approval_deadline", now);

    const approvedIds: string[] = [];
    const failures: { id: string; error: string }[] = [];

    for (const order of pending ?? []) {
        if (order.stripe_transfer_id) {
            approvedIds.push(order.id);
            continue;
        }
        try {
            const { data: creator } = await admin
                .from("creators")
                .select("stripe_account_id")
                .eq("id", order.creator_id)
                .single();

            if (!creator?.stripe_account_id) {
                failures.push({ id: order.id, error: "no stripe account" });
                continue;
            }

            const transferAmount = (order.amount_cents ?? 0) - (order.platform_fee_cents ?? 0);
            if (transferAmount < 1) {
                failures.push({ id: order.id, error: "invalid amount" });
                continue;
            }

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
                metadata: { order_id: order.id, type: "auto_approval" },
            }, {
                idempotencyKey: `transfer_${order.id}`,
            });

            await admin.from("orders").update({
                status: "approved",
                approved_at: now,
                stripe_transfer_id: transfer.id,
            }).eq("id", order.id);

            approvedIds.push(order.id);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            failures.push({ id: order.id, error: message });
        }
    }

    return json({
        ok: true,
        escalated_to_disputed: (escalated ?? []).map(r => r.id),
        auto_approved: approvedIds,
        failures,
    });
});
