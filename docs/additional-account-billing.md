# Additional concurrent account billing

## Customer pricing

- Basic includes 3 concurrently monitored accounts.
- Premium includes 5 concurrently monitored accounts.
- Each additional weekly slot costs $1 per week.
- Each additional quarterly slot costs $14 per three-month billing cycle.
- Pausing an account frees its slot. Saved history remains attached to the account.
- Customers can add slots to either tier. The account UI supports adding up to 50
  at once; the server accepts up to 500 additional slots per subscription.
- Slots and scan credits are separate. Adding a slot does not mint scan
  credits; every target shares the subscriber's pooled weekly and purchased
  scan-credit balance.

## Cost controls

Automated monitoring performs a low-cost profile-count check every 48 hours.
It does not automatically fetch follower lists. A complete following-list scan
runs only when the following count changes, a baseline is missing, or the user
requests an immediate rescan.

The configured Actor charges $0.29 per 1,000 delivered profiles. One customer
scan credit covers up to 1,000 following profiles. Basic receives 12 credits
per week and Premium receives 18; purchased credits never expire. Complete
scans reserve the required credits before the Actor is called and refund them
when the result is failed, suspect, or incomplete.

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
