# Private Instagram Mobile Scan Plan

**Status:** Proposed MVP architecture
**Date:** 2026-08-24
**Primary target:** iPhone + Safari
**Product constraint:** Web-only CheckFollows. No native CheckFollows app, no browser extension, no password collection, no cookie export, no CheckFollows-owned Instagram account, and no follow request from a service account.

---

## 1. Executive decision

For private Instagram accounts, CheckFollows should use a **user-triggered local scan** from the user's own authenticated Instagram session in Safari.

The user already follows the private target. They explicitly invoke a CheckFollows Apple Shortcut from Safari's Share Sheet while viewing the target on `instagram.com`. The Shortcut runs JavaScript against the active Instagram webpage, retrieves follower/following pages using the user's existing Instagram authorization, sends normalized membership data to CheckFollows, and finally returns the user to a CheckFollows results page.

This is deliberately **not autonomous monitoring**. The user must initiate each private-account scan.

The product should continue using server-side collectors for public accounts where appropriate. This document is specifically the private-account mobile path.

### Non-negotiable privacy rule

CheckFollows must never receive or store:

- Instagram password
- Instagram session cookie / `sessionid`
- cookie header
- CSRF cookie/token unless it is proven to be non-credential metadata and explicitly required; default is never send it
- 2FA secret/code
- device login credential
- an exported Instagram browser session

CheckFollows receives only the scan job token, target/viewer identifiers required for integrity, pagination evidence, and normalized follower/following membership data.

---

## 2. What is proven vs. what is experimental

### Proven platform capability

Apple Shortcuts on iPhone/iPad supports **Run JavaScript on Webpage** from Safari. Apple documents that:

- the Shortcut can be invoked from Safari's Share Sheet;
- JavaScript can retrieve data from and modify the active webpage;
- the action can return JSON-compatible data;
- multiple Run JavaScript on Webpage actions can exist in one Shortcut as long as each receives the Safari webpage as input;
- the JavaScript action has a time limit, so each JS operation should complete quickly.

Official references:

- https://support.apple.com/guide/shortcuts/use-the-run-javascript-on-webpage-action-apdb71a01d93/ios
- https://support.apple.com/guide/shortcuts/apd218e2187d/ios

### Experimental / must be proven before production work

We have **not yet proven** that current Instagram mobile-web follower/following pagination can be reliably reproduced from Shortcut-injected JavaScript using the user's authenticated Safari session.

Do not invent or hard-code an Instagram endpoint from memory.

Before building the production feature, prove on a real iPhone that the Shortcut can:

1. identify the target Instagram account reliably;
2. identify enough about the logged-in viewer to confirm the scan is being run by a stable Instagram user without extracting credentials;
3. make the same authenticated membership request that Instagram web currently uses;
4. retrieve a page of followers for a private account the viewer already follows;
5. retrieve a page of following for that private account;
6. follow the current pagination cursor until the terminal state;
7. do this without requiring manual scrolling;
8. detect and stop on login-required, access-denied, challenge, rate-limit, malformed, timeout, or pagination ambiguity conditions.

**No production integration should begin until this feasibility gate passes.**

---

## 3. Desired user experience

### One-time setup

On CheckFollows:

1. User opens a private account they want to track.
2. CheckFollows says private scans require a one-time iPhone Shortcut setup.
3. User taps **Add CheckFollows Scan**.
4. User adds the shared Shortcut.
5. If required by iOS, onboarding shows how to enable **Allow Running Scripts** in Shortcuts settings.
6. The first time the Shortcut touches `instagram.com`, iOS/Safari displays its own permission prompt.
7. User signs into `instagram.com` in Safari if they are not already signed in.

No CheckFollows app is installed.

### Every scan after setup

From `/track/[username]`:

