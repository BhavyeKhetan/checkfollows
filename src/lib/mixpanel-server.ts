/**
 * Server-side Mixpanel tracking.
 *
 * The browser SDK (`src/lib/mixpanel.ts`) can't see backend lifecycle events
 * (Stripe webhooks: renewals, cancellations, failed payments, one-time upsell
 * credits). This module sends those through Mixpanel's Ingestion HTTP API so
 * revenue/lifecycle reporting is complete, not just the client funnel.
 *
 * Distinct ID contract (must match the client so profiles merge):
 *   - Prefer the stable Supabase user UUID when known (metadata.user_id).
 *   - Fall back to the customer email while the funnel visitor hasn't signed
 *     up yet. Enable Mixpanel's "identity merge" on `$email` so the later
 *     `identify(uuid)` merges these pre-signup events into the user profile.
 *
 * The project token only identifies which project receives events; it cannot
 * read data back, so it is safe to use server-side.
 */

const TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;
const INGEST_URL = "https://api.mixpanel.com/track";

export interface ServerTrackProps {
  /** Stable user UUID if known — otherwise omit and pass `email`. */
  user_id?: string;
  /** Customer email (only used as distinct_id fallback + $email identity). */
  email?: string;
  [key: string]: unknown;
}

/**
 * Fire-and-forget server event. Never throws and never blocks the caller —
 * analytics must not break payments or webhook handling.
 */
export function trackServer(
  event: string,
  props: ServerTrackProps = {}
): void {
  if (!TOKEN) return;

  const { user_id, email, ...rest } = props;
  const distinctId = user_id || email || "anonymous";
  const properties: Record<string, unknown> = {
    token: TOKEN,
    distinct_id: distinctId,
    time: Math.floor(Date.now() / 1000),
    ...rest,
  };
  if (email) properties.$email = email;
  if (user_id) properties.$user_id = user_id;

  const data = Buffer.from(JSON.stringify([{ event, properties }])).toString(
    "base64"
  );

  void fetch(INGEST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ data }).toString(),
  }).catch((err) => {
    console.error("[mixpanel:server] track failed:", err);
  });
}
