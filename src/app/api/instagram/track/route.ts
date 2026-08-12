import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { enableMonitoring } from "@/lib/monitoring";

const MAX_TRACKED = parseInt(
  process.env.MAX_TRACKED_ACCOUNTS_PER_USER || "5",
  10
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { targetId, email, plan } = body;

    if (!targetId || !email) {
      return NextResponse.json(
        { success: false, error: "targetId and email are required" },
        { status: 400 }
      );
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { success: false, error: "Invalid email address" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    // Check target exists
    const { data: target } = await supabase
      .from("instagram_targets")
      .select("id, username, monitoring_enabled")
      .eq("id", targetId)
      .single();

    if (!target) {
      return NextResponse.json(
        { success: false, error: "Target not found" },
        { status: 404 }
      );
    }

    // Check if already subscribed (same email + same target)
    const { data: existing } = await supabase
      .from("subscriptions")
      .select("id, plan")
      .eq("target_id", targetId)
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      // Re-activate if inactive
      const newPlan = plan || existing.plan;
      await supabase
        .from("subscriptions")
        .update({
          active: true,
          plan: newPlan,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (!target.monitoring_enabled) {
        await enableMonitoring(targetId);
      }

      return NextResponse.json({
        success: true,
        message: "Subscription reactivated — monitoring is active",
        alreadySubscribed: true,
      });
    }

    // ─── Account cap check ───────────────────────────────
    const { count } = await supabase
      .from("subscriptions")
      .select("*", { count: "exact", head: true })
      .eq("email", email)
      .eq("active", true);

    if (count !== null && count >= MAX_TRACKED) {
      return NextResponse.json(
        {
          success: false,
          error: `You're tracking ${count} accounts already — the limit is ${MAX_TRACKED}. Upgrade to track more.`,
          atLimit: true,
          currentCount: count,
          maxAllowed: MAX_TRACKED,
        },
        { status: 402 }
      );
    }

    // ─── Create subscription ─────────────────────────────
    // plan: "free" = monitoring only, "pro" = monitoring + email alerts
    const subscriptionPlan = plan || "free";

    const { error } = await supabase.from("subscriptions").insert({
      target_id: targetId,
      email,
      plan: subscriptionPlan,
      active: true,
    });

    if (error) {
      console.error("Subscription insert error:", error);
      return NextResponse.json(
        { success: false, error: "Failed to create subscription" },
        { status: 500 }
      );
    }

    // Enable monitoring for this target
    await enableMonitoring(targetId);

    const alertNote =
      subscriptionPlan === "pro"
        ? " — email alerts are active"
        : " — upgrade to Pro for email alerts";

    return NextResponse.json({
      success: true,
      message: `Now tracking @${target.username}${alertNote}`,
      targetUsername: target.username,
    });
  } catch (error) {
    console.error("Track API error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