1. User taps **Scan now**.
2. CheckFollows creates a short-lived private scan job.
3. The browser copies a job-scoped token to the clipboard as part of the user's tap.
4. CheckFollows opens `https://www.instagram.com/{username}/` in Safari.
5. User taps Safari Share.
6. User taps **CheckFollows Scan**.
7. Shortcut verifies the CheckFollows job token and active Instagram page.
8. Shortcut scans followers/following in the background of the active page. No manual scrolling.
9. Shortcut uploads each page to CheckFollows as it is fetched.
10. Server validates completeness and creates a snapshot only after terminal pagination is proven.
11. Shortcut receives a final results URL.
12. Shortcut opens that URL in Safari.
13. User lands back on CheckFollows and sees the changes.

Desired visible flow:

```text
CheckFollows
  -> Scan now
  -> Instagram profile opens
  -> Share
  -> CheckFollows Scan
  -> Scanning…
  -> CheckFollows results
```

The Instagram screen should not visibly scroll or animate through users if the preferred API-pagination path works.

---

## 4. Why the Shortcut must paginate requests, not scrape rendered DOM

Instagram does not render all followers/following at once. The visible list is lazy-loaded.

Therefore:

- DO NOT treat DOM contents as a complete snapshot.
- DO NOT require users to scroll through the list.
- DO NOT mark a scan complete because the number of rendered rows equals some local estimate.

Preferred collection method:

```text
request page 1
  -> members + next cursor
request page 2
  -> members + next cursor
...
request terminal page
  -> members + terminal/no-next-cursor
```

DOM auto-scroll may be used only as an experimental fallback and should not be the MVP architecture. It is slower, much more brittle, exposes implementation behavior on screen, and is harder to prove complete.

---

## 5. Phase 0: iPhone feasibility spike

This is the only work that matters until it succeeds.

### 5.1 Controlled accounts

Prepare test cases where we know the truth:

- logged-in viewer account A;
- private target B followed by A;
- private target C not followed by A;
- public target D;
- target sizes roughly 50, 500, and 1,000+ members where possible.

### 5.2 Minimal Shortcut

Create a developer-only Shortcut with:

- Share Sheet input restricted to Safari webpages;
- Run JavaScript on Webpage;
- JSON result display;
- no CheckFollows backend integration initially.

First prove:

```text
location.hostname
location.pathname
current target identity
viewer identity or stable viewer marker
```

Do not retrieve or print cookies.

### 5.3 Discover current Instagram request behavior

Using controlled development tooling, inspect the current Instagram web flow and document:

- profile-resolution request;
- followers request;
- following request;
- request method;
- required non-secret headers;
- request body/query parameters;
- page-size behavior;
- cursor field;
- terminal field/state;
- private-access failure response;
- logged-out response;
- challenge/rate-limit response;
- schema variants.

Record observations in fixtures. Mark the adapter with the observation date.

### 5.4 First authenticated fetch test

From Shortcut JavaScript running on the active `instagram.com` page:

- fetch exactly one page;
- use the current page's authenticated browser context;
- parse only the required fields;
- call `completion()` quickly;
- return normalized JSON.

Success means a private target followed by the viewer returns real membership data without manual scrolling and without sending any Instagram credential anywhere.

### 5.5 Full pagination test

Run one JS action per page or a very small bounded number of pages per action.

Apple explicitly documents that Run JavaScript on Webpage has a time limit. Therefore the Shortcut orchestration, not one long JS call, owns the pagination loop.

Each JS invocation should do approximately:

```text
input: target, list_type, cursor
fetch one page
classify response
normalize members
return members + next_cursor + terminal + evidence
completion(result)
```

Then the Shortcut loops using the same Safari webpage as input for the next action.

### 5.6 Phase 0 pass criteria

All must be true:

- [ ] Works on a real iPhone in Safari.
- [ ] User is not required to manually scroll.
- [ ] Private target followed by viewer can be read.
- [ ] Private target not followed by viewer fails cleanly.
- [ ] Logged-out Safari fails cleanly.
- [ ] 1,000+ membership pagination reaches an explicit terminal state.
- [ ] Cursor chain can be recorded and validated.
- [ ] Numeric Instagram IDs are available for canonical identity.
- [ ] No Instagram password/session cookie is exported.
- [ ] Shortcut can make multiple bounded JS calls in one user invocation.
- [ ] A timeout or interrupted page never produces a complete result.

