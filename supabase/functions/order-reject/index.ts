// order-reject: client rejects delivered work. Starts 7-day resolution window.
// During that window, client and creator can negotiate via chat. If they
// agree, client calls order-approve (releases funds) or order-admin-resolve
// path can refund. If 7 days pass, cron escalates to 'disputed' for admin.
// Deploy: supabase functions deploy order-reject

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const RESOLUTION_WINDOW_DAYS = 7;

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
        if (!reason || typeof reason !== "string" || reason.trim().length < 10) {
            return json({ error: "Atmetimo priežastis privaloma (min 10 simbolių)" }, 400);
        }

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
            .select("id, user_id, status")
            .eq("id", order_id)
            .single();

        if (orderErr || !order) return json({ error: "Order not found" }, 404);
        if (order.user_id !== userId) return json({ error: "Not authorized for this order" }, 403);
        if (order.status !== "delivered") {
            return json({ error: `Cannot reject order in status: ${order.status}` }, 409);
        }

        const now = new Date();
        const deadline = new Date(now.getTime() + RESOLUTION_WINDOW_DAYS * 24 * 60 * 60 * 1000);

        await admin.from("orders").update({
            status: "rejected",
            rejected_at: now.toISOString(),
            rejection_reason: reason.trim().slice(0, 2000),
            resolution_deadline: deadline.toISOString(),
        }).eq("id", order.id);

        return json({ ok: true, resolution_deadline: deadline.toISOString() });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return json({ error: message }, 500);
    }
});
