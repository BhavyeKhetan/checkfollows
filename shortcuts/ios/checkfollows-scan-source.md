# CheckFollows Scan Shortcut — JavaScript Source

**Version:** 2.0.0
**Min iOS:** 17.0
**Adapter spec:** Private mobile scan API (Aug 2026)

This document describes the JavaScript that runs inside Apple Shortcut's
**Run JavaScript on Webpage** actions. Each code block is a separate
Run JavaScript on Webpage action in the Shortcut.

> **Important change (v2):** Instagram retired the old `graphql/query?query_hash=`
> endpoint. The modern web uses a plain cookie-authenticated REST endpoint:
>
> ```
> GET https://www.instagram.com/api/v1/friendships/{USER_ID}/followers/?count=200
> GET https://www.instagram.com/api/v1/friendships/{USER_ID}/following/?count=200
> ```
>
> with `&max_id={next_max_id}` for each subsequent page. **No query hashes are
> required.** The Shortcut runs same-origin (on instagram.com), so the session
> cookie is sent automatically with `credentials: "include"`.

---

## Action 1: Bootstrap — Handshake

Runs first. Confirms we're on an Instagram page, records viewer identity, and
gets the **server-truth target identity** (numeric Instagram id + username)
plus the permitted list types from CheckFollows.

```javascript
// Action 1: Bootstrap handshake
// Runs on: https://www.instagram.com/ (any page — target identity comes from
// the server, not from scraping the page)

const CF_API = "[[CF_API_URL]]"; // e.g. https://app.checkfollows.com/api/private-scan

// 1. Extract scan token from clipboard (Shortcut passes it via variable)
const scanToken = "[[Clipboard]]".trim();
if (!scanToken || scanToken.length < 10) {
  throw new Error("No scan token found. Start the scan from CheckFollows first.");
}

// 2. Best-effort viewer identity (nullable — not required to scan).
//    The modern Instagram web no longer exposes a reliable window._sharedData,
//    so we do not depend on this.
let viewerInstagramId = null;
let viewerUsername = null;
try {
  if (window._sharedData?.config?.viewer) {
    viewerInstagramId = window._sharedData.config.viewer.id || null;
    viewerUsername = window._sharedData.config.viewer.username || null;
  }
} catch (e) {}

// 3. POST to bootstrap — the server tells us the target's numeric Instagram id.
const bootstrapResponse = await fetch(`${CF_API}/bootstrap`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${scanToken}`,
  },
  body: JSON.stringify({
    hostname: window.location.hostname,
    viewerInstagramId: viewerInstagramId,
    viewerUsername: viewerUsername,
    shortcutVersion: "[[SHORTCUT_VERSION]]", // e.g. "2.0.0"
    adapterVersion: "[[ADAPTER_VERSION]]",   // e.g. "2.0.0"
  }),
});

const bootstrapData = await bootstrapResponse.json();

if (!bootstrapResponse.ok || !bootstrapData.ok) {
  throw new Error(`Bootstrap failed: ${bootstrapData.errorCode || "unknown error"}`);
}

if (!bootstrapData.targetInstagramId) {
  throw new Error("Bootstrap returned no target id.");
}

// Return to Shortcut: the target id, username, permitted lists, and token.
completion({
  scanToken: scanToken,
  targetInstagramId: bootstrapData.targetInstagramId,
  targetUsername: bootstrapData.targetUsername,
  permittedLists: bootstrapData.permittedLists,
});
```

---

## Action 2: Scan followers + following (REST pagination loop)

For each permitted list type, this action paginates Instagram's REST endpoint
and streams each page to CheckFollows as it arrives.

```javascript
// Action 2: Scan lists (followers and following)
// Runs after bootstrap succeeds. Uses the modern /api/v1/friendships REST API.

const CF_API = "[[CF_API_URL]]";
const scanToken = "[[ScanToken]]";               // passed from Action 1
const TARGET_ID = "[[TargetInstagramId]]";       // numeric id, passed from Action 1
const PERMITTED_LISTS = [[PermittedLists]];      // JSON array, e.g. ["followers","following"]
const ADAPTER_VERSION = "[[ADAPTER_VERSION]]";

