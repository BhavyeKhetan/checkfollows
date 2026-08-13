-- Allow generic (target-less) subscriptions so pricing-page purchases can be
-- stored before the user attaches a specific Instagram account.
ALTER TABLE public.subscriptions
  ALTER COLUMN target_id DROP NOT NULL;

-- Speed up webhook lifecycle lookups (customer.subscription.* events).
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_sub
  ON public.subscriptions (stripe_subscription_id);
