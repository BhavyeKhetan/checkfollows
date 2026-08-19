import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/supabase/auth";
import { getStripe } from "@/lib/stripe";
import {
  getOwnedStripeSubscription,
  subscriptionPeriodEnd,
  subscriptionSelection,
} from "@/lib/subscription-management";

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const owned = await getOwnedStripeSubscription(user);
    if (!owned) {
      return NextResponse.json({ success: true, subscription: null });
    }

    const stripe = getStripe();
    const { subscription, customerId } = owned;
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) {
      return NextResponse.json({ error: "Billing customer not found" }, { status: 404 });
    }

    const paymentMethodId =
      typeof subscription.default_payment_method === "string"
        ? subscription.default_payment_method
        : subscription.default_payment_method?.id ||
          (typeof customer.invoice_settings.default_payment_method === "string"
            ? customer.invoice_settings.default_payment_method
            : customer.invoice_settings.default_payment_method?.id || null);

    let paymentMethod: { brand: string; last4: string; expMonth: number; expYear: number } | null = null;
    if (paymentMethodId) {
      const method = await stripe.paymentMethods.retrieve(paymentMethodId);
      if (method.card) {
        paymentMethod = {
          brand: method.card.brand,
          last4: method.card.last4,
          expMonth: method.card.exp_month,
          expYear: method.card.exp_year,
        };
      }
    }

    const invoices = await stripe.invoices.list({ customer: customerId, limit: 6 });
    const selection = subscriptionSelection(subscription);

    return NextResponse.json({
      success: true,
      subscription: {
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        currentPeriodEnd: new Date(
          subscriptionPeriodEnd(subscription) * 1000
        ).toISOString(),
        pauseResumesAt: subscription.pause_collection?.resumes_at
          ? new Date(subscription.pause_collection.resumes_at * 1000).toISOString()
          : null,
        cadence: selection.cadence,
        tier: selection.tier,
        emailAlerts: selection.emailAlerts,
        paymentMethod,
        retentionDiscountUsed:
          customer.metadata.checkfollows_retention_50_used === "true",
        pauseOfferUsed:
          customer.metadata.checkfollows_pause_month_used === "true",
        invoices: invoices.data.map((invoice) => ({
          id: invoice.id,
          createdAt: new Date(invoice.created * 1000).toISOString(),
          amountPaid: invoice.amount_paid,
          currency: invoice.currency,
          status: invoice.status,
          url: invoice.hosted_invoice_url,
        })),
      },
    });
  } catch (error) {
    console.error("Billing account error:", error);
    return NextResponse.json(
      { error: "Failed to load billing details" },
      { status: 500 }
    );
  }
}