### 5.7 Phase 0 stop criteria

Stop this architecture before production work if any of these are true:

- current Instagram web requests cannot be called from Shortcut JavaScript;
- follower/following pagination requires a credential that cannot safely remain local;
- the Shortcut cannot reliably distinguish terminal pagination from an error;
- the Shortcut cannot process realistic account sizes within an acceptable foreground interaction;
- access repeatedly triggers Instagram security challenges during conservative testing.

---

## 6. Production architecture after Phase 0 passes

### 6.1 Components

```text
CheckFollows Next.js web app
  |
  | POST /api/private-scan/start
  v
Short-lived scan job + scoped token
  |
  | clipboard handoff + open Instagram profile
  v
Safari / instagram.com
  |
  | Share -> CheckFollows Scan
  v
Apple Shortcut
  |
  | Run JS on active Instagram page, one page at a time
  | POST normalized page data to CheckFollows
  v
Private scan staging tables
  |
  | terminal pagination + integrity validation
  v
User-scoped private snapshot
  |
  | diff against user's last valid snapshot
  v
User-scoped private events
  |
  v
/track/[username]?privateScan={jobId}
```

### 6.2 Why page uploads should happen during the Shortcut loop

Do not keep an entire 1,000+ member list only inside Shortcut variables and upload once at the end.

Instead:

1. JS returns one normalized page to Shortcut.
2. Shortcut POSTs that page to CheckFollows.
3. Backend checkpoints it.
4. Shortcut requests the next Instagram page.

Benefits:

- bounded memory on iPhone;
- server knows exactly which page was last received;
- interruption is detectable;
- cursor-chain validation is easier;
- pages can be hashed independently;
- no partial data is accidentally accepted as a snapshot.

---

## 7. Scan job/token design

### Start endpoint

Proposed:

```text
POST /api/private-scan/start
```

Authenticated using the normal CheckFollows/Supabase web session.

Input:

```json
{
  "targetId": "uuid",
  "requestedLists": ["followers", "following"]
}
```

Server verifies:

- user authenticated;
- user owns/subscribes to target;
- target is private;
- user is allowed to scan now;
- no active conflicting job for this user/target;
- requested list types are valid.

Response:

```json
{
  "jobId": "uuid",
  "scanToken": "short-lived-job-token",
  "targetUsername": "sarah",
  "targetInstagramId": "123...",
  "expiresAt": "...",
  "instagramUrl": "https://www.instagram.com/sarah/"
}
```

The web button writes `scanToken`/job envelope to the clipboard on the same user gesture, then opens Instagram.

### Token properties

The token is not a general CheckFollows session token.

It must be scoped to:

- one user;
- one job;
- one target;
- permitted list types;
- short expiration;
- private-scan API only.

The token can be reused for page uploads during that single job, then becomes invalid when the job completes/fails/expires.

Never embed Supabase service-role credentials or a reusable user auth session in the Shortcut.

---

## 8. Bootstrap handshake before pagination

When Shortcut starts, do not immediately fetch hundreds of members.

First Run JavaScript on Webpage should return a small bootstrap record:

```json
{
  "hostname": "www.instagram.com",
  "pathUsername": "sarah",
  "targetInstagramId": "123...",
  "viewerInstagramId": "456...",
  "viewerUsername": "viewer",
  "targetAccess": "visible"
}
```

No cookies.

Shortcut POSTs bootstrap to:

```text
POST /api/private-scan/bootstrap
```

Backend verifies:

- token valid;
- active page is Instagram;
- target username/ID matches the job;
- viewer identity exists;
- current user has not exceeded private-scan safety limits;
- job is still open.

Only then return permission to paginate.

This also gives CheckFollows a non-secret viewer identity that can be used for safety throttling without ever holding the viewer's Instagram credential.

---

## 9. Page-upload contract

Proposed endpoint:

```text
POST /api/private-scan/page
```

Payload:

