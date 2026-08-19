<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Mixpanel Analytics

Mixpanel is the **only** product-analytics tool for CheckFollows (no PostHog/GA/Amplitude). Do not add other analytics tools.

- **Platform:** Next.js (App Router), web only.
- **SDK:** `mixpanel-browser` (v2) — client-side only.
- **Project token:** `NEXT_PUBLIC_MIXPANEL_TOKEN` (public by design; set in `.env.local` and Vercel production/development).
- **Tracking method:** client-side SDK.
- **CDP:** none.
- **Consent:** not gated yet — flag EU/CA consent before expanding if the audience includes regulated regions.

### Where the wiring lives
- **Init + session-restore identify:** `src/components/analytics/mixpanel-provider.tsx` (mounted once in `src/app/layout.tsx`).
- **Client singleton:** `src/lib/mixpanel.ts` — `initMixpanel()`, `track(event, props)`, `identify(userId, peopleProps)`, `reset()`.
- **Server ingestion:** `src/lib/mixpanel-server.ts` — `trackServer(event, props)` posts to the Mixpanel Ingestion API for backend-only lifecycle events (Stripe webhooks).
- **Identity:** `identify()` on login/signup (Supabase user UUID, never email), `reset()` on logout (`src/app/account/page.tsx`), plus session-restore identify on app load.
- **Server ↔ client merge:** webhook events fire *before* the buyer signs up, so they use the customer **email** as `distinct_id`; the later `identify(uuid)` merges them via Mixpanel identity merge on `$email`. Enable **Identity Merge** in Project Settings.

### Tracking plan (snake_case, past-tense verb + noun)

**Landing / acquisition**
| Event | Where | Properties |
|---|---|---|
| `landing_viewed` | `src/app/page.tsx` mount | — |
| `section_viewed` | landing (IntersectionObserver) | `section` (truth-section, comparison, use-cases, testimonials, faq) |
| `cta_clicked` | landing CTA buttons | `location` (nav, hero_pointer, hero, bottom, sticky, nav_mobile) |
| `search_submitted` | landing + `search-box.tsx` (SEO pages) | `username`, `source` (seo_page) |
| `profile_searched` | landing search result | `username`, `found`, `cached`, `is_private`, `not_found` |
| `preview_tab_changed` | landing locked/demo tabs | `tab` (followers/following), `source` (locked/demo) |
| `faq_opened` | landing + pricing + SEO FAQ | `context`, `question` |
| `funnel_cta_clicked` | landing → onboarding | `username`, `source` (profile_card, lock_overlay, demo_profile, demo_paywall) |

**Funnel (onboarding) → paywall**
| Event | Where | Properties |
|---|---|---|
| `onboarding_started` | onboarding mount | `username`, `has_username` |
| `lead_captured` | email step | `has_username` |
| `relationship_selected` | relationship step | `relationship` |
| `scanning_started` / `scanning_completed` | scanning step | `username` |
| `paywall_viewed` | paywall step | `username` |
| `plan_tier_selected` | paywall + pricing toggles | `tier`, `source` |
| `billing_cadence_selected` | paywall + pricing toggles | `cadence`, `source` |
| `email_alerts_toggled` | paywall + pricing upsell | `state` (on/off), `cadence`, `source` |
| `paywall_faq_opened` | paywall FAQ | `question` |
| `checkout_started` | paywall → checkout sheet | `cadence`, `tier`, `email_alerts` |
| `checkout_sheet_closed` | checkout sheet dismissed | `cadence`, `tier`, `email_alerts` |
| `checkout_loaded` | embedded checkout clientSecret ready | `cadence`, `tier`, `email_alerts` |
| `checkout_init_failed` | embedded checkout init error | `cadence`, `tier`, `email_alerts` |
| `payment_submitted` | Stripe confirm (express/card) | `method`, `cadence`, `tier`, `email_alerts` |
| `payment_succeeded` / `payment_failed` / `payment_processing` | Stripe confirm outcome | `method`, `error`, `cadence`, `tier`, `email_alerts` |
| `subscription_activated` | payment success (client) | `cadence`, `tier`, `email_alerts`, `username`, `via_3ds_redirect` |
| `post_purchase_redirect` | post-payment routing | `destination` (account/signup) |

