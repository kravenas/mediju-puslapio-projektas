// Account deletion - GDPR Article 17 (Right to be forgotten)
// Deploy with: supabase functions deploy delete-account
//
// Required environment variables (set in Supabase Dashboard → Edge Functions → Secrets):
//   SUPABASE_URL                 — auto-injected by Supabase
//   SUPABASE_SERVICE_ROLE_KEY    — auto-injected by Supabase

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response(null, { headers: CORS });
    }

    try {
        const authHeader = req.headers.get("Authorization") ?? "";
        const token = authHeader.replace(/^Bearer\s+/i, "");
        if (!token) {
            return json({ error: "Missing token" }, 401);
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

        // 1. Resolve caller from JWT using a user-scoped client.
        const userClient = createClient(supabaseUrl, serviceKey, {
            global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: userData, error: userErr } = await userClient.auth.getUser(token);
        if (userErr || !userData?.user) {
            return json({ error: "Invalid token" }, 401);
        }
        const userId = userData.user.id;

        // 2. Admin client removes all dependent rows (FK-safe) then the auth user.
        const admin = createClient(supabaseUrl, serviceKey);

        // Single transactional cleanup of every row that would otherwise block
        // auth deletion (subscriptions, conversations, messages, creator data,
        // orders, etc.) — see purge_user_dependents().
        const { error: purgeErr } = await admin.rpc("purge_user_dependents", { p_uid: userId });
        if (purgeErr) {
            return json({ error: "Cleanup failed: " + purgeErr.message }, 500);
        }

        // 3. Finally delete the auth user.
        const { error: delErr } = await admin.auth.admin.deleteUser(userId);
        if (delErr) {
            return json({ error: "Auth deletion failed: " + delErr.message }, 500);
        }

        return json({ success: true });
    } catch (err) {
        return json({ error: (err as Error).message }, 500);
    }
});

function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...CORS, "Content-Type": "application/json" },
    });
}
