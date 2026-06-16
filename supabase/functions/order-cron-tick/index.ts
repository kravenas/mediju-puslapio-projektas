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
    const admin = createClient(supabaseUrl, serviceKey);

    // Authenticate the cron caller against the shared secret stored in vault
    // (the same value pg_cron sends). This decouples auth from the platform
    // service-role key, which can rotate and previously caused 401s.
    const providedAuth = req.headers.get("X-Service-Auth") ?? "";
    const { data: expectedAuth } = await admin.rpc("cron_auth_token");
    const validAuth = (expectedAuth && providedAuth === expectedAuth) || providedAuth === serviceKey;
    if (!validAuth) return json({ error: "Unauthorized" }, 401);
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

    // 3) Delivery-deadline reminders & overdue notices (work still in progress = 'paid')
    const LOGO_URL = "https://huqnfqagjsjgotxnecfk.supabase.co/storage/v1/object/public/brand/medijus-mark.png";
    const siteUrl = (Deno.env.get("SITE_URL") || "https://medijus.lt").replace(/\/+$/, "");

    const emailShell = (heading: string, bodyHtml: string) => `<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;color:#111827">
        <div style="text-align:center;padding:18px 0 20px;border-bottom:1px solid #e5e7eb;margin-bottom:28px">
            <img src="${LOGO_URL}" alt="Medijus" width="38" height="38" style="vertical-align:middle">
            <span style="font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:600;color:#111827;vertical-align:middle;margin-left:8px;letter-spacing:-0.5px">Medijus</span>
        </div>
        <h2 style="color:#111827">${heading}</h2>
        ${bodyHtml}
        <p style="margin-top:24px"><a href="${siteUrl}/profilis" style="background:#D4A017;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">Peržiūrėti užsakymą</a></p>
        <p style="color:#6b7280;font-size:12px;margin-top:28px;border-top:1px solid #e5e7eb;padding-top:16px">Medijus — Lietuvos kūrybinė platforma · <a href="${siteUrl}" style="color:#6b7280">medijus.lt</a></p>
    </div>`;

    const sendEmail = async (to: string, subject: string, html: string) => {
        try {
            await fetch(`${supabaseUrl}/functions/v1/send-email`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${serviceKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({ to, subject, html }),
            });
        } catch (_) { /* never let email break the cron */ }
    };
    const creatorEmail = async (creatorId: string): Promise<string | null> => {
        const { data: creator } = await admin.from("creators").select("user_id").eq("id", creatorId).single();
        if (!creator?.user_id) return null;
        const { data: cu } = await admin.auth.admin.getUserById(creator.user_id);
        return cu?.user?.email ?? null;
    };
    const userEmail = async (userId: string): Promise<string | null> => {
        const { data: u } = await admin.auth.admin.getUserById(userId);
        return u?.user?.email ?? null;
    };

    const reminded: string[] = [];
    const overdueNotified: string[] = [];
    const autoDeclined: string[] = [];

    // 3) Auto-decline: acceptance window expired without creator response → refund client.
    try {
        const { data: expired } = await admin
            .from("orders")
            .select("id, creator_id, user_id, service_name, stripe_payment_intent_id, stripe_refund_id")
            .eq("status", "pending_acceptance")
            .not("acceptance_deadline", "is", null)
            .lt("acceptance_deadline", now);

        for (const o of expired ?? []) {
            try {
                let refundId = o.stripe_refund_id as string | null;
                if (!refundId && o.stripe_payment_intent_id) {
                    const refund = await stripe.refunds.create({
                        payment_intent: o.stripe_payment_intent_id,
                        metadata: { order_id: o.id, type: "acceptance_timeout" },
                    }, { idempotencyKey: `timeout_refund_${o.id}` });
                    refundId = refund.id;
                }
                await admin.from("orders").update({
                    status: "declined",
                    refunded_at: now,
                    stripe_refund_id: refundId,
                    rejection_reason: "Automatiškai atšaukta — kūrėjas nepriėmė užsakymo per 3 dienas",
                }).eq("id", o.id);
                autoDeclined.push(o.id);

                const cEmail = await creatorEmail(o.creator_id);
                if (cEmail) {
                    await sendEmail(cEmail, "Užsakymas atšauktas (nepriimtas laiku) — Medijus", emailShell(
                        "Praleidai priėmimo terminą",
                        `<p>Užsakymas${o.service_name ? ` „<strong>${o.service_name}</strong>"` : ""} buvo automatiškai atšauktas, nes nepriėmei jo per 3 dienas. Pinigai grąžinti klientui.</p>`,
                    ));
                }
                if (o.user_id) {
                    const clEmail = await userEmail(o.user_id);
                    if (clEmail) {
                        await sendEmail(clEmail, "Užsakymas atšauktas — pinigai grąžinti — Medijus", emailShell(
                            "Užsakymas atšauktas",
                            `<p>Kūrėjas nepriėmė tavo užsakymo${o.service_name ? ` „<strong>${o.service_name}</strong>"` : ""} per 3 dienas, todėl jis automatiškai atšauktas.</p>
                             <p style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:12px 16px"><strong>💸 Pinigai grąžinami</strong> į tavo kortelę.</p>`,
                        ));
                    }
                }
            } catch (_) { /* skip this order on failure, try next */ }
        }
    } catch (_) { /* best-effort */ }

    try {
        // 3a) Approaching deadline (within 3 days), not yet reminded → nudge creator
        const in3 = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
        const { data: upcoming } = await admin
            .from("orders")
            .select("id, creator_id, service_name, delivery_deadline")
            .eq("status", "paid")
            .is("deadline_reminder_sent_at", null)
            .not("delivery_deadline", "is", null)
            .gt("delivery_deadline", now)
            .lt("delivery_deadline", in3);

        for (const o of upcoming ?? []) {
            const email = await creatorEmail(o.creator_id);
            if (email) {
                const dl = String(o.delivery_deadline).slice(0, 10);
                await sendEmail(email, "⏰ Artėja pristatymo terminas — Medijus", emailShell(
                    "Liko nedaug laiko ⏰",
                    `<p>Primename: užsakymo${o.service_name ? ` „<strong>${o.service_name}</strong>"` : ""} pristatymo terminas <strong>${dl}</strong> — liko mažiau nei 3 dienos.</p>
                     <p>Nespėji? Gali pakoreguoti terminą savo užsakymų skiltyje, kol darbas dar nepristatytas.</p>`,
                ));
            }
            await admin.from("orders").update({ deadline_reminder_sent_at: now }).eq("id", o.id);
            reminded.push(o.id);
        }

        // 3b) Overdue (deadline passed), still not delivered, not yet notified → tell both sides
        const { data: overdue } = await admin
            .from("orders")
            .select("id, creator_id, user_id, service_name, delivery_deadline")
            .eq("status", "paid")
            .is("overdue_notified_at", null)
            .not("delivery_deadline", "is", null)
            .lt("delivery_deadline", now);

        for (const o of overdue ?? []) {
            const cEmail = await creatorEmail(o.creator_id);
            if (cEmail) {
                await sendEmail(cEmail, "⚠️ Praleistas pristatymo terminas — Medijus", emailShell(
                    "Terminas praleistas ⚠️",
                    `<p>Užsakymo${o.service_name ? ` „<strong>${o.service_name}</strong>"` : ""} pristatymo terminas jau praėjo. Pristatyk darbą kuo greičiau arba susisiek su klientu per platformą.</p>
                     <p>Jei darbas nebus pristatytas, klientas gali atšaukti užsakymą ir atgauti lėšas.</p>`,
                ));
            }
            if (o.user_id) {
                const clEmail = await userEmail(o.user_id);
                if (clEmail) {
                    await sendEmail(clEmail, "Tavo užsakymo terminas praleistas — Medijus", emailShell(
                        "Kūrėjas vėluoja",
                        `<p>Kūrėjas dar nepristatė užsakymo${o.service_name ? ` „<strong>${o.service_name}</strong>"` : ""}, nors terminas jau praėjo.</p>
                         <p>Lėšos vis dar saugiai laikomos escrow'e. Susisiek su kūrėju per platformą — jei darbas nebus pristatytas, galėsi atšaukti ir atgauti pinigus.</p>`,
                    ));
                }
            }
            await admin.from("orders").update({ overdue_notified_at: now }).eq("id", o.id);
            overdueNotified.push(o.id);
        }
    } catch (_) { /* reminders are best-effort; never fail the whole tick */ }

    return json({
        ok: true,
        escalated_to_disputed: (escalated ?? []).map(r => r.id),
        auto_approved: approvedIds,
        auto_declined: autoDeclined,
        deadline_reminded: reminded,
        overdue_notified: overdueNotified,
        failures,
    });
});
