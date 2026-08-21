import { NextResponse } from "next/server";
import {
  getStripe,
  getOneTimePriceId,
  RESCAN_BUNDLES,
  type RescanBundle,
} from "@/lib/stripe";
import { getAuthUser, hasActiveSubscription } from "@/lib/supabase/auth";

const KINDS = ["export", "rescan_credits", "mutuals"] as const;
type OneTimeKind = (typeof KINDS)[number];

/**
 * POST /api/stripe/one-time
 * Body: { kind: "export" | "rescan_credits" | "mutuals",
 *         bundle?: "3" | "10" | "30",
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
    const kind = typeof body.kind === "string" ? body.kind : "";
    if (!KINDS.includes(kind as OneTimeKind)) {
      return NextResponse.json({ error: "Invalid purchase kind" }, { status: 400 });
    }

    const targetId = typeof body.targetId === "string" ? body.targetId : undefined;
    const username = typeof body.username === "string" ? body.username : undefined;

    let bundle: RescanBundle | undefined;
    let credits = 1;

    if (kind === "rescan_credits") {
      const rawBundle = String(body.bundle || "30");
      bundle = rawBundle === "3" || rawBundle === "10" || rawBundle === "30" ? rawBundle : "30";
      const bundleConfig = RESCAN_BUNDLES.find((b) => b.bundle === bundle);
      credits = bundleConfig ? bundleConfig.credits : 30;
    } else {
      credits = Math.min(
        Math.max(parseInt(String(body.quantity), 10) || 1, 1),
        10
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const stripe = getStripe();
    const priceId = getOneTimePriceId(kind as OneTimeKind, bundle);

    const metadata: Record<string, string> = {
      product: "checkfollows",
      kind,
      user_id: user.id,
      credits: String(credits),
      quantity: String(credits),
    };
    if (bundle) metadata.bundle = bundle;
    if (targetId) metadata.target_id = targetId;
    if (username) metadata.username = username;

    const returnPath = username
      ? `/track/${encodeURIComponent(username.replace(/^@/, ""))}`
      : "/dashboard";

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: bundle ? 1 : credits }],
      customer_email: user.email || undefined,
      success_url: `${baseUrl}${returnPath}?purchase=${kind}&success=true`,
      cancel_url: `${baseUrl}${returnPath}?purchase=${kind}&canceled=true`,
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