```json
{
  "jobId": "uuid",
  "listType": "followers",
  "pageIndex": 0,
  "requestCursor": null,
  "nextCursor": "opaque-or-null",
  "terminal": false,
  "members": [
    {
      "instagramId": "123",
      "username": "example",
      "fullName": "Example",
      "isVerified": false,
      "avatarUrl": "https://..."
    }
  ],
  "responseEvidence": {
    "rawCount": 50,
    "sourceStatus": 200,
    "schemaVersion": "ios-shortcut-v1"
  }
}
```

Server should hash opaque cursor values rather than persist them indefinitely unless raw storage is required for debugging. Instagram credentials must never be accepted in this payload.

### Reject payload immediately if it contains suspicious credential material

Explicitly reject/log-safe any payload key/value shaped like:

- `sessionid`
- `cookie`
- `authorization` from Instagram
- login password
- 2FA code

Do not store the rejected secret in logs.

---

## 10. Completeness: how we know no profile page was left behind

A successful HTTP response is not enough.

A list is **COMPLETE** only when all required invariants pass.

### Required invariants

1. **Terminal pagination observed**
   - final Instagram response explicitly has no next cursor / current terminal state.

2. **No missing page in cursor chain**
   - page N+1 request cursor must equal page N returned next cursor.

3. **No repeated cursor**
   - same non-terminal cursor cannot appear twice.

4. **No repeated page response**
   - hash normalized page membership and response structure.
   - repeated non-terminal pages invalidate the scan unless current endpoint semantics explicitly justify them.

5. **Canonical IDs**
   - every member must have a numeric Instagram user ID.
   - username is metadata, not identity.

6. **Deduplication evidence**
   - store raw member count and unique ID count.
   - unexplained duplicate patterns can invalidate the scan.

7. **Stable target identity**
   - target Instagram ID must remain the same from bootstrap through finalization.

8. **Stable viewer identity**
   - viewer ID observed at start/end should match where technically available.

9. **No rate-limit/challenge/login error**
   - any such response fails the scan closed.

10. **No unresolved timeout/network gap**
    - interruption means FAILED/INCOMPLETE, never COMPLETE.

11. **Count checks are evidence, not proof**
    - record profile follower/following counts before and after if available.
    - count parity must never substitute for terminal pagination because membership can differ while total count remains identical.

12. **Set hash**
    - compute a canonical SHA-256 hash of sorted numeric IDs for each completed list.

### Completion manifest

For every accepted list create a manifest containing:

```text
job_id
target_id
owner_user_id
viewer_instagram_id
list_type
pages_received
raw_members
unique_members
first_page_at
terminal_page_at
terminal_seen
cursor_chain_hash
set_hash
pre_profile_count
post_profile_count
adapter_version
shortcut_version
validation_version
status
```

Only after this manifest says COMPLETE may membership be promoted out of staging.

---

## 11. Race conditions while the target changes during a scan

A target can gain/lose followers while pagination is running.

Phase 0 must experimentally determine how Instagram's current cursor behaves under mutation.

Production safeguards:

- record target counts before/after;
- record first-page hash at start;
- optionally re-fetch the first page at end and compare stability metadata;
- mark obviously unstable traversals as `UNSTABLE`;
- never publish large/suspicious diffs without confirmation;
- maintain candidate vs. confirmed event semantics.

For accuracy-sensitive user-facing events, prefer:

```text
complete scan -> candidate diff
next trustworthy confirmation -> confirmed event
```

If product needs immediate display, the UI may display **Changes found** from a complete scan while reserving alerting/irreversible event confirmation for the validation policy.

Do not increase Instagram request volume by automatically double-scanning every list until rate/challenge behavior is measured.

---

## 12. Instagram safety / rate-limit behavior

We cannot guarantee Instagram will never throttle or challenge a user because the membership endpoints are undocumented/private implementation details.

The system can minimize risk and fail safely.

### Rules

