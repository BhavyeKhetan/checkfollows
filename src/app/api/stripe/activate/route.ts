import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createServerClient } from "@/lib/supabase/server";
import { collapseDuplicateStripeSubscription } from "@/lib/subscription-management";

/**
 * POST /api/stripe/activate
 * Body: { session_id }
 *
 * Called by the frontend after Stripe redirects back (success=true).
 * Verifies the session is paid, stores/links the subscription, enables
 * the paid entitlement. A selected target is returned for the post-paywall
 * scan-credit confirmation screen and is not scanned here.
 *
 * Idempotent: safe to call multiple times (webhook + redirect race).
 */
export async function POST(request: Request) {
  try {
    const { session_id } = await request.json();
    if (!session_id) {
      return NextResponse.json(
        { success: false, error: "session_id is required" },
        { status: 400 }
      );
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(session_id);

    // Only proceed when the user actually has an entitlement (paid or trialing).
    const paid =
      session.payment_status === "paid" ||
      session.payment_status === "no_payment_required";

    if (!paid) {
      return NextResponse.json(
        { success: false, error: "Payment not completed" },
        { status: 402 }
      );
    }

    const metadata = session.metadata || {};
    const customerEmail =
      metadata.email || session.customer_details?.email || session.customer_email;
    const subscriptionId = (session.subscription as string) || "";
    const customerId = (session.customer as string) || "";
    const targetId = metadata.target_id || null;
    const username = metadata.username || null;

    if (!customerEmail || !subscriptionId) {
      return NextResponse.json(
        { success: false, error: "Missing customer or subscription info" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    if (metadata.reactivation !== "true") {
      const collapsed = await collapseDuplicateStripeSubscription({
        incomingSubscriptionId: subscriptionId,
        customerId,
        email: customerEmail,
        userId: metadata.user_id || null,
        targetId: null,
      });
      if (collapsed.collapsed) {
        return NextResponse.json({
          success: true,
          alreadySubscribed: true,
          username,
          targetId,
          needsScanConfirmation: !!targetId,
        });
      }
    }

    // Upsert a generic subscription entitlement. The target is attached only
    // after the customer approves its current per-scan credit amount.
    const { data: existing } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("email", customerEmail)
      .eq("stripe_subscription_id", subscriptionId)
      .maybeSingle();

    const plan = metadata.plan || "basic";
    const subData = {
      email: customerEmail,
      plan,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      active: true,
      user_paused: false,
    };

    if (existing) {
      await supabase
        .from("subscriptions")
        .update({ ...subData, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      const { error: insertErr } = await supabase
        .from("subscriptions")
        .insert(subData);

      if (insertErr && targetId) {
        // UNIQUE(target_id, email) — a re-purchase. Update the existing row,
        // but don't clobber a newer subscription from a late webhook.
        console.warn(
          "Activate: insert failed (likely re-purchase); updating instead:",
          insertErr.message
        );
        const { data: conflicting } = await supabase
          .from("subscriptions")
          .select("stripe_subscription_id")
          .eq("target_id", targetId)
          .eq("email", customerEmail)
          .maybeSingle();

        const existingSubId = conflicting?.stripe_subscription_id;
        if (!existingSubId || existingSubId === subscriptionId) {
          await supabase
            .from("subscriptions")
            .update({ ...subData, updated_at: new Date().toISOString() })
            .eq("target_id", targetId)
            .eq("email", customerEmail);
        }
      } else if (insertErr) {
        console.error("Activate: failed to store subscription:", insertErr);
      }
    }

    return NextResponse.json({
      success: true,
      activated: true,
      targetId,
      username,
      baselineEstablished: false,
      followingCount: null,
      events: [],
      needsScanConfirmation: !!targetId,
    });
  } catch (error) {
    console.error("Stripe activate error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to activate subscription" },
      { status: 500 }
    );
  }
}
