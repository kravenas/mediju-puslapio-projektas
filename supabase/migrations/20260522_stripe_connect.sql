-- Stripe Connect Marketplace migration
-- Switches payment provider from Paysera to Stripe with Connect (Express) for creator payouts.
-- Creates orders table (was missing!) and adds Stripe columns to creators.
-- Run via Supabase SQL editor or `supabase db push`.

-- Make sure pgcrypto is available for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────────
-- orders: was referenced from JS but never created. Building it now.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    creator_id uuid NOT NULL REFERENCES creators(id) ON DELETE RESTRICT,
    service_id uuid,
    service_name text,
    amount numeric(10, 2) NOT NULL,
    currency text NOT NULL DEFAULT 'EUR',
    amount_cents integer,
    platform_fee_cents integer,
    stripe_checkout_session_id text,
    stripe_payment_intent_id text,
    stripe_status text,
    paid_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orders_user_id_idx ON orders (user_id);
CREATE INDEX IF NOT EXISTS orders_creator_id_idx ON orders (creator_id);
CREATE INDEX IF NOT EXISTS orders_stripe_checkout_session_id_idx
    ON orders (stripe_checkout_session_id)
    WHERE stripe_checkout_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS orders_stripe_payment_intent_id_idx
    ON orders (stripe_payment_intent_id)
    WHERE stripe_payment_intent_id IS NOT NULL;

-- RLS: users can only see/insert their own orders. Creators can see orders for their services.
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS orders_select_own ON orders;
CREATE POLICY orders_select_own ON orders
    FOR SELECT USING (
        auth.uid() = user_id
        OR auth.uid() IN (SELECT user_id FROM creators WHERE creators.id = orders.creator_id)
    );

DROP POLICY IF EXISTS orders_insert_own ON orders;
CREATE POLICY orders_insert_own ON orders
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Updates are server-side only (edge function uses service role; clients cannot touch payment state).

-- ─────────────────────────────────────────────────────────────────────────────
-- creators: Stripe Connect Express account state
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE creators
    ADD COLUMN IF NOT EXISTS stripe_account_id text,
    ADD COLUMN IF NOT EXISTS stripe_charges_enabled boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS stripe_payouts_enabled boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS stripe_details_submitted boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS stripe_onboarding_started_at timestamptz,
    ADD COLUMN IF NOT EXISTS stripe_updated_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS creators_stripe_account_id_key
    ON creators (stripe_account_id)
    WHERE stripe_account_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- Webhook event log (idempotency + audit). Server-only.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
    id text PRIMARY KEY,
    type text NOT NULL,
    received_at timestamptz NOT NULL DEFAULT now(),
    payload jsonb NOT NULL
);

ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;
-- No policies = no client access. Service role bypasses RLS.
