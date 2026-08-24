# BUILD_PLAN.md — Production Instagram Followers/Following Apify Actor

## Mission

Build a production-grade private Apify Actor that collects complete Instagram followers/following lists, validates completeness, fails closed on ambiguous or partial scans, stores completion evidence, supports provider adapters, and is architected for an eventual direct authenticated Instagram private/mobile collector.

The system must be suitable for:

1. CheckFollows production use.
2. Repeated exact membership snapshots.
3. Near-zero false follow/unfollow events.
4. Eventual Apify Store publication.
5. Pay-per-event monetization.
6. Commercial provider adapters now.
7. Direct Instagram collection later or during this build if technically feasible.

The implementation must follow the research/specification already provided in this conversation.

---

# Operating rules for all agents

## 1. This file is the source of truth

Every agent must read this file before beginning work.

Whenever an agent:

* starts a task,
* finishes a task,
* discovers a blocker,
* changes an architectural assumption,
* finds a test failure,
* changes a shared interface,

it must update this file.

Do not leave progress only in chat.

---

## 2. Do not invent Instagram behavior

Any Instagram endpoint, cursor behavior, response schema, page size, authentication requirement, or error behavior must be one of:

* confirmed from current source code/documentation,
* observed experimentally,
* or explicitly marked experimental.

Never fabricate endpoints or undocumented fields to make tests pass.

---

## 3. Accuracy beats successful execution

The system must never interpret a partial scan as complete.

Any of these must invalidate a direct scan unless an adapter explicitly proves safe recovery:

* 401
* 403
* 429
* `PleaseWaitFewMinutes`
* malformed response
* unexpected empty page
* repeated cursor
* repeated response/page
* session change
* proxy change
* adapter change
* challenge/checkpoint
* unresolved timeout
* pagination ambiguity

A failed scan must not publish member results as complete.

---

## 4. Canonical identity

Instagram numeric user ID is the canonical member identity.

Usernames are metadata only.

A username rename must not create:

* an unfollow,
* followed by a new follow.

---

## 5. Do not bill partial data

No result billing for:

* duplicates,
* retries,
* errors,
* partial scans,
* manifests,
* diagnostics.

Only validated unique membership results can become billable.

---

# Definition of done

The one-day build is considered successful when:

## Core Actor

* [ ] TypeScript Apify Actor runs locally.
* [ ] Actor runs successfully on Apify.
* [ ] Input schema exists.
* [ ] Dataset/output schema exists.
* [ ] One commercial provider adapter works end-to-end.
* [ ] Provider contract supports additional adapters.
* [ ] Members normalize to numeric IDs.
* [ ] Pagination evidence is recorded.
* [ ] Staging dataset exists.
* [ ] Incomplete scans do not become published snapshots.
* [ ] Completion manifests exist.
* [ ] Set hashes exist.
* [ ] Duplicate detection exists.
* [ ] Cursor-cycle detection exists.
* [ ] Page-repeat detection exists.
* [ ] Pre/post target counts are supported.
* [ ] Explicit completion states exist.
* [ ] Checkpointing exists.
* [ ] Structured logging exists.
* [ ] Unit tests pass.
* [ ] Fault-injection tests pass.

## CheckFollows safety

* [ ] Last-known-good snapshot is preserved.
* [ ] New scans do not automatically overwrite confirmed state.
* [ ] Candidate additions/removals can be generated.
* [ ] Candidate changes can require a second confirmation.
* [ ] A 605 → 609 → 609 → 608 regression fixture generates zero false events.
* [ ] Same-count/different-membership fixtures are rejected.

## Direct collector

At minimum:

* [ ] Direct-collector adapter interface exists.
* [ ] Python worker project exists if using Instagrapi.
* [ ] Session persistence model exists.
* [ ] Proxy/session invariants are defined in code.
* [ ] Private API response normalization exists.

Stretch goal:

* [ ] Successfully retrieve followers/following from a controlled Instagram account using authenticated private/mobile API.
* [ ] Pagination completes through `next_max_id`.
* [ ] Actor produces a validated snapshot through the direct collector.

## Production readiness

