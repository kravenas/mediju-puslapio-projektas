// order-mark-delivered: creator marks a paid order as delivered.
// Starts the 7-day approval window for the client.
// Deploy: supabase functions deploy order-mark-delivered

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const APPROVAL_WINDOW_DAYS = 7;

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
            .select("id, creator_id, status")
            .eq("id", order_id)
            .single();

        if (orderErr || !order) return json({ error: "Order not found" }, 404);
        if (order.status !== "paid") {
            return json({ error: `Cannot deliver order in status: ${order.status}` }, 409);
        }

        // Verify caller owns the creator profile linked to this order
        const { data: creator } = await admin
            .from("creators")
            .select("user_id")
            .eq("id", order.creator_id)
            .single();

        if (!creator || creator.user_id !== userId) {
            return json({ error: "Not authorized" }, 403);
        }

        const now = new Date();
        const deadline = new Date(now.getTime() + APPROVAL_WINDOW_DAYS * 24 * 60 * 60 * 1000);

        await admin.from("orders").update({
            status: "delivered",
            delivered_at: now.toISOString(),
            approval_deadline: deadline.toISOString(),
        }).eq("id", order.id);

        return json({ ok: true, approval_deadline: deadline.toISOString() });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return json({ error: message }, 500);
    }
});
