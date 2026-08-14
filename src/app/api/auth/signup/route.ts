import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * POST /api/auth/signup
 * Body: { email, password }
 *
 * Creates a Supabase auth user (auto-confirmed so the funnel is frictionless),
 * then links any subscription purchased with that email to the new user.
 * The client signs in with the password afterward to establish a session.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json(
        { success: false, error: "A valid email is required" },
        { status: 400 }
      );
    }
    if (password.length < 8) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { source: "checkfollows" },
    });

    if (error) {
      const alreadyExists =
        error.status === 422 ||
        /already|registered|exists/i.test(error.message);
      if (alreadyExists) {
        return NextResponse.json({
          success: true,
          exists: true,
          error: "An account with this email already exists",
        });
      }
      console.error("signup createUser error:", error.message);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      );
    }

    const userId = data.user?.id;
    if (userId) {
      // Attach any paid subscription(s) purchased with this email before signup.
      const { error: linkErr } = await supabase
        .from("subscriptions")
        .update({ user_id: userId, updated_at: new Date().toISOString() })
        .eq("email", email)
        .is("user_id", null);

      if (linkErr) {
        console.warn("signup: failed to link subscriptions:", linkErr.message);
      }
    }

    return NextResponse.json({ success: true, user_id: userId });
  } catch (error) {
    console.error("signup error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create account" },
      { status: 500 }
    );
  }
}
