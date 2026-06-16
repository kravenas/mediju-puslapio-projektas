// Stripe Connect onboarding — create/refresh an Express account onboarding link.
// Deploy with: supabase functions deploy stripe-connect-onboard
//
// Required secrets:
//   STRIPE_SECRET_KEY  — sk_test_... / sk_live_...
//   SITE_URL           — e.g. https://mediju-puslapio-projektas.vercel.app
//
// Flow: a creator clicks "Connect Stripe" in their profile → this function
// creates (or retrieves) their Connect Express account, generates a fresh
// AccountLink, and returns the URL. Stripe hosts the KYC form. When done,
// Stripe redirects back to SITE_URL/profilis.html?stripe=return.

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

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const siteUrl = Deno.env.get("SITE_URL") ?? "";
        // Prefer the caller's Origin so the Stripe return lands back where the user
        // actually is (localhost while testing, the real domain in prod).
        const reqOrigin = req.headers.get("origin") ?? "";
        const redirectBase = (/^https?:\/\//i.test(reqOrigin) ? reqOrigin : siteUrl).replace(/\/+$/, "");

        const userClient = createClient(supabaseUrl, serviceKey, {
            global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: userData, error: userErr } = await userClient.auth.getUser(token);
        if (userErr || !userData?.user) return json({ error: "Invalid token" }, 401);
        const userId = userData.user.id;
        const userEmail = userData.user.email ?? undefined;

        const admin = createClient(supabaseUrl, serviceKey);

        const { data: creator, error: creatorErr } = await admin
            .from("creators")
            .select("id, user_id, stripe_account_id")
            .eq("user_id", userId)
            .single();

        if (creatorErr || !creator) {
            return json({ error: "Creator profile not found" }, 404);
        }

        let accountId = creator.stripe_account_id;

        if (!accountId) {
            const account = await stripe.accounts.create({
                type: "express",
                country: "LT",
                email: userEmail,
                capabilities: {
                    card_payments: { requested: true },
                    transfers: { requested: true },
                },
                business_type: "individual",
                metadata: { medijus_creator_id: creator.id, medijus_user_id: userId },
            });
            accountId = account.id;

            await admin.from("creators").update({
                stripe_account_id: accountId,
                stripe_onboarding_started_at: new Date().toISOString(),
            }).eq("id", creator.id);
        } else {
            // Sync DB with latest Stripe state on every call. The webhook is the
            // primary source but this catches missed events (e.g. webhook not yet
            // subscribed to account.updated, or events lost in test).
            const account = await stripe.accounts.retrieve(accountId);
            await admin.from("creators").update({
                stripe_charges_enabled: account.charges_enabled,
                stripe_payouts_enabled: account.payouts_enabled,
                stripe_details_submitted: account.details_submitted,
                stripe_updated_at: new Date().toISOString(),
            }).eq("id", creator.id);

            if (account.charges_enabled && account.details_submitted) {
                return json({
                    already_complete: true,
                    charges_enabled: account.charges_enabled,
                    details_submitted: account.details_submitted,
                    payouts_enabled: account.payouts_enabled,
                });
            }
        }

        const link = await stripe.accountLinks.create({
            account: accountId,
            refresh_url: `${redirectBase}/profilis?stripe=refresh`,
            return_url: `${redirectBase}/profilis?stripe=return`,
            type: "account_onboarding",
        });

        return json({ url: link.url, account_id: accountId });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return json({ error: message }, 500);
    }
});