* [ ] Dockerfile builds.
* [ ] Dependencies pinned.
* [ ] Environment variables documented.
* [ ] Secrets never logged.
* [ ] README explains failure semantics.
* [ ] Metrics and alerts defined.
* [ ] PPE integration scaffolded.
* [ ] Changelog initialized.
* [ ] CI tests exist.
* [ ] Deployment workflow exists.

---

# Repository ownership rules

Agents must not edit another agent's primary files unless coordinated in this file.

Shared interfaces should be defined early and treated as contracts.

---

# Agent assignments

## Agent A — Architecture / Integrator

### Owns

```text
BUILD_PLAN.md
package.json
tsconfig.json
apps/actor-ts/src/main.ts
apps/actor-ts/src/domain/
apps/actor-ts/src/config.ts
packages/contracts/
```

### Responsibilities

* Bootstrap monorepo.
* Define shared TypeScript contracts.
* Define statuses/errors.
* Integrate all agent branches/work.
* Resolve interface conflicts.
* Run full test suite continuously.
* Update this file after every integration step.

### Deliverables

* Compiling Actor.
* Shared domain model.
* Provider interface.
* Scan interface.
* Final end-to-end execution.

---

## Agent B — Apify Platform

### Owns

```text
.actor/
Dockerfile
.github/workflows/
apps/actor-ts/src/platform/
```

### Responsibilities

Build:

* `actor.json`
* input schema
* output schema
* dataset schema
* Key-Value Store schema
* Docker configuration
* local Apify execution
* Apify deployment workflow
* PPE scaffolding
* spend-limit checks
* Actor output record

Use the official Apify TypeScript SDK.

### Tests

* Invalid input rejected.
* Valid input accepted.
* Actor starts/exits cleanly.
* Schemas validate.
* Docker image builds.
* PPE can be tested without charging.

---

## Agent C — Provider Adapter

### Owns

```text
apps/actor-ts/src/adapters/
tests/provider-benchmark/
```

### Responsibilities

Implement the normalized provider contract.

Start with ONE accessible commercial provider.

Preferred order:

1. RocketAPI
2. EnsembleData
3. another provider only if credentials prevent 1 or 2

Implement:

```typescript
resolveProfile()
createScanContext()
fetchPage()
closeScanContext()
```

Normalize:

* numeric user ID
* username
* full name
* privacy state
* verification state
* cursor
* source timestamp
* cache status
* response hash

### Rules

Provider-specific cursor values must not leak into domain logic.

Errors must map to normalized error classes.

---

## Agent D — Pagination / Validation

### Owns

```text
apps/actor-ts/src/scan/paginator.ts
apps/actor-ts/src/scan/validator.ts
apps/actor-ts/src/scan/response-classifier.ts
apps/actor-ts/src/scan/set-hash.ts
tests/unit/pagination*
tests/fault-injection/
```

### Responsibilities

Implement:

* sequential cursor pagination
* cursor history
* cursor-cycle detection
* response hashes
* page hashes
* duplicate detection
* cross-page overlap detection
* canonical set hashing
* terminal-cursor requirement
* malformed-page handling
* normalized error classification

### Non-negotiable test

A run containing:

```text
page 1 success
page 2 success
page 3 HTTP 429
```

must never return `COMPLETE`.

---

## Agent E — Atomic Storage / Checkpoints

### Owns

```text
apps/actor-ts/src/storage/
apps/actor-ts/src/scan/checkpoint.ts
apps/actor-ts/src/scan/publisher.ts
```

### Responsibilities

Implement:

* named staging dataset
* checkpoints after every page
* scan state record
* manifest persistence
* publication after validation only
* staging-dataset cleanup/quarantine
* OUTPUT pointer
* last-known-good state abstraction

### Invariant

Default/public result must not expose a staging dataset as an accepted complete snapshot.

---

## Agent F — CheckFollows Snapshot Safety

### Owns

```text
apps/actor-ts/src/diff/
tests/fixtures/incident-605-609/
tests/integration/checkfollows*
```

### Responsibilities

Implement:

```text
confirmed snapshot
candidate snapshot
pending membership changes
confirmed membership changes
```

Functions:

```typescript
compareSets()
generateCandidates()
confirmCandidates()
rejectAmbiguousSnapshot()
```

