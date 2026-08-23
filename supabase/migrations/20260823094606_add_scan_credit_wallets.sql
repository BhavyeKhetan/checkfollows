-- Pooled scan credits for full Instagram following-list scans.
--
-- Account slots and scan capacity are intentionally separate: a subscription
-- controls how many targets a user may track, while this wallet controls how
-- many paid profile records may be fetched. One credit represents up to 1,000
-- following profiles for one complete scan.

CREATE TABLE public.scan_credit_wallets (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  included_balance INTEGER NOT NULL DEFAULT 0 CHECK (included_balance >= 0),
  purchased_balance INTEGER NOT NULL DEFAULT 0 CHECK (purchased_balance >= 0),
  included_allowance INTEGER NOT NULL DEFAULT 0 CHECK (included_allowance >= 0),
  refresh_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  tier TEXT NOT NULL DEFAULT 'base' CHECK (tier IN ('base', 'premium')),
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.scan_credit_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.scan_credit_wallets(user_id) ON DELETE CASCADE,
  target_id UUID REFERENCES public.instagram_targets(id) ON DELETE SET NULL,
  scan_id UUID REFERENCES public.scans(id) ON DELETE SET NULL,
  entry_type TEXT NOT NULL CHECK (
    entry_type IN ('included_grant', 'purchased_grant', 'reservation', 'refund')
  ),
  reason TEXT NOT NULL,
  included_delta INTEGER NOT NULL DEFAULT 0,
  purchased_delta INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (
    status IN ('reserved', 'completed', 'refunded')
  ),
  idempotency_key TEXT NOT NULL UNIQUE,
  reversal_of UUID UNIQUE REFERENCES public.scan_credit_ledger(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_scan_credit_ledger_user_created
  ON public.scan_credit_ledger (user_id, created_at DESC);
CREATE INDEX idx_scan_credit_ledger_target_status
  ON public.scan_credit_ledger (target_id, status);

ALTER TABLE public.scan_credit_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_credit_ledger ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.scan_credit_wallets FROM anon, authenticated;
REVOKE ALL ON public.scan_credit_ledger FROM anon, authenticated;
GRANT ALL ON public.scan_credit_wallets TO service_role;
GRANT ALL ON public.scan_credit_ledger TO service_role;

ALTER TABLE public.subscriptions
  ADD COLUMN scan_credit_auto_limit INTEGER,
  ADD COLUMN scan_credit_consent_at TIMESTAMPTZ,
  ADD COLUMN pending_scan_credit_reservation_id UUID
    REFERENCES public.scan_credit_ledger(id) ON DELETE SET NULL,
  ADD COLUMN scan_credit_blocked_at TIMESTAMPTZ,
  ADD COLUMN scan_credit_required INTEGER;

CREATE INDEX idx_subscriptions_scan_credit_reservation
  ON public.subscriptions (pending_scan_credit_reservation_id)
  WHERE pending_scan_credit_reservation_id IS NOT NULL;

-- Create or refresh the weekly included allowance. This is SECURITY INVOKER
-- and executable only by service_role, so it cannot be called from a browser.
CREATE OR REPLACE FUNCTION public.sync_scan_credit_wallet(
  p_user_id UUID,
  p_tier TEXT,
  p_allowance INTEGER,
  p_stripe_subscription_id TEXT
)
RETURNS TABLE (
  included_balance INTEGER,
  purchased_balance INTEGER,
  included_allowance INTEGER,
  refresh_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_wallet public.scan_credit_wallets%ROWTYPE;
  v_old_allowance INTEGER;
  v_delta INTEGER;
  v_reset_key TEXT;
BEGIN
  IF p_allowance < 0 OR p_tier NOT IN ('base', 'premium') THEN
    RAISE EXCEPTION 'Invalid scan credit wallet configuration';
  END IF;

  INSERT INTO public.scan_credit_wallets (
    user_id,
    included_balance,
    included_allowance,
    refresh_at,
    tier,
    stripe_subscription_id
  )
  VALUES (
    p_user_id,
    p_allowance,
    p_allowance,
    now() + interval '7 days',
    p_tier,
    p_stripe_subscription_id
  )
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_wallet
  FROM public.scan_credit_wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF v_wallet.refresh_at <= now() THEN
    v_reset_key := 'weekly-reset:' || p_user_id::text || ':' || extract(epoch from v_wallet.refresh_at)::bigint::text;
    UPDATE public.scan_credit_wallets
    SET included_balance = included_allowance,
        refresh_at = now() + interval '7 days',
        updated_at = now()
    WHERE user_id = p_user_id
    RETURNING * INTO v_wallet;

    INSERT INTO public.scan_credit_ledger (
      user_id, entry_type, reason, included_delta, status,
      idempotency_key, completed_at
    ) VALUES (
      p_user_id, 'included_grant', 'weekly_reset',
      v_wallet.included_allowance, 'completed', v_reset_key, now()
    ) ON CONFLICT (idempotency_key) DO NOTHING;
  END IF;

  v_old_allowance := v_wallet.included_allowance;
  IF p_allowance > v_old_allowance THEN
    v_delta := p_allowance - v_old_allowance;
    v_wallet.included_balance := v_wallet.included_balance + v_delta;
  ELSIF p_allowance < v_old_allowance THEN
    v_wallet.included_balance := LEAST(v_wallet.included_balance, p_allowance);
  END IF;

  UPDATE public.scan_credit_wallets
  SET included_balance = v_wallet.included_balance,
      included_allowance = p_allowance,
      tier = p_tier,
      stripe_subscription_id = p_stripe_subscription_id,
      updated_at = now()
  WHERE user_id = p_user_id
  RETURNING * INTO v_wallet;

  INSERT INTO public.scan_credit_ledger (
    user_id, entry_type, reason, included_delta, status,
    idempotency_key, completed_at
  ) VALUES (
    p_user_id, 'included_grant', 'initial_plan_allowance',
    p_allowance, 'completed', 'initial-plan:' || p_user_id::text, now()
  ) ON CONFLICT (idempotency_key) DO NOTHING;

  RETURN QUERY SELECT
    v_wallet.included_balance,
    v_wallet.purchased_balance,
    v_wallet.included_allowance,
    v_wallet.refresh_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_purchased_scan_credits(
  p_user_id UUID,
  p_units INTEGER,
  p_idempotency_key TEXT,
  p_reason TEXT DEFAULT 'purchase'
)
RETURNS TABLE (
  granted BOOLEAN,
  included_balance INTEGER,
  purchased_balance INTEGER,
  refresh_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_wallet public.scan_credit_wallets%ROWTYPE;
BEGIN
  IF p_units <= 0 OR length(trim(p_idempotency_key)) = 0 THEN
    RAISE EXCEPTION 'Invalid scan credit grant';
  END IF;

  INSERT INTO public.scan_credit_wallets (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO v_wallet
  FROM public.scan_credit_wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF EXISTS (
    SELECT 1 FROM public.scan_credit_ledger
    WHERE idempotency_key = p_idempotency_key
  ) THEN
    RETURN QUERY SELECT false, v_wallet.included_balance,
      v_wallet.purchased_balance, v_wallet.refresh_at;
    RETURN;
  END IF;

  UPDATE public.scan_credit_wallets
  SET purchased_balance = purchased_balance + p_units,
      updated_at = now()
  WHERE user_id = p_user_id
  RETURNING * INTO v_wallet;

  INSERT INTO public.scan_credit_ledger (
    user_id, entry_type, reason, purchased_delta, status,
    idempotency_key, completed_at
  ) VALUES (
    p_user_id, 'purchased_grant', p_reason, p_units, 'completed',
    p_idempotency_key, now()
  );

  RETURN QUERY SELECT true, v_wallet.included_balance,
    v_wallet.purchased_balance, v_wallet.refresh_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_scan_credits(
  p_user_id UUID,
  p_units INTEGER,
  p_target_id UUID,
  p_reason TEXT,
  p_idempotency_key TEXT
)
RETURNS TABLE (
  reserved BOOLEAN,
  reservation_id UUID,
  included_balance INTEGER,
  purchased_balance INTEGER,
  refresh_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_wallet public.scan_credit_wallets%ROWTYPE;
  v_existing public.scan_credit_ledger%ROWTYPE;
  v_included_used INTEGER;
  v_purchased_used INTEGER;
  v_reservation_id UUID;
BEGIN
  IF p_units <= 0 OR length(trim(p_idempotency_key)) = 0 THEN
    RAISE EXCEPTION 'Invalid scan credit reservation';
  END IF;

  SELECT * INTO v_wallet
  FROM public.scan_credit_wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::UUID, 0, 0, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  IF v_wallet.refresh_at <= now() THEN
    UPDATE public.scan_credit_wallets
    SET included_balance = included_allowance,
        refresh_at = now() + interval '7 days',
        updated_at = now()
    WHERE user_id = p_user_id
    RETURNING * INTO v_wallet;
  END IF;

  SELECT * INTO v_existing
  FROM public.scan_credit_ledger
  WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN QUERY SELECT
      false,
      v_existing.id,
      v_wallet.included_balance,
      v_wallet.purchased_balance,
      v_wallet.refresh_at;
    RETURN;
  END IF;

  IF v_wallet.included_balance + v_wallet.purchased_balance < p_units THEN
    RETURN QUERY SELECT false, NULL::UUID, v_wallet.included_balance,
      v_wallet.purchased_balance, v_wallet.refresh_at;
    RETURN;
  END IF;

  v_included_used := LEAST(v_wallet.included_balance, p_units);
  v_purchased_used := p_units - v_included_used;

  UPDATE public.scan_credit_wallets
  SET included_balance = included_balance - v_included_used,
      purchased_balance = purchased_balance - v_purchased_used,
      updated_at = now()
  WHERE user_id = p_user_id
  RETURNING * INTO v_wallet;

  INSERT INTO public.scan_credit_ledger (
    user_id, target_id, entry_type, reason, included_delta,
    purchased_delta, status, idempotency_key
  ) VALUES (
    p_user_id, p_target_id, 'reservation', p_reason,
    -v_included_used, -v_purchased_used, 'reserved', p_idempotency_key
  ) RETURNING id INTO v_reservation_id;

  RETURN QUERY SELECT true, v_reservation_id, v_wallet.included_balance,
    v_wallet.purchased_balance, v_wallet.refresh_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_scan_credit_reservation(
  p_reservation_id UUID,
  p_scan_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  UPDATE public.scan_credit_ledger
  SET status = 'completed',
      scan_id = COALESCE(p_scan_id, scan_id),
      completed_at = now()
  WHERE id = p_reservation_id
    AND entry_type = 'reservation'
    AND status = 'reserved';
  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.refund_scan_credit_reservation(
  p_reservation_id UUID,
  p_reason TEXT DEFAULT 'scan_failed'
)
RETURNS TABLE (
  refunded BOOLEAN,
  included_balance INTEGER,
  purchased_balance INTEGER,
  refresh_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_reservation public.scan_credit_ledger%ROWTYPE;
  v_wallet public.scan_credit_wallets%ROWTYPE;
  v_included_refund INTEGER := 0;
  v_purchased_refund INTEGER := 0;
BEGIN
  SELECT * INTO v_reservation
  FROM public.scan_credit_ledger
  WHERE id = p_reservation_id
  FOR UPDATE;

  IF NOT FOUND OR v_reservation.entry_type <> 'reservation' THEN
    RETURN QUERY SELECT false, 0, 0, NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  SELECT * INTO v_wallet
  FROM public.scan_credit_wallets
  WHERE user_id = v_reservation.user_id
  FOR UPDATE;

  IF v_reservation.status = 'refunded' THEN
    RETURN QUERY SELECT false, v_wallet.included_balance,
      v_wallet.purchased_balance, v_wallet.refresh_at;
    RETURN;
  END IF;

  -- Included credits expire at the weekly boundary. Do not revive credits
  -- from a previous allowance period if a very long scan crosses that reset.
  IF v_reservation.created_at >= v_wallet.refresh_at - interval '7 days' THEN
    v_included_refund := -v_reservation.included_delta;
  END IF;
  v_purchased_refund := -v_reservation.purchased_delta;

  UPDATE public.scan_credit_wallets
  SET included_balance = LEAST(
        included_allowance,
        included_balance + v_included_refund
      ),
      purchased_balance = purchased_balance + v_purchased_refund,
      updated_at = now()
  WHERE user_id = v_reservation.user_id
  RETURNING * INTO v_wallet;

  UPDATE public.scan_credit_ledger
  SET status = 'refunded', completed_at = now()
  WHERE id = p_reservation_id;

  INSERT INTO public.scan_credit_ledger (
    user_id, target_id, scan_id, entry_type, reason, included_delta,
    purchased_delta, status, idempotency_key, reversal_of, completed_at
  ) VALUES (
    v_reservation.user_id, v_reservation.target_id, v_reservation.scan_id,
    'refund', p_reason, v_included_refund, v_purchased_refund,
    'completed', 'refund:' || p_reservation_id::text,
    p_reservation_id, now()
  ) ON CONFLICT (idempotency_key) DO NOTHING;

  RETURN QUERY SELECT true, v_wallet.included_balance,
    v_wallet.purchased_balance, v_wallet.refresh_at;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_scan_credit_wallet(UUID, TEXT, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_purchased_scan_credits(UUID, INTEGER, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reserve_scan_credits(UUID, INTEGER, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_scan_credit_reservation(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refund_scan_credit_reservation(UUID, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.sync_scan_credit_wallet(UUID, TEXT, INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_purchased_scan_credits(UUID, INTEGER, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.reserve_scan_credits(UUID, INTEGER, UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_scan_credit_reservation(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.refund_scan_credit_reservation(UUID, TEXT) TO service_role;

-- Grandfather active tracked accounts into an explicit auto-scan limit based
-- on their current size. New post-paywall targets must be confirmed in the UI.
UPDATE public.subscriptions AS s
SET scan_credit_auto_limit = GREATEST(1, CEIL(t.following_count / 1000.0)::INTEGER),
    scan_credit_consent_at = now()
FROM public.instagram_targets AS t
WHERE s.target_id = t.id
  AND s.active = true
  AND s.stripe_subscription_id IS NOT NULL
  AND s.removed_at IS NULL;

-- Give every existing signed-in paid customer the current weekly allowance.
INSERT INTO public.scan_credit_wallets (
  user_id, included_balance, included_allowance, refresh_at, tier,
  stripe_subscription_id
)
SELECT
  s.user_id,
  CASE WHEN bool_or(s.tier = 'premium') THEN 18 ELSE 12 END,
  CASE WHEN bool_or(s.tier = 'premium') THEN 18 ELSE 12 END,
  now() + interval '7 days',
  CASE WHEN bool_or(s.tier = 'premium') THEN 'premium' ELSE 'base' END,
  max(s.stripe_subscription_id)
FROM public.subscriptions s
WHERE s.user_id IS NOT NULL
  AND s.active = true
  AND s.stripe_subscription_id IS NOT NULL
GROUP BY s.user_id
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.scan_credit_ledger (
  user_id, entry_type, reason, included_delta, status,
  idempotency_key, completed_at
)
SELECT
  w.user_id, 'included_grant', 'initial_plan_allowance',
  w.included_allowance, 'completed', 'initial-plan:' || w.user_id::text, now()
FROM public.scan_credit_wallets w
ON CONFLICT (idempotency_key) DO NOTHING;

-- Preserve every unused legacy rescan credit as a purchased scan unit, then
-- mark the legacy row consumed so old and new code cannot count it twice.
UPDATE public.scan_credit_wallets w
SET purchased_balance = w.purchased_balance + legacy.remaining,
    updated_at = now()
FROM (
  SELECT user_id, sum(GREATEST(credits - consumed, 0))::INTEGER AS remaining
  FROM public.one_time_purchases
  WHERE kind = 'rescan_credits'
  GROUP BY user_id
) legacy
WHERE w.user_id = legacy.user_id
  AND legacy.remaining > 0;

INSERT INTO public.scan_credit_ledger (
  user_id, target_id, entry_type, reason, purchased_delta, status,
  idempotency_key, completed_at
)
SELECT
  p.user_id, p.target_id, 'purchased_grant', 'legacy_rescan_credit',
  GREATEST(p.credits - p.consumed, 0), 'completed',
  'legacy-one-time:' || p.id::text, now()
FROM public.one_time_purchases p
WHERE p.kind = 'rescan_credits'
  AND p.credits > p.consumed
ON CONFLICT (idempotency_key) DO NOTHING;

UPDATE public.one_time_purchases
SET consumed = credits
WHERE kind = 'rescan_credits'
  AND consumed < credits;
