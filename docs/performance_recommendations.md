# NAuth Performance Recommendations

## What was validated in code (not assumptions)

### 1. CRITICAL: Two sequential session reads per authenticated request (NestJS)

**Location:** `packages/nestjs/src/guards/auth.guard.ts`

**Validated behavior:**
`AuthGuard` calls `SessionService.findByIdLight(sessionId)` twice:

- First call: validate revocation/expiry before loading the user
- Second call: re-check version/isRevoked after user load (TOCTOU prevention via optimistic locking)

**Impact:**
This is two sequential DB round-trips on the hot path (plus the user load query). On typical hosted DBs, this can easily explain a large portion of ~60ms overhead.

### 2. CRITICAL: Per-request public key parsing when using asymmetric access tokens (RS*)

**Location:** `packages/core/src/services/jwt.service.ts`

**Validated behavior:**
`JwtService.prepareKeys()` caches the private key / secret, but `validateAccessToken()` calls `crypto.createPublicKey(this.config.accessToken.publicKey)` per request when `publicKey` is configured.

**Impact:**
Public key parsing is synchronous CPU work and can add measurable per-request overhead, especially under concurrency.

### 3. CRITICAL: User context load fetches many large + sensitive columns by default

**Location:** `packages/core/src/services/auth.service.ts` -> `getUserForAuthContext`

**Validated behavior:**
`UserService.getUserForAuthContext()` does `userRepository.findOne({ where: { sub } })` without a `select`.
In the TypeORM user entities, columns like `metadata`, `backupCodes`, `passwordHistory`, and `totpSecret` are selected by default.

**Impact:**
Even if DB latency is acceptable, transferring and deserializing large JSON/array columns on every request is unnecessary and can dominate the overhead at scale.

---

## Recommendations

### Very safe wins (high impact, no security regression)

#### 1. Cache the access-token verification key object (Fixes observation #2)

**Action:**
In `JwtService.prepareKeys()`, parse and store `accessToken.publicKey` as a `crypto.KeyObject` once, and reuse it in `validateAccessToken()`.

**Why this is safe:**
The key material is static process configuration; caching avoids repeated parsing without changing verification semantics.

**Expected gain:**
Small but real CPU savings per request, and less event-loop blocking under load.

#### 2. Stop selecting heavy/sensitive user columns on the hot path (Fixes observation #3)

**Action:**
Make the per-request user context query explicitly select only what the request pipeline needs.

Safe patterns:
- Mark large/sensitive columns as `select: false` in TypeORM entities and explicitly `addSelect` only in flows that truly need them (password checks, MFA operations).
- Or introduce a dedicated method like `getUserForRequestContext()` that uses an explicit `select` list (and keep the existing full-load method for admin/debug use cases).

Columns that are typically safe to exclude from the per-request context:
- `metadata` (potentially large JSON)
- `passwordHistory`, `backupCodes` (arrays / JSON)
- `totpSecret` (sensitive + unnecessary for most API calls)
- `passwordHash` (only needed in login / password verification, not in request auth context)

**Why this is safe:**
It does not weaken authentication; it reduces data transfer and deserialization while preserving the same access control decisions.

#### 3. Reduce DB round-trips by fetching session + user in one query (Fixes observation #1 without weakening TOCTOU protection)

**Action:**
Instead of:
1) session check (DB) -> 2) user load (DB) -> 3) session re-check (DB),
fetch session light + user context together (single DB round-trip) keyed by the verified `sessionId`.

Implementation shape (TypeORM):
- Query by `session.id = :sessionId`
- Join `session.user`
- Select minimal session fields + minimal user fields
- Validate `session.isRevoked / expiresAt`
- Attach `request.user`, `request.token`

**Why this is safe:**
It preserves the intent of “no session change during user load” because the user data is read in the same DB snapshot/round-trip as the session data (removing the TOCTOU window rather than ignoring it).

### Still safe, but environment/config dependent

#### 4. Treat IP geolocation enrichment as optional hot-path work

**Location:** `packages/core/src/handlers/client-info.handler.ts`, `packages/core/src/services/geo-location.service.ts`, `packages/nestjs/src/guards/nauth-context.guard.ts`

Notes:
- Express adapter middleware awaits client-info extraction; NestJS context guard currently does not await it.
- If MaxMind readers are not loaded, per-request warning logs can become a hidden latency source.

**Action:**
If you do not use geolocation in authorization decisions, consider:
- Disabling geo enrichment for general API traffic, or
- Performing geo lookup only on auth events (login, refresh, sensitive actions), not on every request.

**Why this is safe:**
Geolocation is auxiliary metadata; moving it off the hot path does not weaken token/session validation.

### Options with explicit security/consistency tradeoffs (not “very safe”)

#### A. Removing the second session check in `AuthGuard`
This reduces one DB round-trip but weakens the explicit TOCTOU protection. Only consider if you can accept that tradeoff.

#### B. Cache session validation results (Redis / in-memory)
This can eliminate many DB reads, but introduces revocation/expiry propagation delay unless invalidation is perfect and immediate.

#### C. Stateless access tokens (no session DB check on each request)
Fastest, but you give up immediate revocation. Only appropriate with short-lived access tokens and a revocation model that matches your threat profile.

---

## Likely sources of the ~60ms overhead in today’s flow

- **3 sequential DB reads** on most authenticated requests:
  - session light read (required)
  - user load (can be made lighter)
  - session revalidation (can be eliminated by combining session+user read)
- **Per-request key parsing** when using `accessToken.publicKey` (RS*) instead of a cached `KeyObject`
