import { NextResponse } from "next/server";
import type Stripe from "stripe";
import {
  getAccountCapacity,
  publicCapacity,
} from "@/lib/account-capacity";
import {
  ADDITIONAL_ACCOUNT_ITEM_KIND,
  MAX_ADDITIONAL_ACCOUNTS,
} from "@/lib/account-capacity-rules";
import { trackServer } from "@/lib/mixpanel-server";
import { getAuthUser } from "@/lib/supabase/auth";
import {
  getAdditionalAccountPriceId,
  getStripe,
} from "@/lib/stripe";

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let requestedAdditionalAccounts: number;
  try {
    const body = await request.json();
    requestedAdditionalAccounts = Number(body.additionalAccounts);
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (
    !Number.isInteger(requestedAdditionalAccounts) ||
    requestedAdditionalAccounts < 1 ||
    requestedAdditionalAccounts > MAX_ADDITIONAL_ACCOUNTS
  ) {
    return NextResponse.json(
      { error: `Choose between 1 and ${MAX_ADDITIONAL_ACCOUNTS} additional accounts` },
      { status: 400 }
    );
  }

  try {
    const current = await getAccountCapacity(user.id);
    if (!current) {
      return NextResponse.json(
        { error: "An active subscription is required" },
        { status: 402 }
      );
    }

    if (requestedAdditionalAccounts <= current.additionalAccounts) {
      return NextResponse.json(
        {
          error: `Choose more than your current ${current.additionalAccounts} additional accounts`,
          capacity: publicCapacity(current),
        },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    const priceId = getAdditionalAccountPriceId(current.cadence);
    const mutationParams = {
      quantity: requestedAdditionalAccounts,
      payment_behavior: "pending_if_incomplete" as const,
      proration_behavior: "always_invoice" as const,
      metadata: {
        checkfollows_kind: ADDITIONAL_ACCOUNT_ITEM_KIND,
        cadence: current.cadence,
      },
    };

    if (current.addonItemId) {
      await stripe.subscriptionItems.update(
        current.addonItemId,
        mutationParams,
        {
          idempotencyKey: `checkfollows-capacity-${current.stripeSubscriptionId}-${requestedAdditionalAccounts}`,
        }
      );
    } else {
      await stripe.subscriptionItems.create(
        {
          subscription: current.stripeSubscriptionId,
          price: priceId,
          ...mutationParams,
        },
        {
          idempotencyKey: `checkfollows-capacity-${current.stripeSubscriptionId}-${requestedAdditionalAccounts}`,
        }
      );
    }

    const refreshed = await getAccountCapacity(user.id);
    if (!refreshed) {
      throw new Error("Subscription capacity disappeared after update");
    }

    if (refreshed.additionalAccounts < requestedAdditionalAccounts) {
      const pendingSubscription = await stripe.subscriptions.retrieve(
        current.stripeSubscriptionId,
        { expand: ["latest_invoice"] }
      );
      const invoice = pendingSubscription.latest_invoice as Stripe.Invoice | null;
      return NextResponse.json(
        {
          error: "Payment must be completed before the new account slots become active.",
          paymentUrl: invoice?.hosted_invoice_url || null,
          capacity: publicCapacity(refreshed),
        },
        { status: 402 }
      );
    }

    void trackServer("account_capacity_increased", {
      user_id: user.id,
      cadence: refreshed.cadence,
      tier: refreshed.tier,
      previous_additional_accounts: current.additionalAccounts,
      additional_accounts: refreshed.additionalAccounts,
      total_capacity: refreshed.totalAccounts,
    });

    return NextResponse.json({
      success: true,
      capacity: publicCapacity(refreshed),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("account-capacity update failed:", error);
    return NextResponse.json(
      { error: message.includes("not configured") ? message : "Could not add account slots" },
      { status: 500 }
    );
  }
}
