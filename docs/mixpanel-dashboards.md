# Mixpanel Dashboards — CheckFollows

This is the exact blueprint for the Mixpanel Boards that let you watch the whole
funnel (landing → search → paywall → payment → upsell → renewal) and find the
drop-offs.

> **How to build:** Mixpanel has **no public API to create Boards** — they are
> created in the UI (`Reports → Boards → + New Board`, then `+ Add report` and
> save each insight). The event names/properties below match the code exactly,
> so each insight is a 30-second paste. Do this once, then every future event
> flows into the same boards automatically.

## Before you build (one-time, 2 min)

1. **Enable Identity Merge** — `Settings → Project Settings → Identity Merge`:
   turn on merge on `$email`. Webhook events (renewals/cancels) fire before the
   buyer signs up and are keyed by email; this merges them into the user profile
   created at signup.
2. **Turn on `$email` as an identity profile property** (default). Do **not**
   put raw email in event properties — it's already on the profile.
3. **Verify live events** — after deploy, run one test checkout and confirm
   `subscription_created` (server) and `subscription_activated` (client) both
   appear under *Live View*.

## Event super-properties worth knowing

Every purchase event carries `cadence` (`weekly`/`quarterly`), `tier`
(`base`/`premium`), `email_alerts` (`true`/`false`). Filter/breakdown any
revenue insight by these three to answer "which plan sells".

---

## Board 1 — Acquisition & Landing

| # | Insight | Type | Event / setup |
|---|---|---|---|
| 1.1 | Landing visits | Total | `landing_viewed` |
| 1.2 | Scroll depth | Funnel | steps: `landing_viewed` → `section_viewed` (breakdown `section`). Use "unique users" |
| 1.3 | Searches submitted | Total | `search_submitted` |
| 1.4 | Search outcome split | Breakdown | `profile_searched` broken down by `found` (then `is_private` / `not_found`) |
| 1.5 | Demo engagement | Breakdown | `preview_tab_changed` by `source` (demo vs locked) |
| 1.6 | CTA clicks by location | Breakdown | `cta_clicked` by `location` |

**Question it answers:** are people searching, and where do they drop before
clicking into the funnel?

---

## Board 2 — Core Funnel (the money funnel)

One **Funnel** insight, unique users, in this exact order:

```
landing_viewed
→ search_submitted
→ profile_searched        (filter: found == true)
→ funnel_cta_clicked
→ onboarding_started
→ lead_captured
→ relationship_selected
→ paywall_viewed
→ checkout_started
→ payment_submitted
→ payment_succeeded
→ subscription_activated
```

Add a **breakdown by `source`** on the `funnel_cta_clicked` step, and a
**breakdown by `cadence`** on `subscription_activated`.

**Supporting insights on the same board:**
- `lead_captured` → `relationship_selected` conversion (mini funnel) — the
  relationship step is a known drop point.
- `relationship_selected` broken down by `relationship` — see which answer
  converts best.
- `paywall_viewed` broken down by `username` presence — did a searched target
  make them more likely to reach the paywall?

**Question it answers:** the single most important number in the product —
what % of landing visitors become paying subscribers, and which step leaks.

---

## Board 3 — Pricing & Revenue

| # | Insight | Type | Event / setup |
|---|---|---|---|
| 3.1 | Pricing page views | Total | `pricing_viewed` |
| 3.2 | Plan selection | Breakdown | `plan_tier_selected` by `tier` |
| 3.3 | Cadence selection | Breakdown | `billing_cadence_selected` by `cadence` |
| 3.4 | Email-alerts toggles | Breakdown | `email_alerts_toggled` by `state` (on/off) — this is the upsell; watch on→off vs off→on |
| 3.5 | Checkouts started | Total | `checkout_button_clicked` + `checkout_started` |
| 3.6 | New subscriptions | Total | `subscription_created` (server) — truth for revenue events |
| 3.7 | New subs by plan | Breakdown | `subscription_created` by `tier`, then by `cadence` |
| 3.8 | Revenue (approx) | Sum | `subscription_created` → formula sum of `amount_paid` (or `subscription_renewed` for recurring). *For exact cash, use the Stripe dashboard.* |
| 3.9 | Payment method split | Breakdown | `payment_submitted` by `method` (express vs card) |
| 3.10 | Payment failures | Breakdown | `payment_failed` by `error` |

**Question it answers:** which plan/cadence/alerts combo actually sells, and
whether Apple/Google Pay vs card matters for conversion.

---

## Board 4 — Upsells (LTV expansion)

| # | Insight | Type | Event / setup |
|---|---|---|---|
| 4.1 | Upsell checkouts started | Breakdown | `upsell_checkout_started` by `kind` |
| 4.2 | Upsell purchases | Breakdown | `one_time_purchase_completed` by `kind` |
| 4.3 | Email-alerts attach rate | Formula | `subscription_activated` where `email_alerts == true` ÷ all `subscription_activated` |
| 4.4 | Rescan usage | Funnel | `rescan_clicked` → `rescan_completed` |
| 4.5 | Export usage | Funnel | `export_clicked` → `export_completed` |
| 4.6 | Mutuals usage | Funnel | `mutuals_clicked` → `mutuals_completed` |

**Question it answers:** are the one-time add-ons and the email-alerts upsell
actually getting bought, and at what attach rate.

---

## Board 5 — Retention & Churn

| # | Insight | Type | Event / setup |
|---|---|---|---|
| 5.1 | Renewals | Total (time series) | `subscription_renewed` — should rise weekly |
| 5.2 | Cancel scheduled | Total | `subscription_cancel_scheduled` — leading churn indicator |
| 5.3 | Cancellations | Total | `subscription_canceled` |
| 5.4 | Payment failures | Total | `payment_failed` (server `invoice.payment_failed`) |
| 5.5 | Retention curve | Retention | event `subscription_renewed` (or `invoice.paid`) — weekly/quarterly cohort |
| 5.6 | Active dashboards opened | Total | `tracking_page_viewed` |
| 5.7 | Monitoring toggles | Breakdown | `monitoring_toggled` by `action` (start/stop) |
| 5.8 | Account views | Total | `account_viewed` |

**Question it answers:** are people staying subscribed and actually opening the
dashboard? A healthy product shows `tracking_page_viewed` recurring across
weeks, not just on day 1.

---

## Board 6 — Risk & Ops

| # | Insight | Type | Event / setup |
|---|---|---|---|
| 6.1 | Disputes | Total | `dispute_created` |
| 6.2 | Fraud warnings | Total | `fraud_warning_created` |
| 6.3 | Checkout init failures | Total | `checkout_init_failed` |
| 6.4 | Login/signup errors | Breakdown | `login_error` / `signup_error` by `error` |

**Question it answers:** is anything breaking at checkout or auth, and how much
dispute/fraud exposure is there.

---

## Quick-start funnel to fix drop-offs

Start with **Board 2**. The two steps with the biggest step-down are your first
two experiments. In this product the usual suspects are:

1. `search_submitted → profile_searched (found)` — private/not-found searches
   leak hard. Check the `is_private` / `not_found` breakdown on `profile_searched`.
2. `relationship_selected → paywall_viewed` — the ~10s scanning animation.
   Compare `scanning_started` vs `scanning_completed` to see if people bail
   mid-scan.
3. `checkout_started → payment_submitted` — the bottom sheet. Check
   `checkout_sheet_closed` volume.
4. `payment_submitted → payment_succeeded` — check `payment_failed` by `error`
   and `method`.
