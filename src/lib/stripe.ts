import Stripe from "stripe";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
    _stripe = new Stripe(key, { typescript: true });
  }
  return _stripe;
}

/** Base plan price IDs: weekly + quarterly billing cadences */
export const PRICE_IDS: Record<string, string> = {
  weekly: process.env.STRIPE_PRICE_WEEKLY_ID || "",
  quarterly: process.env.STRIPE_PRICE_QUARTERLY_ID || "",
};

/** Premium plan price IDs (5 concurrent accounts included). */
export const PREMIUM_PRICE_IDS: Record<string, string> = {
  weekly: process.env.STRIPE_PRICE_PREMIUM_WEEKLY_ID || "",
  quarterly: process.env.STRIPE_PRICE_PREMIUM_QUARTERLY_ID || "",
};

export type PlanTier = "base" | "premium";
export type BillingCadence = "weekly" | "quarterly";

export function getTierPriceIds(tier: PlanTier = "base"): Record<string, string> {
  return tier === "premium" ? PREMIUM_PRICE_IDS : PRICE_IDS;
}

/** Email-alerts upsell add-on price IDs (mirrors the base cadence). */
export const EMAIL_ALERTS_PRICE_IDS: Record<string, string> = {
  weekly: process.env.STRIPE_EMAIL_ALERTS_WEEKLY_ID || "",
  quarterly: process.env.STRIPE_EMAIL_ALERTS_QUARTERLY_ID || "",
};

export function getStripePriceId(
  cadence: "weekly" | "quarterly" = "weekly",
  tier: PlanTier = "base"
): string {
  const id = getTierPriceIds(tier)[cadence];
  if (!id) {
    const prefix = tier === "premium" ? "STRIPE_PRICE_PREMIUM_" : "STRIPE_PRICE_";
    throw new Error(`${prefix}${cadence.toUpperCase()}_ID is not configured`);
  }
  return id;
}

export function getEmailAlertsPriceId(cadence: "weekly" | "quarterly"): string {
  const id = EMAIL_ALERTS_PRICE_IDS[cadence];
  if (!id) throw new Error(`STRIPE_EMAIL_ALERTS_${cadence.toUpperCase()}_ID is not configured`);
  return id;
}

/**
 * Recurring per-account capacity add-ons. These are separate Stripe Prices so
 * their quantity can be increased without replacing the customer's base plan.
 */
export const ADDITIONAL_ACCOUNT_PRICE_IDS: Record<BillingCadence, string> = {
  weekly: process.env.STRIPE_ADDITIONAL_ACCOUNT_WEEKLY_ID || "",
  quarterly: process.env.STRIPE_ADDITIONAL_ACCOUNT_QUARTERLY_ID || "",
};

export const ADDITIONAL_ACCOUNT_UNIT_AMOUNTS: Record<BillingCadence, number> = {
  weekly: 100,
  quarterly: 1400,
};

export function getAdditionalAccountPriceId(cadence: BillingCadence): string {
  const id = ADDITIONAL_ACCOUNT_PRICE_IDS[cadence];
  if (!id) {
    throw new Error(
      `STRIPE_ADDITIONAL_ACCOUNT_${cadence.toUpperCase()}_ID is not configured`
    );
  }
  return id;
}

export type RescanBundle = "3" | "10" | "30";

export interface RescanBundleOption {
  bundle: RescanBundle;
  credits: number;
  price: number;
  unitPrice: string;
  label: string;
  badge?: string;
  highlighted?: boolean;
}

export const RESCAN_BUNDLES: RescanBundleOption[] = [
  {
    bundle: "3",
    credits: 3,
    price: 5,
    unitPrice: "$1.67",
    label: "Starter",
  },
  {
    bundle: "10",
    credits: 10,
    price: 10,
    unitPrice: "$1.00",
    label: "Popular",
  },
  {
    bundle: "30",
    credits: 30,
    price: 20,
    unitPrice: "$0.67",
    label: "Best Value",
    badge: "SAVE 60%",
    highlighted: true,
  },
];

