// Stripe Webhook handler — verifies signature, updates DB on payment events.
// Deploy with: supabase functions deploy stripe-webhook --no-verify-jwt
// (--no-verify-jwt is required: Stripe posts without a Supabase JWT.)
//
// Required secrets:
//   STRIPE_SECRET_KEY       — sk_test_... / sk_live_...
//   STRIPE_WEBHOOK_SECRET   — whsec_... from Stripe Dashboard → Developers → Webhooks
//
// Events handled:
//   - checkout.session.completed   → mark order paid
//   - payment_intent.payment_failed → mark order failed
//   - account.updated              → sync creator charges/payouts enabled flags

import Stripe from "https://esm.sh/stripe@17.5.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
    httpClient: Stripe.createFetchHttpClient(),
});
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

Deno.serve(async (req: Request) => {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

    const signature = req.headers.get("stripe-signature");
    if (!signature) return new Response("Missing signature", { status: 400 });

    const body = await req.text();
    let event: Stripe.Event;
    try {
        event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return new Response(`Invalid signature: ${message}`, { status: 400 });
    }

    const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Idempotency: skip if we've already processed this event id
    const { data: existing } = await supabase
        .from("stripe_webhook_events")
        .select("id")
        .eq("id", event.id)
        .maybeSingle();

    if (existing) return new Response("Already processed", { status: 200 });

    await supabase.from("stripe_webhook_events").insert({
        id: event.id,
        type: event.type,
        payload: event as unknown as Record<string, unknown>,
    });

    try {
        switch (event.type) {
            case "checkout.session.completed": {
                const session = event.data.object as Stripe.Checkout.Session;
                const orderId = session.metadata?.order_id ?? session.client_reference_id;
                if (orderId && session.payment_status === "paid") {
                    const { data: order } = await supabase.from("orders")
                        .select("id, creator_id, user_id, service_name")
                        .eq("id", orderId).single();

                    // After payment the order waits for the creator to accept within 3 days.
                    // The delivery clock only starts once they accept (see order-accept).
                    const ACCEPT_WINDOW_DAYS = 3;
                    const paidAt = new Date();
                    const acceptanceDeadline = new Date(paidAt.getTime() + ACCEPT_WINDOW_DAYS * 24 * 60 * 60 * 1000);

                    await supabase.from("orders").update({
                        stripe_payment_intent_id: typeof session.payment_intent === "string"
                            ? session.payment_intent
                            : session.payment_intent?.id ?? null,
                        stripe_status: "paid",
                        status: "pending_acceptance",
                        paid_at: paidAt.toISOString(),
                        acceptance_deadline: acceptanceDeadline.toISOString(),
                    }).eq("id", orderId);

                    // Notify the creator by email — fire-and-forget, must never block the webhook.
                    try {
                        if (order?.creator_id) {
                            const { data: creator } = await supabase.from("creators")
                                .select("user_id, name").eq("id", order.creator_id).single();
                            if (creator?.user_id) {
                                const { data: cu } = await supabase.auth.admin.getUserById(creator.user_id);
                                const cEmail = cu?.user?.email;
                                if (cEmail) {
                                    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
                                    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
                                    const siteUrl = (Deno.env.get("SITE_URL") || "https://medijus.lt").replace(/\/+$/, "");
                                    const LOGO_URL = "https://huqnfqagjsjgotxnecfk.supabase.co/storage/v1/object/public/brand/medijus-mark.png";
                                    const acceptBy = acceptanceDeadline.toISOString().slice(0, 10);
                                    await fetch(`${supabaseUrl}/functions/v1/send-email`, {
                                        method: "POST",
                                        headers: { "Authorization": `Bearer ${serviceKey}`, "Content-Type": "application/json" },
                                        body: JSON.stringify({
                                            to: cEmail,
                                            subject: "🎉 Naujas užsakymas — priimk per 3 dienas — Medijus",
                                            html: `<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;color:#111827">
                                                <div style="text-align:center;padding:18px 0 20px;border-bottom:1px solid #e5e7eb;margin-bottom:28px">
                                                    <img src="${LOGO_URL}" alt="Medijus" width="38" height="38" style="vertical-align:middle">
                                                    <span style="font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:600;color:#111827;vertical-align:middle;margin-left:8px;letter-spacing:-0.5px">Medijus</span>
                                                </div>
                                                <h2 style="color:#111827">Gavai naują užsakymą! 🎉</h2>
                                                <p>Klientas apmokėjo užsakymą${order.service_name ? ` „<strong>${order.service_name}</strong>"` : ""}. Lėšos saugomos escrow'e.</p>
                                                <p style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:12px 16px"><strong>Priimk arba atmesk užsakymą iki ${acceptBy}</strong> (per 3 dienas). Priėmus — pristatymo terminas pradedamas skaičiuoti pagal tavo paketą.</p>
                                                <p>Jei nepriimsi laiku, užsakymas bus automatiškai atšauktas ir pinigai grąžinti klientui.</p>
                                                <p style="margin-top:24px"><a href="${siteUrl}/profilis" style="background:#D4A017;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">Peržiūrėti užsakymą</a></p>
                                                <p style="color:#6b7280;font-size:12px;margin-top:28px;border-top:1px solid #e5e7eb;padding-top:16px">Medijus — Lietuvos kūrybinė platforma · <a href="${siteUrl}" style="color:#6b7280">medijus.lt</a></p>
                                            </div>`,
                                        }),
                                    });
                                }
                            }
                        }
                    } catch (_) { /* email failure must not affect payment processing */ }
                }
                break;
            }

            case "payment_intent.payment_failed": {
                const intent = event.data.object as Stripe.PaymentIntent;
                const orderId = intent.metadata?.order_id;
                if (orderId) {
                    await supabase.from("orders").update({
                        stripe_payment_intent_id: intent.id,
                        stripe_status: "failed",
                    }).eq("id", orderId);
                }
                break;
            }

            case "account.updated": {
                const account = event.data.object as Stripe.Account;
                await supabase.from("creators").update({
                    stripe_charges_enabled: account.charges_enabled,
                    stripe_payouts_enabled: account.payouts_enabled,
                    stripe_details_submitted: account.details_submitted,
                    stripe_updated_at: new Date().toISOString(),
                }).eq("stripe_account_id", account.id);
                break;
            }
        }
        return new Response("OK", { status: 200 });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return new Response(`Handler error: ${message}`, { status: 500 });
    }
});