- user-triggered scans only;
- conservative scan cadence;
- one page request at a time;
- do not parallelize Instagram membership pagination;
- no aggressive retry loop;
- no session/cookie manipulation;
- no proxying Instagram requests through CheckFollows;
- stop immediately on rate-limit, challenge, checkpoint, login-required, 401/403, malformed response, or unexpected redirect;
- backend can enforce a cooldown before issuing another private-scan job;
- do not silently restart a failed traversal from the middle.

Recommended initial product cadence: private scans no more frequently than the existing monitoring cadence unless testing demonstrates a safer policy.

### User-facing failure copy principle

Do not say a partial scan succeeded.

Use outcomes such as:

```text
Instagram asked us to stop this scan. Nothing was changed in your history.
Try again later.
```

or

```text
We couldn't prove the full list was loaded, so we discarded this scan.
```

---

## 13. Database design

### Critical rule: private local scans must be user-scoped

The current global tracking model is target-centric. A client-side Shortcut is user-controlled and can be modified by the user.

Therefore **do not publish Shortcut-submitted private membership into a global snapshot that another subscriber consumes.**

A malicious or modified Shortcut must never be able to poison another user's timeline.

### Recommended MVP: separate private-scan tables

Create tables similar to:

#### `private_scan_jobs`

```text
id uuid pk
user_id uuid not null
target_id uuid not null
status text
requested_lists text[]
viewer_instagram_id text
shortcut_version text
adapter_version text
started_at timestamptz
completed_at timestamptz
expires_at timestamptz
error_code text
error_detail_safe text
created_at timestamptz
```

#### `private_scan_pages`

```text
id uuid pk
job_id uuid not null
user_id uuid not null
target_id uuid not null
list_type text
page_index integer
request_cursor_hash text
next_cursor_hash text
terminal boolean
raw_count integer
unique_count integer
page_hash text
members jsonb or normalized staging relation
received_at timestamptz
unique(job_id, list_type, page_index)
```

#### `private_follow_snapshots`

```text
id uuid pk
user_id uuid not null
target_id uuid not null
job_id uuid not null
snapshot_type text
account_ids text[]
account_usernames text[]
set_hash text
manifest jsonb
captured_at timestamptz
```

#### `private_follow_events`

```text
id uuid pk
user_id uuid not null
target_id uuid not null
event_type text
instagram_id text
username text
full_name text
avatar_url text
is_verified boolean
confirmed boolean
previous_snapshot_id uuid
current_snapshot_id uuid
detected_at timestamptz
```

### RLS

Private-scan tables must never have anonymous/global read policies.

Policy principle:

```text
user can select only rows where user_id = auth.uid()
all write/finalization operations happen through trusted server routes/service role
```

The web client must not be able to directly insert a completed snapshot.

### Cleanup

- failed/expired page staging data: short retention;
- accepted snapshots/events: product retention policy;
- opaque raw response bodies: avoid unless needed for a temporary controlled debugging environment;
- never retain Instagram cookies/auth headers.

---

## 14. Backend module/file plan

Suggested implementation locations:

```text
src/app/api/private-scan/start/route.ts
src/app/api/private-scan/bootstrap/route.ts
src/app/api/private-scan/page/route.ts
src/app/api/private-scan/finalize-list/route.ts
src/app/api/private-scan/finalize/route.ts
src/app/api/private-scan/[jobId]/route.ts

src/lib/private-scan/contracts.ts
src/lib/private-scan/token.ts
src/lib/private-scan/validator.ts
src/lib/private-scan/page-store.ts
src/lib/private-scan/finalize.ts
src/lib/private-scan/diff.ts
src/lib/private-scan/rate-policy.ts
src/lib/private-scan/errors.ts

src/__tests__/private-scan/

supabase/migrations/<timestamp>_add_private_mobile_scans.sql

shortcuts/README.md
shortcuts/ios/checkfollows-scan-source.md
shortcuts/ios/CHANGELOG.md
```

The Shortcut itself may be distributed through an Apple/iCloud Shortcut share link, but its logic and versioned source/recipe must be documented in the repository.

---

## 15. Shortcut orchestration

### Inputs

Shortcut receives:

- active Safari webpage;
- scan job envelope from clipboard.

### High-level actions

