# Additional concurrent account billing

## Customer pricing

- Basic includes 3 concurrently monitored accounts.
- Premium includes 5 concurrently monitored accounts.
- Each additional weekly slot costs $1 per week.
- Each additional quarterly slot costs $14 per three-month billing cycle.
- Pausing an account frees its slot. Saved history remains attached to the account.
- Customers can add slots to either tier. The account UI supports adding up to 50
  at once; the server accepts up to 500 additional slots per subscription.

## Why quarterly costs $14 per slot

The production monitoring path fetches both following changes and, for eligible
smaller targets, follower changes every 48 hours. The configured Apify Actor
charges $0.20 per 1,000 delivered profiles. In the small live sample available
on 2026-08-19, the three complete paired monitoring cycles averaged 1,301.3
delivered profiles. At 46 cycles per quarter, that is about $11.97 in Apify
usage per average account before Stripe fees.

The $14 quarterly price is intentionally close to cost. Ten extra accounts add
$140 per quarter, or about $10.77 per week total. A $5-per-week ten-account
bundle would lose money at the observed usage level.

Sources:

- [Configured Apify Actor pricing](https://apify.com/dead00/instagram-followers-following-scraper-no-cookies)
- [Stripe standard pricing](https://stripe.com/pricing)

## Stripe catalog and environment wiring

The add-on is a recurring Stripe subscription item whose quantity equals the
number of paid additional slots. The server prorates increases immediately and
does not grant capacity until Stripe applies the item update.

Set these variables in each environment:

```text
STRIPE_ADDITIONAL_ACCOUNT_WEEKLY_ID=
STRIPE_ADDITIONAL_ACCOUNT_QUARTERLY_ID=
```

Provisioned sandbox prices:

- Weekly: `price_1U65JuExaeatW6VmrbfTBB8k`
- Quarterly: `price_1U65JuExaeatW6VmsPwCC5FB`

Provisioned live prices:

- Weekly: `price_1U65JuEi1nLQhnv8BYBY3HQX`
- Quarterly: `price_1U65JuEi1nLQhnv8xPMv2Yxk`

Never mix sandbox Price IDs with a live secret key or live Price IDs with a
test secret key; Stripe returns `resource_missing` for cross-mode IDs.
