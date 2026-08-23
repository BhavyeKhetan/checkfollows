-- On-demand rescans are a separate purchased entitlement. Weekly included
-- credits fund subscription monitoring and must not make a customer appear to
-- own extra rescan add-ons.
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
  IF p_units <= 0 OR length(trim(p_idempotency_key)) = 0 OR
     p_reason NOT IN ('baseline', 'automatic', 'manual') THEN
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
    RETURN QUERY SELECT false, v_existing.id,
      v_wallet.included_balance, v_wallet.purchased_balance,
      v_wallet.refresh_at;
    RETURN;
  END IF;

  IF p_reason = 'manual' THEN
    IF v_wallet.purchased_balance < p_units THEN
      RETURN QUERY SELECT false, NULL::UUID, v_wallet.included_balance,
        v_wallet.purchased_balance, v_wallet.refresh_at;
      RETURN;
    END IF;
    v_included_used := 0;
    v_purchased_used := p_units;
  ELSE
    IF v_wallet.included_balance + v_wallet.purchased_balance < p_units THEN
      RETURN QUERY SELECT false, NULL::UUID, v_wallet.included_balance,
        v_wallet.purchased_balance, v_wallet.refresh_at;
      RETURN;
    END IF;
    v_included_used := LEAST(v_wallet.included_balance, p_units);
    v_purchased_used := p_units - v_included_used;
  END IF;

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

REVOKE ALL ON FUNCTION public.reserve_scan_credits(UUID, INTEGER, UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_scan_credits(UUID, INTEGER, UUID, TEXT, TEXT)
  TO service_role;
