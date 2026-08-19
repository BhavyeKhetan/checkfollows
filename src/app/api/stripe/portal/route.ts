import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/auth";
import { getStripe } from "@/lib/stripe";
import {
  appReturnOrigin,
  getOwnedStripeSubscription,
} from "@/lib/subscription-management";

async function getPortalConfigurationId(): Promise<string> {
  const configured = process.env.STRIPE_PORTAL_CONFIGURATION_ID;
  if (configured) return configured;

  const stripe = getStripe();
  const existing = await stripe.billingPortal.configurations.list({
    active: true,
    limit: 100,
  });
  const match = existing.data.find(
    (configuration) =>
      configuration.metadata?.product === "checkfollows" &&
      configuration.metadata?.purpose === "billing_details_only"
  );
  if (match) return match.id;

  const configuration = await stripe.billingPortal.configurations.create({
    business_profile: {
      headline: "Manage your CheckFollows billing details",
      privacy_policy_url: "https://www.checkfollows.com/privacy",
      terms_of_service_url: "https://www.checkfollows.com/terms",
    },
    features: {
      customer_update: {
        enabled: true,
        allowed_updates: ["address", "shipping", "phone", "tax_id"],
      },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: { enabled: false },
      subscription_update: { enabled: false },
    },
    metadata: {
      product: "checkfollows",
      purpose: "billing_details_only",
    },
  });
  return configuration.id;
}

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const owned = await getOwnedStripeSubscription(user);
    if (!owned) {
      return NextResponse.json(
        { error: "No billing account was found" },
        { status: 404 }
      );
    }

    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: owned.customerId,
      configuration: await getPortalConfigurationId(),
      return_url: `${appReturnOrigin(request)}/account`,
    });

    return NextResponse.json({ success: true, url: session.url });
  } catch (error) {
    console.error("Billing portal error:", error);
    return NextResponse.json(
      { error: "Failed to open billing management" },
      { status: 500 }
    );
  }
}
