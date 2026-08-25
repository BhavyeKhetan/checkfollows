# CheckFollows Private Scan Shortcut

The CheckFollows Scan Shortcut captures Instagram follower/following data from your iPhone Safari session without storing your login credentials.

## Quick setup

1. **Add the Shortcut.** Get it from [iCloud link — to be added after release].
2. **Enable scripts.** Open *Settings → Shortcuts → Advanced* and turn on **Allow Running Scripts**.
3. **Sign into Instagram.** Open `instagram.com` in Safari and sign in as normal.

## How to scan a private account

1. On CheckFollows, navigate to the private account you're tracking.
2. Tap **Scan now**. A token is copied to your clipboard and Instagram opens in Safari.
3. In Safari, tap the **Share** button (square + arrow).
4. Scroll down and tap **CheckFollows Scan**.
5. The Shortcut runs. When it finishes, it returns you to your results page.

## What the Shortcut collects

- Your scan job token (to authorize uploads to CheckFollows)
- The Instagram user ID and username of the account being scanned
- The numeric IDs, usernames, and public metadata for each account in the follower/following lists
- Pagination cursor values (`max_id`) for completeness proof

## What the Shortcut NEVER sends

- Your Instagram password
- Your Instagram session cookie
- Any CSRF or authentication token
- Your device identifier
- Any data you can't already see by viewing the account on Instagram

## Troubleshooting

| Problem | Fix |
|---|---|
| Shortcut doesn't appear in Share Sheet | Make sure you're on an Instagram profile page in Safari |
| "Allow Running Scripts" missing | Go to Settings → Shortcuts → Advanced |
| Shortcut times out | Accounts with 10,000+ lists may need a retry. Tap Scan now again. |
| Scan results don't appear | Check your internet connection. The Shortcut uploads pages in real time. |
| Instagram asks you to log in | Sign in to Instagram in Safari, then retry the scan. |

## Versions

- **Shortcut version:** 2.0.0
- **Adapter version:** 2.0.0
- **Min iOS:** 17.0