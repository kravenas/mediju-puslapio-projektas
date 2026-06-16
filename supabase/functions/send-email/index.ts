// send-email: internal transactional email sender via Resend.
// Called server-to-server from other edge functions (order lifecycle, etc.).
// Deploy: supabase functions deploy send-email
//
// Required secrets:
//   RESEND_API_KEY  — re_... from https://resend.com (until set, this no-ops gracefully)
//   EMAIL_FROM      — optional, e.g. "Medijus <noreply@medijus.lt>" (domain must be verified in Resend)
//
// Auth: callers must present the project SERVICE_ROLE_KEY as a Bearer token, so
// this endpoint is internal-only (not callable by end users).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

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
        // Internal-only: require the service-role key as bearer token.
        const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
        if (!token || token !== serviceKey) return json({ error: "Unauthorized" }, 401);

        const { to, subject, html, text } = await req.json();
        if (!to || !subject || (!html && !text)) {
            return json({ error: "to, subject and html|text are required" }, 400);
        }

        // Prefer the env secret; fall back to the key stored in vault (set via
        // get_resend_key RPC) since edge secrets can't always be written directly.
        let apiKey = Deno.env.get("RESEND_API_KEY");
        if (!apiKey) {
            try {
                const admin = createClient(
                    Deno.env.get("SUPABASE_URL")!,
                    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
                );
                const { data } = await admin.rpc("get_resend_key");
                if (data) apiKey = data as string;
            } catch (_) { /* fall through to graceful no-op */ }
        }
        // Graceful no-op until the key is configured — never block the caller's flow.
        if (!apiKey) return json({ skipped: true, reason: "RESEND_API_KEY not configured" });

        const from = Deno.env.get("EMAIL_FROM") || "Medijus <onboarding@resend.dev>";

        const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                from,
                to: Array.isArray(to) ? to : [to],
                subject,
                html: html || undefined,
                text: text || undefined,
            }),
        });

        if (!res.ok) {
            const body = await res.text();
            return json({ error: "Resend error", status: res.status, body }, 502);
        }
        return json({ sent: true });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return json({ error: message }, 500);
    }
});
