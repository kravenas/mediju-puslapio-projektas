// order-admin-resolve: admin decides a disputed order.
// Two actions:
//   { resolution: "refund", notes: "..." }   → refund 100% to client
//   { resolution: "release", notes: "..." }  → transfer 90% to creator (10% platform fee retained)
// Deploy: supabase functions deploy order-admin-resolve
//
// Required secrets (in addition to the standard set):
//   ADMIN_EMAILS  — comma-separated list of admin emails authorized to call this

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

const adminEmails = (Deno.env.get("ADMIN_EMAILS") ?? "")
    .split(",").map(e => e.trim().toLowerCase()).filter(Boolean);

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

    try {
        const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
        if (!token) return json({ error: "Missing token" }, 401);

        const { order_id, resolution, notes } = await req.json();
        if (!order_id) return json({ error: "order_id is required" }, 400);
        if (!["refund", "release"].includes(resolution)) {
            return json({ error: "resolution must be 'refund' or 'release'" }, 400);
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

        const userClient = createClient(supabaseUrl, serviceKey, {
            global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: userData, error: userErr } = await userClient.auth.getUser(token);
        if (userErr || !userData?.user) return json({ error: "Invalid token" }, 401);

        const email = (userData.user.email ?? "").toLowerCase();
        if (!adminEmails.includes(email)) {
            return json({ error: "Admin access required" }, 403);
        }

        const admin = createClient(supabaseUrl, serviceKey);

        const { data: order, error: orderErr } = await admin
            .from("orders")
            .select("id, creator_id, amount_cents, platform_fee_cents, status, stripe_transfer_id, stripe_refund_id, stripe_payment_intent_id")
            .eq("id", order_id)
            .single();

        if (orderErr || !order) return json({ error: "Order not found" }, 404);
        if (order.status !== "disputed") {
            return json({ error: `Cannot admin-resolve order in status: ${order.status}` }, 409);
        }

        const now = new Date().toISOString();
        const trimmedNotes = (notes ?? "").toString().trim().slice(0, 2000) || null;

        if (resolution === "refund") {
            if (order.stripe_refund_id) {
                return json({ ok: true, refund_id: order.stripe_refund_id, already_done: true });
            }
            if (!order.stripe_payment_intent_id) {
                return json({ error: "No payment intent on order" }, 422);
            }
            const refund = await stripe.refunds.create({
                payment_intent: order.stripe_payment_intent_id,
                metadata: { order_id: order.id, type: "admin_refund" },
            }, {
                idempotencyKey: `refund_${order.id}`,
            });
            await admin.from("orders").update({
                status: "refunded",
                refunded_at: now,
                admin_resolved_at: now,
                admin_resolution_notes: trimmedNotes,
                stripe_refund_id: refund.id,
            }).eq("id", order.id);
            return json({ ok: true, refund_id: refund.id });
        }

        // resolution === "release"
        if (order.stripe_transfer_id) {
            return json({ ok: true, transfer_id: order.stripe_transfer_id, already_done: true });
        }

        const { data: creator } = await admin
            .from("creators")
            .select("stripe_account_id")
            .eq("id", order.creator_id)
            .single();

        if (!creator?.stripe_account_id) return json({ error: "Creator has no Stripe account" }, 422);

        const transferAmount = (order.amount_cents ?? 0) - (order.platform_fee_cents ?? 0);
        if (transferAmount < 1) return json({ error: "Invalid transfer amount" }, 400);

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
            metadata: { order_id: order.id, type: "admin_release" },
        }, {
            idempotencyKey: `transfer_${order.id}`,
        });

        await admin.from("orders").update({
            status: "released",
            released_at: now,
            admin_resolved_at: now,
            admin_resolution_notes: trimmedNotes,
            stripe_transfer_id: transfer.id,
        }).eq("id", order.id);

        return json({ ok: true, transfer_id: transfer.id });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return json({ error: message }, 500);
    }
});
