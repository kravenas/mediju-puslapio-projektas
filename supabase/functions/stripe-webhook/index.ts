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
                    await supabase.from("orders").update({
                        stripe_payment_intent_id: typeof session.payment_intent === "string"
                            ? session.payment_intent
                            : session.payment_intent?.id ?? null,
                        stripe_status: "paid",
                        paid_at: new Date().toISOString(),
                    }).eq("id", orderId);
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
