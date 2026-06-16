// order-decline: creator declines a pending_acceptance order.
// Refunds the client in full and moves status to 'declined'.
// Deploy: supabase functions deploy order-decline

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

        const { order_id, reason } = await req.json();
        if (!order_id) return json({ error: "order_id is required" }, 400);
        const declineReason = (typeof reason === "string" ? reason.trim().slice(0, 500) : "") || null;

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
            .select("id, creator_id, user_id, service_name, status, stripe_payment_intent_id, stripe_refund_id")
            .eq("id", order_id)
            .single();

        if (orderErr || !order) return json({ error: "Order not found" }, 404);
        if (order.status !== "pending_acceptance") {
            return json({ error: `Cannot decline order in status: ${order.status}` }, 409);
        }

        const { data: creator } = await admin
            .from("creators")
            .select("user_id")
            .eq("id", order.creator_id)
            .single();
        if (!creator || creator.user_id !== userId) return json({ error: "Not authorized" }, 403);

        // Full refund to the client.
        let refundId = order.stripe_refund_id as string | null;
        if (!refundId) {
            if (!order.stripe_payment_intent_id) return json({ error: "No payment intent to refund" }, 422);
            const refund = await stripe.refunds.create({
                payment_intent: order.stripe_payment_intent_id,
                metadata: { order_id: order.id, type: "creator_decline" },
            }, { idempotencyKey: `decline_refund_${order.id}` });
            refundId = refund.id;
        }

        const now = new Date().toISOString();
        await admin.from("orders").update({
            status: "declined",
            refunded_at: now,
            stripe_refund_id: refundId,
            rejection_reason: declineReason,
        }).eq("id", order.id);

        // Notify the client — fire-and-forget.
        try {
            const { data: clientUser } = await admin.auth.admin.getUserById(order.user_id);
            const email = clientUser?.user?.email;
            if (email) {
                const siteUrl = (Deno.env.get("SITE_URL") || "https://medijus.lt").replace(/\/+$/, "");
                const LOGO_URL = "https://huqnfqagjsjgotxnecfk.supabase.co/storage/v1/object/public/brand/medijus-mark.png";
                await fetch(`${supabaseUrl}/functions/v1/send-email`, {
                    method: "POST",
                    headers: { "Authorization": `Bearer ${serviceKey}`, "Content-Type": "application/json" },
                    body: JSON.stringify({
                        to: email,
                        subject: "Užsakymas atšauktas — pinigai grąžinti — Medijus",
                        html: `<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;color:#111827">
                            <div style="text-align:center;padding:18px 0 20px;border-bottom:1px solid #e5e7eb;margin-bottom:28px">
                                <img src="${LOGO_URL}" alt="Medijus" width="38" height="38" style="vertical-align:middle">
                                <span style="font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:600;color:#111827;vertical-align:middle;margin-left:8px;letter-spacing:-0.5px">Medijus</span>
                            </div>
                            <h2 style="color:#111827">Kūrėjas negalėjo priimti užsakymo</h2>
                            <p>Deja, kūrėjas negalėjo priimti tavo užsakymo${order.service_name ? ` „<strong>${order.service_name}</strong>"` : ""}.</p>
                            ${declineReason ? `<p style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px"><strong>Priežastis:</strong> ${declineReason}</p>` : ""}
                            <p style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:12px 16px"><strong>💸 Pinigai grąžinami</strong> į tavo kortelę (gali užtrukti kelias darbo dienas).</p>
                            <p>Gali rasti kitą kūrėją mūsų platformoje.</p>
                            <p style="margin-top:24px"><a href="${siteUrl}/kurejai" style="background:#D4A017;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">Rasti kitą kūrėją</a></p>
                            <p style="color:#6b7280;font-size:12px;margin-top:28px;border-top:1px solid #e5e7eb;padding-top:16px">Medijus — Lietuvos kūrybinė platforma · <a href="${siteUrl}" style="color:#6b7280">medijus.lt</a></p>
                        </div>`,
                    }),
                });
            }
        } catch (_) { /* email failure must not affect the refund */ }

        return json({ ok: true, refund_id: refundId });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return json({ error: message }, 500);
    }
});
