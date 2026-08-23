import { NextResponse } from "next/server";
import {
  getStripe,
  getOneTimePriceId,
  RESCAN_BUNDLES,
  type RescanBundle,
  type ExportOptionTier,
} from "@/lib/stripe";
import { getAuthUser, hasActiveSubscription } from "@/lib/supabase/auth";
import { createServerClient } from "@/lib/supabase/server";

const KINDS = ["export", "export_unlimited", "rescan_credits", "mutuals"] as const;
type OneTimeKind = (typeof KINDS)[number];

/**
 * POST /api/stripe/one-time
 * Body: { kind: "export" | "export_unlimited" | "rescan_credits" | "mutuals",
 *         bundle?: "3" | "10" | "30",
 *         exportTier?: "single" | "unlimited",
 *         targetId?, username?, quantity? }
 *
 * Creates a Stripe one-time payment (mode: "payment") checkout for an upsell.
 * The webhook credits `one_time_purchases` when payment completes.
 * Requires an authenticated user (so the credit lands on their account).
 */
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
    if (!KINDS.includes(kind as OneTimeKind)) {
      return NextResponse.json({ error: "Invalid purchase kind" }, { status: 400 });
    }

    const targetId = typeof body.targetId === "string" ? body.targetId : undefined;
    const username = typeof body.username === "string" ? body.username : undefined;
    const requestedReturnPath =
      typeof body.returnPath === "string" ? body.returnPath : "";

    let bundle: RescanBundle | undefined;
    let exportTier: ExportOptionTier | undefined;
    let credits = 1;

    if (kind === "rescan_credits") {
      const rawBundle = String(body.bundle || "30");
      bundle = rawBundle === "3" || rawBundle === "10" || rawBundle === "30" ? rawBundle : "30";
      const bundleConfig = RESCAN_BUNDLES.find((b) => b.bundle === bundle);
      credits = bundleConfig ? bundleConfig.credits : 30;
    } else if (kind === "export" || kind === "export_unlimited") {
      exportTier = body.exportTier === "single" ? "single" : "unlimited";
      if (kind === "export_unlimited" || exportTier === "unlimited") {
        kind = "export_unlimited";
        credits = 1;
      } else {
        kind = "export";
        credits = 1;
      }
    } else {
      credits = Math.min(
        Math.max(parseInt(String(body.quantity), 10) || 1, 1),
        10
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const stripe = getStripe();
    const priceId = getOneTimePriceId(
      kind as OneTimeKind,
      bundle || exportTier
    );

    const supabase = createServerClient();
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .not("stripe_customer_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const customerId = sub?.stripe_customer_id || undefined;

    const metadata: Record<string, string> = {
      product: "checkfollows",
      kind,
      user_id: user.id,
      credits: String(credits),
      quantity: String(credits),
    };
    if (bundle) metadata.bundle = bundle;
    if (exportTier) metadata.export_tier = exportTier;
    if (targetId) metadata.target_id = targetId;
    if (username) metadata.username = username;

    const returnPath = requestedReturnPath.startsWith("/app/add-account")
      ? requestedReturnPath
      : username
        ? `/track/${encodeURIComponent(username.replace(/^@/, ""))}`
        : "/dashboard";
    const successUrl = new URL(returnPath, baseUrl);
    successUrl.searchParams.set("purchase", kind);
    successUrl.searchParams.set("success", "true");
    const cancelUrl = new URL(returnPath, baseUrl);
    cancelUrl.searchParams.set("purchase", kind);
    cancelUrl.searchParams.set("canceled", "true");

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      ...(customerId
        ? {
            customer: customerId,
            customer_update: { address: "auto", name: "auto" },
          }
        : { customer_email: user.email || undefined }),
      payment_intent_data: customerId
        ? { setup_future_usage: "on_session" }
        : undefined,
      success_url: successUrl.toString(),
      cancel_url: cancelUrl.toString(),
      metadata,
    });

    return NextResponse.json({ success: true, url: session.url, kind });
  } catch (error) {
    console.error("One-time checkout error:", error);
    return NextResponse.json(
      { error: "Failed to start checkout" },
      { status: 500 }
    );
  }
}
