import crypto from "node:crypto";

import type Stripe from "stripe";

import {
  creatorAttributionFromStripeMetadata,
  type CreatorLinkAttribution,
} from "@/lib/creator-link-attribution";
import {
  CHECKFOLLOWS_UGC_APP_SLUG,
  getCheckFollowsUgcAppId,
  getUgcTrackerClient,
} from "@/lib/ugc-tracker";

type ConversionKind = "first_purchase" | "renewal" | "refund" | "dispute" | "dispute_reversal";

function stripeId(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id ?? null;
}

function invoiceSubscriptionId(invoice: Stripe.Invoice) {
  const legacy = (invoice as unknown as { subscription?: string | { id: string } | null }).subscription;
  if (legacy) return stripeId(legacy);
  const parent = invoice.parent as Stripe.Invoice.Parent | null;
  return stripeId(parent?.subscription_details?.subscription);
}

function buyerIdentity(email: string | null | undefined, customerId: string | null) {
  const normalizedEmail = email?.trim().toLowerCase();
  const basis = normalizedEmail ? "normalized_email" : customerId ? "stripe_customer" : null;
  const value = normalizedEmail || customerId;
  if (!basis || !value) return { hash: null, basis: null };
  return {
    hash: crypto.createHash("sha256").update(`checkfollows-commission-buyer:v1:${basis}:${value}`).digest("hex"),
    basis,
  };
}

async function resolveAttribution(
  stripe: Stripe,
  input: {
    metadata?: Stripe.Metadata | null;
    customerId?: string | null;
    subscriptionId?: string | null;
    paymentIntentId?: string | null;
  }
): Promise<{ attribution: CreatorLinkAttribution | null; email: string | null }> {
  let attribution = creatorAttributionFromStripeMetadata(input.metadata || undefined);
  let email: string | null = null;

  if (!attribution && input.paymentIntentId) {
    const paymentIntent = await stripe.paymentIntents.retrieve(input.paymentIntentId);
    attribution = creatorAttributionFromStripeMetadata(paymentIntent.metadata);
  }
  if (!attribution && input.subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(input.subscriptionId);
    attribution = creatorAttributionFromStripeMetadata(subscription.metadata);
  }
  if (input.customerId) {
    const customer = await stripe.customers.retrieve(input.customerId);
    if (!customer.deleted) {
      email = customer.email;
      attribution ||= creatorAttributionFromStripeMetadata(customer.metadata);
    }
  }
  return { attribution, email };
}

