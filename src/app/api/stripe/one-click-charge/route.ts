import { NextResponse } from "next/server";
import { getAuthUser, hasActiveSubscription } from "@/lib/supabase/auth";
import { createServerClient } from "@/lib/supabase/server";
import { getStripe, RESCAN_BUNDLES, type RescanBundle, type ExportOptionTier } from "@/lib/stripe";
import { trackServer } from "@/lib/mixpanel-server";

export async function POST(request: Request) {
  try {
    const user = await getAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }
    if (!(await hasActiveSubscription(user.id))) {
      return NextResponse.json(
        { error: "An active subscription is required", paywall: "/app/pricing" },
        { status: 402 }
      );
    }

    const body = await request.json().catch(() => ({}));
    let kind = typeof body.kind === "string" ? body.kind : "";
    const targetId = typeof body.targetId === "string" ? body.targetId : undefined;
    const username = typeof body.username === "string" ? body.username : undefined;

    let amountCents = 0;
    let credits = 1;
    let description = "CheckFollows Add-on";

    if (kind === "rescan_credits") {
      const rawBundle = String(body.bundle || "30") as RescanBundle;
      const bundleConfig = RESCAN_BUNDLES.find((b) => b.bundle === rawBundle) || RESCAN_BUNDLES[2];
      amountCents = bundleConfig.price * 100;
      credits = bundleConfig.credits;
      description = `CheckFollows - ${bundleConfig.credits} On-Demand Rescans`;
    } else if (kind === "export" || kind === "export_unlimited") {
      const exportTier = (body.exportTier === "single" ? "single" : "unlimited") as ExportOptionTier;
      if (kind === "export_unlimited" || exportTier === "unlimited") {
        kind = "export_unlimited";
        amountCents = 999;
        credits = 1;
        description = "CheckFollows - Unlimited History Export Pass";
      } else {
        kind = "export";
        amountCents = 499;
        credits = 1;
        description = "CheckFollows - Single History CSV Export";
      }
    } else if (kind === "mutuals") {
      amountCents = 499;
      credits = 1;
      description = "CheckFollows - Mutual Follows Report";
    } else {
      return NextResponse.json({ error: "Invalid purchase kind" }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id, stripe_subscription_id")
      .eq("user_id", user.id)
      .not("stripe_customer_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub?.stripe_customer_id) {
      return NextResponse.json({ fallbackCheckout: true });
    }

    const stripe = getStripe();
    let paymentMethodId: string | null = null;

    // Find default payment method
    if (sub.stripe_subscription_id) {
      try {
        const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
        if (typeof stripeSub.default_payment_method === "string") {
          paymentMethodId = stripeSub.default_payment_method;
        } else if (stripeSub.default_payment_method && typeof stripeSub.default_payment_method === "object") {
          paymentMethodId = stripeSub.default_payment_method.id;
        }
      } catch {
        /* continue */
      }
    }

    if (!paymentMethodId) {
      try {
        const cust = await stripe.customers.retrieve(sub.stripe_customer_id);
        if (!cust.deleted && cust.invoice_settings?.default_payment_method) {
          const dpm = cust.invoice_settings.default_payment_method;
          paymentMethodId = typeof dpm === "string" ? dpm : dpm.id;
        }
      } catch {
        /* continue */
      }
    }

    if (!paymentMethodId) {
      try {
        const pms = await stripe.paymentMethods.list({
          customer: sub.stripe_customer_id,
          type: "card",
          limit: 1,
        });
        paymentMethodId = pms.data[0]?.id || null;
      } catch {
        /* continue */
      }
    }

    if (!paymentMethodId) {
      return NextResponse.json({ fallbackCheckout: true });
    }

    // Execute direct off-session 1-click charge
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "usd",
      customer: sub.stripe_customer_id,
      payment_method: paymentMethodId,
      off_session: true,
      confirm: true,
      description,
      metadata: {
        product: "checkfollows",
        kind,
        user_id: user.id,
        credits: String(credits),
        ...(body.bundle ? { bundle: body.bundle } : {}),
        ...(targetId ? { target_id: targetId } : {}),
        ...(username ? { username } : {}),
      },
    });

    if (paymentIntent.status === "succeeded") {
      await supabase.from("one_time_purchases").insert({
        user_id: user.id,
        kind,
        target_id: targetId || null,
        credits,
        consumed: 0,
        stripe_session_id: paymentIntent.id,
      });

      trackServer("one_time_purchase_completed", {
        user_id: user.id,
        kind,
        quantity: credits,
        one_click: true,
        ...(body.bundle ? { bundle: body.bundle } : {}),
      });

      return NextResponse.json({
        success: true,
        kind,
        credits,
      });
    }

    if (paymentIntent.status === "requires_action") {
      return NextResponse.json({
        requiresAction: true,
        clientSecret: paymentIntent.client_secret,
      });
    }

    return NextResponse.json({ fallbackCheckout: true });
  } catch (error) {
    console.error("1-Click charge error:", error);
    return NextResponse.json({ fallbackCheckout: true });
  }
}