const PAGE_SIZE = 200; // Instagram may cap this lower; the loop handles any count.
const MAX_PAGES = 100; // safety limit (~20,000 accounts at 200/page)

// ─── Instagram web API headers ────────────────────────
// The modern endpoint requires these two headers plus the session cookie.
// csrftoken is read from document.cookie (not HttpOnly on Instagram web).
function csrfToken() {
  const m = document.cookie.match(/(?:^|;\s*)csrftoken=([^;]+)/);
  return m ? m[1] : null;
}

const IG_APP_ID = "936619743392459"; // stable web app id used by Instagram's client

// ─── Helper: fetch one page ───────────────────────────
async function fetchPage(listType, maxId) {
  let url = `https://www.instagram.com/api/v1/friendships/${TARGET_ID}/${listType}/?count=${PAGE_SIZE}`;
  if (maxId) {
    url += `&max_id=${encodeURIComponent(maxId)}`;
  }

  const csrf = csrfToken();
  const headers = {
    "Accept": "application/json",
    "X-Requested-With": "XMLHttpRequest",
    "X-IG-App-ID": IG_APP_ID,
  };
  if (csrf) headers["X-CSRFToken"] = csrf;

  const response = await fetch(url, {
    method: "GET",
    credentials: "include",
    headers: headers,
  });

  if (response.status === 401 || response.status === 403) {
    // Could be a login wall or a private account the viewer can't access.
    throw new Error("INSTAGRAM_PRIVATE_ACCESS_DENIED");
  }
  if (response.status === 429) {
    throw new Error("INSTAGRAM_RATE_LIMITED");
  }
  if (!response.ok) {
    throw new Error(`INSTAGRAM_FORBIDDEN: HTTP ${response.status}`);
  }

  return response.json();
}

// ─── Helper: upload a page to CheckFollows ────────────
async function uploadPage(pageData) {
  const response = await fetch(`${CF_API}/page`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${scanToken}`,
    },
    body: JSON.stringify(pageData),
  });

  const data = await response.json();
  if (!response.ok || !data.accepted) {
    throw new Error(`Page upload rejected: ${data.errorCode || "unknown"}`);
  }
  return data;
}

// ─── Helper: finalize one list type ───────────────────
async function finalizeList(listType) {
  const response = await fetch(`${CF_API}/finalize-list`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${scanToken}`,
    },
    body: JSON.stringify({ listType }),
  });

  const data = await response.json();
  if (!response.ok || !data.listComplete) {
    throw new Error(`Finalize failed: ${data.errorCode || "unknown"}`);
  }
  return data;
}

// ─── Scan one list type ───────────────────────────────
async function scanList(listType) {
  let maxId = null;
  let pageIndex = 0;
  let terminal = false;

  while (!terminal && pageIndex < MAX_PAGES) {
    let json;
    try {
      json = await fetchPage(listType, maxId);
    } catch (err) {
      throw new Error(`Page fetch failed at page ${pageIndex}: ${err.message}`);
    }

    // Validate the REST response shape
    if (!json || json.status !== "ok" || !Array.isArray(json.users)) {
      throw new Error("INSTAGRAM_RESPONSE_MALFORMED: missing users array");
    }

    // Map Instagram's snake_case members to CheckFollows' camelCase contract
    const members = json.users.map((u) => ({
      instagramId: String(u.id || u.pk),
      username: String(u.username),
      fullName: u.full_name || null,
      isVerified: u.is_verified === true,
      avatarUrl: u.profile_pic_url || null,
    }));

    // Pagination state
    const hasMore = json.has_more === true;
    const nextMaxId = json.next_max_id ?? null;
    terminal = !hasMore || !nextMaxId;

    const pagePayload = {
      listType,
      pageIndex,
      requestCursor: maxId,     // null on first page
      nextCursor: nextMaxId,    // null on terminal page
      terminal,
      members,
      responseEvidence: {
        rawCount: json.users.length,
        sourceStatus: 200,
        schemaVersion: ADAPTER_VERSION,
      },
    };

    await uploadPage(pagePayload);

    maxId = nextMaxId;
    pageIndex++;

    // Safety: has_more true but no next cursor = broken traversal
    if (hasMore && !nextMaxId) {
      throw new Error("CURSOR_MISSING: has_more true but no next_max_id");
    }
  }

  if (!terminal) {
    throw new Error("SCAN_TIMEOUT: exceeded maximum pages without reaching terminal state");
  }

  const finalResult = await finalizeList(listType);
  return finalResult;
}

