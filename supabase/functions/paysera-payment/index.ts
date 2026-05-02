// Paysera Payment Initiation - Supabase Edge Function
// Deploy with: supabase functions deploy paysera-payment
//
// Required environment variables (set in Supabase Dashboard → Edge Functions → Secrets):
//   PAYSERA_PROJECT_ID  — your Paysera project ID
//   PAYSERA_PASSWORD    — your Paysera project password
//   SITE_URL            — your site URL, e.g. https://artifex.lt

import { crypto } from "https://deno.land/std@0.200.0/crypto/mod.ts";

const PAYSERA_PROJECT_ID = Deno.env.get("PAYSERA_PROJECT_ID") ?? "";
const PAYSERA_PASSWORD   = Deno.env.get("PAYSERA_PASSWORD") ?? "";
const SITE_URL           = Deno.env.get("SITE_URL") ?? "";

// ── MD5 helper ────────────────────────────────────────────────────────────────
async function md5hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "MD5",
    new TextEncoder().encode(input)
  );
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── CORS headers ──────────────────────────────────────────────────────────────
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// ── Handler ───────────────────────────────────────────────────────────────────
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  try {
    const { order_id, amount, service_name } = await req.json();

    if (!order_id || !amount) {
      throw new Error("order_id ir amount yra privalomi");
    }

    if (!PAYSERA_PROJECT_ID || !PAYSERA_PASSWORD) {
      throw new Error(
        "PAYSERA_PROJECT_ID ir PAYSERA_PASSWORD nenustatyti. " +
        "Pridėkite juos Supabase Dashboard → Edge Functions → Secrets."
      );
    }

    // Build Paysera parameter string
    const params = new URLSearchParams({
      projectid:   PAYSERA_PROJECT_ID,
      orderid:     order_id,
      amount:      String(Math.round(amount * 100)), // EUR → centai
      currency:    "EUR",
      country:     "LT",
      lang:        "LIT",
      accepturl:   `${SITE_URL}/checkout-success.html?order=${order_id}`,
      cancelurl:   `${SITE_URL}/checkout-cancel.html?order=${order_id}`,
      callbackurl: `${Deno.env.get("SUPABASE_URL")}/functions/v1/paysera-callback`,
      // Pašalinkite test=1 kai einate į produkciją:
      test:        "1",
    });

    const paramStr = params.toString();
    const data     = btoa(paramStr);
    const sign     = await md5hex(data + PAYSERA_PASSWORD);

    const payseraUrl = `https://www.paysera.com/pay/?data=${encodeURIComponent(data)}&sign=${sign}`;

    return new Response(JSON.stringify({ url: payseraUrl }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