Build fixtures for:

```text
609 baseline
605 partial
609 incorrect membership
609 different incorrect membership
608 partial
```

### Mandatory assertion

The regression sequence must produce:

```text
user-facing false follows = 0
user-facing false unfollows = 0
```

---

## Agent G — Direct Instagram Collector

### Owns

```text
apps/mobile-worker-py/
apps/actor-ts/src/adapters/instagram/
```

### Responsibilities

Research current Instagrapi/aiograpi implementation.

Do not invent endpoints.

Build a minimal authenticated collector supporting:

* persisted Instagram session
* stable device settings
* profile resolution
* followers pagination
* following pagination
* `next_max_id`
* normalized numeric IDs
* login-required classification
* challenge classification
* rate-limit classification

Expose collector through a small private HTTP interface or internal Actor call.

### Session invariants

One scan must maintain:

```text
same Instagram account/session
same device identity
same proxy session
same adapter version
```

If these cannot be maintained, restart the scan.

### Stretch goal

Run successfully against a controlled Instagram test account.

---

## Agent H — Proxy / Session Reliability

### Owns

```text
apps/actor-ts/src/sessions/
apps/mobile-worker-py/app/session_store.py
tests/integration/sessions*
```

### Responsibilities

Implement or specify:

* Apify residential proxy usage
* sticky proxy sessions
* session health scoring
* cooldown
* session quarantine
* rate-limit counters
* circuit breaker
* restart-from-page-one logic

### Required behaviors

403:

```text
invalidate scan
```

429:

```text
invalidate scan
cool down session
```

challenge:

```text
invalidate scan
quarantine session
```

Never:

```text
rotate session → continue old cursor
```

---

## Agent I — Testing / QA

### Owns

```text
tests/
scripts/run-canaries.ts
scripts/verify-dataset.ts
scripts/compare-providers.ts
```

### Responsibilities

Build:

* unit tests
* integration tests
* provider mocks
* pagination fixtures
* fault injection
* regression fixtures
* Jaccard comparison
* symmetric difference
* exact-set comparison
* duplicate tests
* same-count/different-membership tests

Produce:

```text
TEST_REPORT.md
```

with pass/fail state.

Do not loosen validation rules merely to obtain green tests.

---

## Agent J — Observability / Production Ops

### Owns

```text
apps/actor-ts/src/observability/
docs/RUNBOOK.md
docs/METRICS.md
```

### Responsibilities

Implement structured logging for:

```text
scan_id
target_id
list_type
adapter
page
retry
status
raw_count
unique_count
duration
```

Define metrics:

```text
scan completion rate
ambiguous rate
rate-limit rate
403 rate
challenge rate
duplicates
page overlap
exact-set canary failures
cost per 1K
provider disagreement
```

Write incident runbooks.

---

## Agent K — Store / Commercial

### Owns

```text
.actor/README.md
CHANGELOG.md
docs/PRICING.md
docs/PRIVACY.md
docs/ABUSE.md
```

### Responsibilities

Prepare:

* Store README.
* clear completion guarantee language.
* PPE event structure.
* pricing examples.
* billing semantics.
* privacy/data-retention language.
* abuse restrictions.
* support expectations.
* known limitations.

Do not claim:

```text
100% accurate
official Instagram API
never blocked
guaranteed complete
```

---

# Work waves

Parallel work should happen in waves to avoid unnecessary dependency blocking.

---

# Wave 1 — Foundation

Agents:

```text
A
B
C
D
I
```

Complete first:

* repo bootstrap
* shared interfaces
* schemas
* provider contract
* pagination engine
* testing framework

### Exit condition

```bash
npm install
npm run typecheck
npm test
npm run build
```

all work.

---

# Wave 2 — Production semantics

Agents:

```text
E
F
H
J
```

Build:

* staging
* publication
* checkpoints
* CheckFollows confirmation
* session health
* monitoring

### Exit condition

Simulated 429/403/session rotation cannot produce a published complete snapshot.

---

# Wave 3 — Direct Instagram collector

Agents:

```text
G
H
I
```

Build and test authenticated private/mobile adapter.

### Exit condition