**Pricing page**
| Event | Where | Properties |
|---|---|---|
| `pricing_viewed` | pricing mount | — |
| `plan_tier_selected` / `billing_cadence_selected` / `email_alerts_toggled` | pricing toggles | `source: pricing` |
| `checkout_button_clicked` | pricing CheckoutButton | `cadence`, `tier`, `email_alerts` |
| `checkout_redirected` / `checkout_error` | pricing checkout redirect | `cadence`, `tier`, `email_alerts`, `error` |

**Auth**
| Event | Where | Properties |
|---|---|---|
| `signup_viewed` | signup mount | `has_username`, `has_prefill_email` |
| `signup_submitted` / `signup_error` | signup submit/error | `has_username`, `error` |
| `sign_up_completed` | signup success | `sign_up_method`, `platform`, `is_first_time`, `has_username` |
| `login_viewed` | login mount | — |
| `signed_in` / `login_error` | login success/error | `platform`, `error` |
| `signed_out` | account logout | `platform` |

**Account + paid dashboard (`/account`, `/track/[username]`)**
| Event | Where | Properties |
|---|---|---|
| `account_viewed` | account load | `has_active_subscription` |
| `spike_threshold_saved` | account settings | `threshold` |
| `subscribe_cta_clicked` | account subscribe | `location` |
| `add_account_clicked` / `tracked_account_opened` | account tracked list | `username` |
| `account_capacity_increased` | recurring account-slot purchase succeeds | `cadence`, `tier`, `additional_accounts`, `total_capacity` |
| `tracking_page_viewed` | track page load | `username`, `monitoring_enabled`, `events_count` |
| `monitoring_toggled` | track page toggle | `action` (start/stop), `username` |
| `timeline_filter_changed` | track page tabs | `tab`, `username` |
| `rescan_clicked` / `rescan_completed` | rescan upsell | `username`, `has_credit` |
| `export_clicked` / `export_completed` | export upsell | `username`, `has_credit` |
| `mutuals_clicked` / `mutuals_completed` | mutuals upsell | `username`, `other`, `has_credit`, `mutual_count` |
| `upsell_checkout_started` | one-time Stripe checkout | `kind` (export/rescan_credits/mutuals), `username` |
| `instagram_link_clicked` | view-on-Instagram link | `username` |

**Server-side lifecycle (Stripe webhook — `trackServer`)**
| Event | Trigger | Properties |
|---|---|---|
| `subscription_created` | `invoice.paid` (billing_reason `subscription_create`) | `amount_paid`, `plan`, `tier`, `cadence` |
| `subscription_renewed` | `invoice.paid` (`subscription_cycle`) | `amount_paid`, `plan`, `tier`, `cadence` |
| `subscription_cancel_scheduled` | `customer.subscription.updated` (cancel_at_period_end) | `plan`, `tier` |
| `subscription_canceled` | `customer.subscription.deleted` | `plan`, `tier` |
| `payment_failed` | `invoice.payment_failed` | `plan`, `tier` |
| `one_time_purchase_completed` | `checkout.session.completed` (mode payment) | `kind`, `quantity` |
| `dispute_created` | `charge.dispute.created` | `charge_id` |
| `fraud_warning_created` | `radar.early_fraud_warning.created` | `charge_id`, `actionable` |

### Rules
- Event names are case-sensitive `snake_case`.
- Never put PII (email, real names, phone) in event properties — use `identify()`/people properties for `$email`/`$name`.
- Identify with the stable Supabase user UUID, not email (server events use email as `distinct_id` only until identity merge).
- Always call `reset()` on logout (privacy + no profile bleed).
- Fire events only after the action succeeds (e.g. `subscription_activated` after activation, not on button click).
- Analytics calls must never throw or block the page/webhook — keep them non-blocking (`void`/`try-catch`).
- Dashboards: build in Mixpanel UI (Boards) — see `docs/mixpanel-dashboards.md` for the exact board + insight specs.