```text
1. Get Shortcut Input (Safari webpage)
2. Get Clipboard
3. Validate CheckFollows job envelope
4. Run JS: bootstrap Instagram page
5. POST bootstrap to CheckFollows
6. If denied -> show safe error -> stop

7. For list in requestedLists:
     cursor = null
     pageIndex = 0

     Repeat:
       Run JS on SAME Safari webpage:
         fetch one Instagram page
         return normalized page + next cursor + classification

       If Instagram classification != success:
         POST failure state
         show safe error
         stop

       POST page to CheckFollows

       If server rejects integrity:
         stop

       If terminal:
         POST finalize-list
         break

       cursor = nextCursor
       pageIndex += 1

8. POST finalize job
9. Receive resultsUrl
10. Open resultsUrl in Safari
```

### Important Apple implementation detail

If multiple Run JavaScript on Webpage actions are used, every action must receive the original Safari webpage input, not the JSON output of the prior JS action.

Store the Safari webpage in a Shortcut variable at the beginning and feed that variable into every Run JavaScript action.

### JavaScript action design

Each JS action must call `completion(result)` quickly.

Do not sleep for long periods inside injected JavaScript. If pacing is required, use Shortcut-level orchestration between bounded requests rather than a long-running JavaScript function.

---

## 16. Instagram adapter versioning

Instagram web request shapes can change.

Treat the mobile scan implementation as a versioned adapter.

Every upload should include:

```text
shortcut_version
adapter_version
schema_version
```

When Instagram changes:

- disable affected adapter version server-side if data integrity is uncertain;
- do not accept unknown/old payload schemas indefinitely;
- prompt user to update Shortcut when a runner change is required;
- keep a canary iPhone/account for controlled verification after changes.

### Later optimization: signed request recipe

After the hard-coded MVP works, investigate a constrained signed adapter manifest delivered by CheckFollows so endpoint/query details can be updated without reinstalling the Shortcut.

Do not start with arbitrary remote `eval()` inside Instagram. If this is built later, the runner should accept only a narrow allowlisted request recipe for `instagram.com`, with a fixed parser/normalizer contract.

---

## 17. Integration with current `/track/[username]` product

Current server tracking rejects private targets. The private path should become a distinct mode rather than turning global background monitoring on for a private target.

### Target page states

Public target:

```text
Automatic monitoring
last scan
next scan
events
```

Private target:

```text
Private scan
last successful personal scan
recommended next scan
[Scan now]
private events
```

Do not display `monitoring_enabled = true` in a way that implies an autonomous private scan will happen later.

### After scan

Results page should show:

```text
Scan complete
1,037 followers checked
811 following checked

Since your last complete scan:
+3 followers
-2 followers
+1 following
-1 following
```

If no previous complete snapshot exists:

```text
Baseline saved
1,037 followers
811 following
We'll show changes after your next scan.
```

If scan fails completeness:

```text
Scan not saved
We couldn't verify the complete Instagram list, so your previous history is unchanged.
```

---

## 18. Reminders instead of autonomous private monitoring

Because private scans are user-triggered, the existing scheduled monitor must not try to run them.

Instead, optional reminder logic can say:

```text
It's time to update @sarah
Scan takes one quick Safari action.
```

The email/web link lands on the target page, where **Scan now** creates a fresh job and opens Instagram.

A reminder is not a scan and must not update `last_scanned_at`.

---

## 19. Mixpanel plan

CheckFollows uses Mixpanel only. Add private scan events without usernames/member data in analytics properties.

Suggested events:

```text
private_scan_setup_viewed
private_scan_setup_confirmed
private_scan_started
private_scan_instagram_handoff_started
private_scan_bootstrap_succeeded
private_scan_bootstrap_failed
private_scan_completed
private_scan_failed
private_scan_results_viewed
private_scan_reminder_clicked
```

Safe properties:

```text
platform: ios
browser: safari
requested_lists
shortcut_version
adapter_version
failure_category
pages_scanned
member_count_bucket
has_previous_snapshot
```

