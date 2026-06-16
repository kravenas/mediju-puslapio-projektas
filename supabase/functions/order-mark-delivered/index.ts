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

        const { order_id, delivery_url, delivery_note } = await req.json();
        if (!order_id) return json({ error: "order_id is required" }, 400);

        // Delivery link is how the creator hands the finished work to the client.
        const url = typeof delivery_url === "string" ? delivery_url.trim() : "";
        if (!/^https?:\/\/.+/i.test(url)) {
            return json({ error: "Pristatymo nuoroda privaloma (turi prasidėti http:// arba https://)" }, 400);
        }
        const note = (typeof delivery_note === "string" ? delivery_note.trim().slice(0, 2000) : "") || null;

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
            .select("id, creator_id, status, user_id, service_name")
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
            delivery_url: url,
            delivery_note: note,
        }).eq("id", order.id);

        // Notify the client by email — fire-and-forget, must never block delivery.
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
                        subject: "Tavo užsakymas pristatytas — Medijus",
                        html: `<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;color:#111827">
                            <div style="text-align:center;padding:18px 0 20px;border-bottom:1px solid #e5e7eb;margin-bottom:28px">
                                <img src="${LOGO_URL}" alt="Medijus" width="38" height="38" style="vertical-align:middle">
                                <span style="font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:600;color:#111827;vertical-align:middle;margin-left:8px;letter-spacing:-0.5px">Medijus</span>
                            </div>
                            <h2 style="color:#111827">Darbas pristatytas! 🎉</h2>
                            <p>Kūrėjas pristatė tavo užsakymą${order.service_name ? ` „<strong>${order.service_name}</strong>"` : ""}.</p>
                            <p>Peržiūrėk darbą ir per <strong>7 dienas</strong> patvirtink, kad viskas tvarkoje — tada lėšos bus pervestos kūrėjui.</p>
                            <p style="margin-top:24px"><a href="${siteUrl}/profilis" style="background:#D4A017;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;font-weight:600">Peržiūrėti užsakymą</a></p>
                            <p style="color:#6b7280;font-size:12px;margin-top:28px;border-top:1px solid #e5e7eb;padding-top:16px">Medijus — Lietuvos kūrybinė platforma · <a href="${siteUrl}" style="color:#6b7280">medijus.lt</a></p>
                        </div>`,
                    }),
                });
            }
        } catch (_) { /* email failure must not affect the order */ }

        return json({ ok: true, approval_deadline: deadline.toISOString() });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return json({ error: message }, 500);
    }
});
