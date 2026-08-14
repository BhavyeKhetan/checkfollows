import { createServerClient as createSSRClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createServerClient } from "./server";
import type { Database } from "./types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export interface AuthUser {
  id: string;
  email: string | null;
}

/**
 * Resolve the currently authenticated Supabase user from the request cookies.
 * Used in route handlers and server components. Returns null when unauthenticated.
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const supabase = createSSRClient<Database>(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Route handlers/server components must not write cookies here;
          // the browser client is responsible for refreshing sessions.
        },
      },
    });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    return { id: user.id, email: user.email ?? null };
  } catch {
    return null;
  }
}

/**
 * True when the user owns at least one active, Stripe-backed subscription.
 * This is the single entitlement gate for paid features (full scans, tracking,
 * viewing real follow data).
 */
export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("user_id", userId)
    .eq("active", true)
    .not("stripe_subscription_id", "is", null)
    .limit(1)
    .maybeSingle();
  return !!data;
}