Do not send follower usernames, target full name, viewer username, email, Instagram cookie data, or raw cursors to Mixpanel.

Avoid per-page Mixpanel events; page-level operational telemetry belongs in server logs/database, not product analytics.

---

## 20. Failure taxonomy

Normalize errors so UI, telemetry, and validation agree.

Suggested codes:

```text
NOT_INSTAGRAM_PAGE
TARGET_MISMATCH
CHECKFOLLOWS_JOB_EXPIRED
CHECKFOLLOWS_JOB_ALREADY_FINALIZED
INSTAGRAM_LOGIN_REQUIRED
INSTAGRAM_PRIVATE_ACCESS_DENIED
INSTAGRAM_RATE_LIMITED
INSTAGRAM_CHALLENGE
INSTAGRAM_FORBIDDEN
INSTAGRAM_RESPONSE_MALFORMED
INSTAGRAM_SCHEMA_CHANGED
JAVASCRIPT_TIMEOUT
NETWORK_INTERRUPTED
CURSOR_MISSING
CURSOR_REPEATED
PAGE_REPEATED
PAGE_INDEX_GAP
TARGET_CHANGED
VIEWER_CHANGED
COUNT_ANOMALY
UNSTABLE_TRAVERSAL
PAYLOAD_REJECTED
SERVER_VALIDATION_FAILED
```

Every non-success state must preserve the user's last known-good private snapshot.

---

## 21. Testing matrix

### Functional

- [ ] followed private account / followers
- [ ] followed private account / following
- [ ] both lists in one Shortcut invocation
- [ ] private account not followed
- [ ] public account through private scanner
- [ ] logged-out Safari
- [ ] target username rename
- [ ] target deleted/disabled

### Scale

- [ ] <50 members
- [ ] ~500 members
- [ ] 1,000+ members
- [ ] largest account size product intends to support

### Pagination integrity

- [ ] terminal cursor normal path
- [ ] repeated cursor
- [ ] repeated page
- [ ] empty page with non-terminal cursor
- [ ] duplicate members across adjacent pages
- [ ] malformed next cursor
- [ ] page upload arrives twice
- [ ] page upload skipped
- [ ] pages uploaded out of order

### Interruption

- [ ] user closes Safari mid-scan
- [ ] user dismisses Shortcut
- [ ] phone locks
- [ ] network drops
- [ ] CheckFollows page upload fails
- [ ] JS timeout
- [ ] token expires mid-scan

### Instagram safety

- [ ] 429 / slow-down response
- [ ] 403
- [ ] challenge/checkpoint
- [ ] login expires
- [ ] access revoked while scanning

### Accuracy

- [ ] no-change repeat scan -> zero events
- [ ] one real add -> exactly one candidate/event according to confirmation policy
- [ ] one real removal -> exactly one
- [ ] username rename with same numeric ID -> zero follow/unfollow events
- [ ] same total count but different membership -> correct diff
- [ ] interrupted partial scan -> zero user-facing events
- [ ] repeated-cursor partial scan -> zero user-facing events
- [ ] target changes during traversal -> validate mutation policy

### Security / tenancy

- [ ] user A cannot read user B private snapshot
- [ ] user A cannot upload to user B job
- [ ] modified Shortcut cannot poison another subscriber's timeline
- [ ] expired scan token cannot upload
- [ ] token for target A cannot upload target B
- [ ] payload containing credential-like fields is rejected without secret logging
- [ ] service-role credentials never appear client-side

---

## 22. Rollout plan

### Stage A: developer spike

One engineer, controlled accounts, no production users.

Goal: prove authenticated private pagination on iPhone Safari.

### Stage B: internal end-to-end

Build job token + page upload + staging + finalization + test results page.

Do not wire into paid production timeline yet.

### Stage C: small private beta

Enable for a tiny allowlist of iPhone/Safari users.

Observe:

- completion rate;
- pages per scan;
- median scan duration;
- Instagram rate-limit/challenge rate;
- JS timeout rate;
- failed completeness rate;
- repeat-scan exact-set stability.

### Stage D: paid private-account support