// ─── Execute ───
const results = {};
for (const listType of PERMITTED_LISTS) {
  try {
    results[listType] = await scanList(listType);
  } catch (err) {
    results[listType] = { error: err.message };
    // Don't stop on one list failure — continue with the next
  }
}

completion(results);
```

---

## Action 3: Finalize and navigate

After all lists are scanned and uploaded, finalize the job and navigate back
to CheckFollows.

```javascript
// Action 3: Finalize job and navigate to results

const CF_API = "[[CF_API_URL]]";
const scanToken = "[[ScanToken]]";

const response = await fetch(`${CF_API}/finalize`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${scanToken}`,
  },
});

const data = await response.json();

if (data.success && data.resultsUrl) {
  // Navigate Safari to the results page
  window.location.href = data.resultsUrl;
  completion({ success: true, resultsUrl: data.resultsUrl });
} else {
  // Even on failure, take the user back
  window.location.href = "[[BASE_URL]]/track/[[USERNAME]]?purchase=&success=";
  completion({ success: false, error: data.error || "Finalize failed" });
}
```

---

## Error handling

| Error from JS | Shortcut action |
|---|---|
| `No scan token found` | Show alert "Start the scan from CheckFollows first." Stop. |
| `Bootstrap failed: ...` | Show alert with the error. Stop. |
| `INSTAGRAM_PRIVATE_ACCESS_DENIED` | Show alert "Instagram didn't let you view this private account's lists. Make sure you follow it and are logged in." Stop. |
| `INSTAGRAM_RATE_LIMITED` | Show alert "Instagram asked us to slow down. Try again in a few minutes." Stop. |
| `INSTAGRAM_FORBIDDEN` | Show alert "Instagram refused part of this scan. Try again later." Stop. |
| `INSTAGRAM_RESPONSE_MALFORMED` | Show alert "Instagram changed something. Check for a Shortcut update." Stop. |
| `CURSOR_MISSING` | Show alert "We couldn't verify the complete list was loaded. Try again." Stop. |
| `SCAN_TIMEOUT` | Show alert "This account has too many entries to scan. Try again." Stop. |
| `Page upload rejected` | Show alert "Upload failed. Check your connection and try again." Stop. |
| Any other error | Show alert with the error message. Stop. |

All errors are **fail-closed**: nothing is saved unless the entire scan passes validation.

---

## Version policy

The `ADAPTER_VERSION` and `SHORTCUT_VERSION` constants are sent to CheckFollows
with the bootstrap and page uploads. The server tracks:

- Which adapter versions are in the wild
- Whether newer versions exist
- Whether old versions should be rejected (via `MIN_ADAPTER_VERSION` kill switch)

When Instagram changes their REST endpoint shape, we:
1. Update this file (field names, headers, or URL path)
2. Bump `ADAPTER_VERSION`
3. Deploy the updated Shortcut
4. (Optionally) set `MIN_ADAPTER_VERSION` to reject old adapters

---

## Shortcut variable wiring

| Placeholder | Value |
|---|---|
| `[[CF_API_URL]]` | `https://app.checkfollows.com/api/private-scan` |
| `[[BASE_URL]]` | `https://app.checkfollows.com` |
| `[[USERNAME]]` | The target's Instagram username (passed from the results URL) |
| `[[Clipboard]]` | The scan token the CheckFollows page copies to the clipboard |
| `[[SHORTCUT_VERSION]]` / `[[ADAPTER_VERSION]]` | `2.0.0` |
| `[[ScanToken]]` | Output of Action 1's `scanToken` |
| `[[TargetInstagramId]]` | Output of Action 1's `targetInstagramId` |
| `[[PermittedLists]]` | Output of Action 1's `permittedLists` (JSON array) |
