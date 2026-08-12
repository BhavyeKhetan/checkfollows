import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { targetId, email } = body;

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
      .select("id, username")
      .eq("id", targetId)
      .single();

    if (!target) {
      return NextResponse.json(
        { success: false, error: "Target not found" },
        { status: 404 }
      );
    }

    // Check if already subscribed
    const { data: existing } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("target_id", targetId)
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      // Re-activate if inactive
      await supabase
        .from("subscriptions")
        .update({ active: true, updated_at: new Date().toISOString() })
        .eq("id", existing.id);

      return NextResponse.json({
        success: true,
        message: "Subscription reactivated",
        alreadySubscribed: true,
      });
    }

    // Create new subscription
    const { error } = await supabase.from("subscriptions").insert({
      target_id: targetId,
      email,
      plan: "free",
      active: true,
    });

    if (error) {
      console.error("Subscription insert error:", error);
      return NextResponse.json(
        { success: false, error: "Failed to create subscription" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Now tracking @" + target.username,
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
