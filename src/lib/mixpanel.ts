import mixpanel from "mixpanel-browser";

/**
 * Mixpanel is the sole product-analytics tool for CheckFollows.
 *
 * This module is a lazy, SSR-safe singleton around the mixpanel-browser SDK.
 * Import `track` / `identify` / `reset` from here in client components only —
 * every call is a no-op during server rendering and when the project token
 * is not configured.
 *
 * The project token is intentionally public (NEXT_PUBLIC_*); it only identifies
 * which Mixpanel project receives events, it cannot read data back.
 */

const TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;

let initialized = false;

function client(): typeof mixpanel | null {
  if (typeof window === "undefined") return null;
  if (!TOKEN) return null;
  if (!initialized) {
    mixpanel.init(TOKEN, {
      // We instrument the events we care about explicitly; avoid auto page
      // views polluting the event stream with marketing-page noise.
      track_pageview: false,
      persistence: "localStorage",
    });
    initialized = true;
  }
  return mixpanel;
}

/** Ensure the SDK is initialized (call once on app mount). */
export function initMixpanel(): void {
  client();
}

/**
 * Record an event. Event names are snake_case past-tense verbs + noun
 * (e.g. `profile_searched`, `subscription_activated`).
 * Never pass PII (email, real names, phone) as event properties — use
 * `identify()` / people properties for those.
 */
export function track(event: string, properties?: Record<string, unknown>): void {
  client()?.track(event, properties);
}

/**
 * Link the current anonymous visitor to a known user (their stable Supabase
 * UUID — never an email). Optionally set people profile properties.
 */
export function identify(
  userId: string,
  peopleProps?: Record<string, unknown>
): void {
  const mp = client();
  if (!mp) return;
  mp.identify(userId);
  if (peopleProps && Object.keys(peopleProps).length > 0) {
    mp.people.set(peopleProps);
  }
}

/** Clear identity on logout so the next user isn't merged into this profile. */
export function reset(): void {
  client()?.reset();
}