At minimum:

* code compiles/runs,
* current endpoint behavior is sourced,
* response fixtures pass,
* session persistence works.

Best case:

* controlled Instagram test succeeds.

---

# Wave 4 — Commercialization

Agents:

```text
B
J
K
A
```

Build:

* PPE
* Store docs
* Docker/deployment
* CI
* production runbook

---

# Continuous integration loop

After each major task:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

If Python worker exists:

```bash
ruff check apps/mobile-worker-py
pytest apps/mobile-worker-py
```

No agent may mark a section DONE while its tests fail.

---

# Progress log

Agents must append updates below.

Use this exact format:

```text
[UTC timestamp]
AGENT:
STATUS: STARTED | BLOCKED | DONE
TASK:
FILES:
TESTS:
NOTES:
NEXT:
```

---

# Current progress

## Architecture

* [ ] Repository initialized
* [ ] TypeScript contracts created
* [ ] Status enum created
* [ ] Normalized error model created

## Apify

* [ ] Actor schema
* [ ] Input schema
* [ ] Output schema
* [ ] Dataset schema
* [ ] Docker build
* [ ] Local Actor run
* [ ] Cloud Actor run

## Provider

* [ ] Provider selected
* [ ] Credentials loaded securely
* [ ] Profile resolution
* [ ] Followers pagination
* [ ] Following pagination
* [ ] Error normalization

## Validation

* [ ] Terminal cursor validation
* [ ] Numeric-ID dedupe
* [ ] Cursor-cycle detection
* [ ] Page-repeat detection
* [ ] Overlap detection
* [ ] Set hash
* [ ] Count validation

## Storage

* [ ] Staging dataset
* [ ] Checkpointing
* [ ] Completion manifest
* [ ] Atomic logical publication
* [ ] Failed-scan cleanup

## CheckFollows

* [ ] Confirmed snapshot
* [ ] Candidate snapshot
* [ ] Candidate diff
* [ ] Confirmation logic
* [ ] 605→609 regression

## Direct collector

* [ ] Python worker
* [ ] Persistent session
* [ ] Stable device identity
* [ ] Proxy integration
* [ ] Followers
* [ ] Following
* [ ] Rate-limit classification
* [ ] Challenge classification

## Testing

* [ ] Unit suite
* [ ] Fault-injection suite
* [ ] Provider comparison
* [ ] Exact-set metrics
* [ ] Regression suite

## Operations

* [ ] Metrics
* [ ] Alerts
* [ ] Canary accounts
* [ ] Runbook
* [ ] Cost tracking

## Commercial

* [ ] PPE events
* [ ] Billing idempotency
* [ ] README
* [ ] Pricing
* [ ] Privacy
* [ ] Abuse policy
* [ ] Store checklist

---

# Priority order if time runs short

Do NOT sacrifice data integrity to finish more features.

The priority order is:

```text
1. strict scan invalidation
2. pagination correctness
3. numeric-ID dedupe
4. staging/publication safety
5. CheckFollows confirmation logic
6. tests
7. commercial provider integration
8. direct private collector
9. metrics
10. Store polish
```

A smaller Actor that refuses uncertain data is better than a feature-complete Actor that silently emits bad snapshots.

---

# Commands expected to exist when complete

```bash
npm install

npm run dev
npm run build
npm run lint
npm run typecheck
npm test
npm run test:faults
npm run test:regression
npm run test:providers

apify actor generate-schema-types
apify actor test
apify actor push
```

Where supported, PPE should be testable using Apify's test charging functionality before enabling real billing.

---

# Final acceptance command

Before declaring the build complete, Agent A must run the entire verification suite and update this file with the final results.

Expected final report:

```text
BUILD STATUS:
COMMIT:
ACTOR BUILD:
PROVIDER:
DIRECT COLLECTOR:
UNIT TESTS:
FAULT TESTS:
REGRESSION TEST:
CONTROLLED INSTAGRAM TEST:
KNOWN BLOCKERS:
READY FOR CHECKFOLLOWS:
READY FOR APIFY STORE:
```

If a direct Instagram test could not be completed because no controlled account/session credentials were available, say so explicitly.

Do not fake success.