async function ingestConversion(input: {
  event: Stripe.Event;
  attribution: CreatorLinkAttribution;
  kind: ConversionKind;
  objectId: string;
  currency: string;
  grossAmountMinor: number;
  customerId: string | null;
  customerEmail: string | null;
  subscriptionId: string | null;
  invoiceId: string | null;
  paymentIntentId: string | null;
  chargeId: string | null;
}) {
  const ugc = getUgcTrackerClient();
  const appId = await getCheckFollowsUgcAppId(ugc);
  const occurredAt = new Date(input.event.created * 1000).toISOString();
  const identity = buyerIdentity(input.customerEmail, input.customerId);
  const isNewPaidConversion = input.kind === "first_purchase";
  const isRenewal = input.kind === "renewal";
  const isNegative = input.kind === "refund" || input.kind === "dispute";

  const { error: revenueError } = await ugc
    .from("attribution_revenue_events")
    .upsert({
      app_id: appId,
      source: "stripe",
      source_event_id: input.objectId,
      platform: "web",
      event_time_utc: occurredAt,
      amount_gross: input.grossAmountMinor,
      amount_net_or_estimated: input.grossAmountMinor,
      currency: input.currency.toLowerCase(),
      amount_confidence: "exact",
      is_new_paid_conversion: isNewPaidConversion,
      is_renewal: isRenewal,
      is_refund_or_negative: isNegative,
      subscription_id: input.subscriptionId,
      customer_id_hash: input.customerId
        ? crypto.createHash("sha256").update(`checkfollows-stripe-customer:v1:${input.customerId}`).digest("hex")
        : null,
      traffic_source: input.attribution.referral_link_source,
      known_channel_bucket: "creator_link",
      source_quality_flags: { first_party_creator_link: true },
      raw_event: { id: input.event.id, type: input.event.type },
      exact_creator_link_id: input.attribution.referral_link_id,
      exact_creator_engagement_id: input.attribution.creator_engagement_id,
      exact_creator_click_id: input.attribution.referral_click_id,
      exact_creator_attribution_reason: "first_party_creator_link",
      buyer_identity_hash: identity.hash,
      buyer_identity_basis: identity.basis,
    }, { onConflict: "app_id,source,source_event_id" });
  if (revenueError) throw new Error(`CheckFollows revenue ingestion failed: ${revenueError.message}`);

  const { error: conversionError } = await ugc.rpc("ingest_creator_attribution_conversion", {
    p_app_slug: CHECKFOLLOWS_UGC_APP_SLUG,
    p_link_id: input.attribution.referral_link_id,
    p_acquisition_session_id: input.attribution.acquisition_session_id,
    p_stripe_event_id: input.event.id,
    p_stripe_event_type: input.event.type,
    p_stripe_object_id: input.objectId,
    p_conversion_kind: input.kind,
    p_occurred_at: occurredAt,
    p_currency: input.currency.toLowerCase(),
    p_gross_amount_minor: input.grossAmountMinor,
    p_net_amount_minor: null,
    p_net_reconciliation_status: "pending",
    p_net_amount_basis: null,
    p_stripe_invoice_id: input.invoiceId,
    p_stripe_payment_intent_id: input.paymentIntentId,
    p_stripe_charge_id: input.chargeId,
    p_stripe_customer_id_hash: null,
    p_platform: input.attribution.referral_link_platform,
    p_source: input.attribution.referral_link_source,
    p_source_metadata: { product: CHECKFOLLOWS_UGC_APP_SLUG },
  });
  if (conversionError) throw new Error(`CheckFollows creator conversion failed: ${conversionError.message}`);
}

export async function recordCheckFollowsInvoiceCommission(
  event: Stripe.Event,
  invoice: Stripe.Invoice,
  stripe: Stripe
) {
  if (invoice.amount_paid <= 0) return;
  const subscriptionId = invoiceSubscriptionId(invoice);
  const customerId = stripeId(invoice.customer);
  const paymentIntentId = stripeId(
    (invoice as unknown as { payment_intent?: string | { id: string } | null }).payment_intent
  );
  const resolved = await resolveAttribution(stripe, {
    metadata: invoice.metadata,
    customerId,
    subscriptionId,
    paymentIntentId,
  });
  if (!resolved.attribution) return;

  await ingestConversion({
    event,
    attribution: resolved.attribution,
    kind: invoice.billing_reason === "subscription_create" ? "first_purchase" : "renewal",
    objectId: invoice.id,
    currency: invoice.currency,
    grossAmountMinor: invoice.amount_paid,
    customerId,
    customerEmail: invoice.customer_email || resolved.email,
    subscriptionId,
    invoiceId: invoice.id,
    paymentIntentId,
    chargeId: null,
  });
}

export async function recordCheckFollowsChargeLifecycle(
  event: Stripe.Event,
  charge: Stripe.Charge,
  kind: "refund" | "dispute" | "dispute_reversal",
  amountMinor: number,
  stripe: Stripe
) {
  const customerId = stripeId(charge.customer);
  const paymentIntentId = stripeId(charge.payment_intent);
  const resolved = await resolveAttribution(stripe, {
    metadata: charge.metadata,
    customerId,
    paymentIntentId,
  });
  if (!resolved.attribution) return;
  const signedAmount = kind === "dispute_reversal" ? Math.abs(amountMinor) : -Math.abs(amountMinor);

  await ingestConversion({
    event,
    attribution: resolved.attribution,
    kind,
    objectId: event.id,
    currency: charge.currency,
    grossAmountMinor: signedAmount,
    customerId,
    customerEmail: charge.billing_details.email || resolved.email,
    subscriptionId: null,
    invoiceId: null,
    paymentIntentId,
    chargeId: charge.id,
  });
}