export const RESCAN_BUNDLE_PRICE_IDS: Record<RescanBundle, string> = {
  "3": process.env.STRIPE_PRICE_RESCAN_3_ID || "price_1U6yWDExaeatW6VmEavDBAh2",
  "10": process.env.STRIPE_PRICE_RESCAN_10_ID || "price_1U6yWDExaeatW6VmMUntCXDJ",
  "30": process.env.STRIPE_PRICE_RESCAN_30_ID || "price_1U6yWEExaeatW6VmM4mSf00M",
};

export type ExportOptionTier = "single" | "unlimited";

export interface ExportOption {
  tier: ExportOptionTier;
  price: number;
  label: string;
  description: string;
  badge?: string;
  highlighted?: boolean;
}

export const EXPORT_OPTIONS: ExportOption[] = [
  {
    tier: "single",
    price: 4.99,
    label: "Single Export",
    description: "1 CSV download for this tracked account",
  },
  {
    tier: "unlimited",
    price: 9.99,
    label: "Unlimited Pass",
    description: "Unlimited CSV downloads forever across all tracked accounts",
    badge: "BEST VALUE",
    highlighted: true,
  },
];

export const EXPORT_PRICE_IDS: Record<ExportOptionTier, string> = {
  single: process.env.STRIPE_PRICE_EXPORT_ID || "price_1U4FuUExaeatW6VmoInvDgRL",
  unlimited: process.env.STRIPE_PRICE_EXPORT_UNLIMITED_ID || "price_1U70K4ExaeatW6VmiurdEq3K",
};

/** One-time upsell price IDs: history export, on-demand rescan, mutuals. */
export const ONE_TIME_PRICE_IDS: Record<
  "export" | "export_unlimited" | "rescan_credits" | "mutuals",
  string
> = {
  export: process.env.STRIPE_PRICE_EXPORT_ID || "price_1U4FuUExaeatW6VmoInvDgRL",
  export_unlimited: process.env.STRIPE_PRICE_EXPORT_UNLIMITED_ID || "price_1U70K4ExaeatW6VmiurdEq3K",
  rescan_credits: process.env.STRIPE_PRICE_RESCAN_ID || process.env.STRIPE_PRICE_RESCAN_3_ID || "",
  mutuals: process.env.STRIPE_PRICE_MUTUALS_ID || "",
};

export function getRescanBundlePriceId(bundle: RescanBundle = "30"): string {
  const id = RESCAN_BUNDLE_PRICE_IDS[bundle];
  if (!id) {
    throw new Error(`STRIPE_PRICE_RESCAN_${bundle}_ID is not configured`);
  }
  return id;
}

export function getExportPriceId(tier: ExportOptionTier = "unlimited"): string {
  const id = EXPORT_PRICE_IDS[tier];
  if (!id) {
    throw new Error(`STRIPE_PRICE_EXPORT_${tier.toUpperCase()}_ID is not configured`);
  }
  return id;
}

export function getOneTimePriceId(
  kind: "export" | "export_unlimited" | "rescan_credits" | "mutuals",
  bundleOrTier?: RescanBundle | ExportOptionTier
): string {
  if (kind === "rescan_credits") {
    const bundle =
      bundleOrTier === "3" || bundleOrTier === "10" || bundleOrTier === "30"
        ? bundleOrTier
        : "30";
    return getRescanBundlePriceId(bundle);
  }
  if (kind === "export" || kind === "export_unlimited") {
    const tier =
      kind === "export_unlimited" || bundleOrTier === "unlimited"
        ? "unlimited"
        : "single";
    return getExportPriceId(tier);
  }
  const id = ONE_TIME_PRICE_IDS[kind];
  if (!id) throw new Error("STRIPE_PRICE_MUTUALS_ID is not configured");
  return id;
}

export function getStripeRedirectUrl(sessionId: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  return `${baseUrl}/?session_id=${sessionId}`;
}

/**
 * Extract the client secret for the first invoice of an "incomplete"
 * subscription, used by the in-page Stripe Payment Element to collect the
 * payment method (mirrors promise_web's EmbeddedCheckout).
 */
export function subscriptionClientSecret(subscription: Stripe.Subscription): string {
  const invoice = subscription.latest_invoice;
  if (!invoice || typeof invoice === "string") {
    throw new Error("Stripe did not return the subscription invoice");
  }
  const secret = invoice.confirmation_secret?.client_secret;
  if (!secret) {
    throw new Error("Stripe did not return a payment client secret");
  }
  return secret;
}