Only after stability meets acceptance criteria.

Keep Android disabled or clearly unsupported until a separate Android runner is proven.

---

## 23. Initial acceptance criteria

MVP is ready only when:

- [ ] No CheckFollows native app is required.
- [ ] No browser extension is required.
- [ ] No password or cookie export is required.
- [ ] User initiates a private scan from iPhone Safari.
- [ ] User does not manually scroll follower/following lists.
- [ ] A realistic 1,000+ list can complete or fail safely.
- [ ] Every accepted list has terminal-pagination evidence.
- [ ] Partial/ambiguous scans produce zero events and never replace last-known-good state.
- [ ] Numeric Instagram IDs are canonical identity.
- [ ] Private snapshots are user-scoped and cannot affect another subscriber.
- [ ] Instagram 429/challenge/login failures stop immediately rather than retry aggressively.
- [ ] Shortcut finishes by returning the user to a CheckFollows results page.
- [ ] Baseline scan and later diff both work on a real iPhone.
- [ ] Current adapter behavior is backed by observed fixtures, not guessed endpoint behavior.

---

## 24. Engineering execution order

Do the work in this order. Do not skip ahead.

### Task 0 — Feasibility

Owner: one engineer

Deliverables:

- developer Shortcut;
- documented current Instagram request shape;
- one-page private follower proof;
- full-pagination proof;
- 1,000+ test;
- failure classifications;
- written PASS/FAIL decision.

### Task 1 — Data model and job security

Deliverables:

- Supabase migration;
- RLS;
- job token signer/verifier;
- start/bootstrap routes;
- cross-user security tests.

### Task 2 — Page staging and validator

Deliverables:

- page-upload route;
- page/cursor hashes;
- cursor-chain validation;
- terminal-state validation;
- failure taxonomy;
- last-known-good preservation.

### Task 3 — Snapshot + diff

Deliverables:

- private snapshot finalization;
- set hashing;
- baseline semantics;
- candidate/confirmation policy;
- private events;
- regression/fault tests.

### Task 4 — Production Shortcut

Deliverables:

- versioned Shortcut logic;
- scan token handoff;
- bootstrap;
- pagination loop;
- per-page upload;
- error UI;
- final results navigation.

### Task 5 — Product UI

Deliverables:

- private target state on `/track/[username]`;
- one-time Shortcut setup flow;
- Scan now button;
- scan status/result state;
- baseline state;
- failed scan state;
- reminder state.

### Task 6 — Observability + beta

Deliverables:

- operational metrics;
- Mixpanel events;
- adapter-version monitoring;
- canary account procedure;
- beta flag/allowlist;
- incident kill switch for private scans.

---

## 25. Explicitly out of scope for this MVP

Do not spend time on:

- cloud-hosted Instagram login sessions;
- storing user Instagram cookies;
- proxy/session farms for private accounts;
- CheckFollows-owned Instagram accounts following targets;
- native iOS app;
- Safari extension;
- autonomous background private-account scans;
- Android production support before iOS is proven;
- DOM auto-scroll as the primary scanner;
- arbitrary remote JavaScript execution inside Instagram;
- pretending Instagram OAuth exposes these lists.

---

## 26. Kill switch

Private mobile scanning depends on undocumented Instagram web behavior.

Add a server-side feature flag/kill switch:

```text
PRIVATE_MOBILE_SCAN_ENABLED=false
```

and ideally adapter-version allowlisting.

If Instagram changes schema or challenge rate spikes:

1. reject creation of new private scan jobs;
2. preserve all prior user snapshots/events;
3. show a maintenance message;
4. update/test the adapter against controlled accounts;
5. re-enable only after exact-set canaries pass.

---

## 27. Final product principle

The private-account feature is not "CheckFollows logs into Instagram for you."

It is:

> **You already have permission to view this private account in Instagram. When you choose Scan, your iPhone briefly uses that existing Safari session to collect the list you can access, sends only the resulting membership data to CheckFollows, and returns you to your results.**

That distinction should remain true technically, not just in marketing copy.
