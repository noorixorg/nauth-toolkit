# Changelog

All notable changes to nauth-toolkit will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.6.0] - 2026-09-06

### Added

- **Trusted device management** — users can list the devices that skip MFA on their account and revoke them individually or all at once; administrators can do the same for any user. Previously a device could be trusted but never reviewed or untrusted. See [the guide](https://nauth.dev/docs/features/mfa).
- **The frontend SDK now covers every shipped route.** Around eighteen methods were missing, so integrators were hand-building `fetch` calls against endpoints the backend already served — session listing and single-session sign-out, setting a first password on a social-only account, listing permitted MFA methods, admin user lookup by email, attribute and verified-status updates, single-session revocation, audit queries, and administrative API keys.
- **Backup code generation is reachable over HTTP.** `client.generateBackupCodes()` shipped in the SDK but no route served it, so it returned `404`. Requires `mfa.backup.enabled`.
- **`setupMfaDevice()` accepts enrolment data.** Pass `{ phoneNumber }` or `{ emailAddress }` to enrol a destination the account does not already hold; without it the server answers `PHONE_REQUIRED`. Previously there was no way to add a first phone number through the SDK.

### Security

- **Three self-service operations no longer accept a caller-supplied user id.** `canSetPassword` had no ownership check, so any authenticated user could learn whether an arbitrary account was passwordless. All three now act on the authenticated caller.

### Fixed

- **Session lists no longer include expired sessions.** Nothing prunes expired rows, so a "signed-in devices" screen grew without bound and offered dead sessions to sign out of. Affects both the user's own list and the administrative one.
- **Dependency security updates** — `handlebars` (critical), `axios` and the AWS SDK's XML parser, across the email, SMS and social packages.

### Breaking Changes

Only direct consumers of the core services and DTOs are affected; the mounted routes and the client SDK are unchanged.

- `MFAService.getAvailableMethods(dto)` → `getAvailableMethods()`
- `SocialAuthService.canSetPassword(dto)` → `canSetPassword()`
- `SetPasswordForSocialUserDTO` no longer has `sub` — send only `password`
- `CanSetPasswordDTO` and `GetAvailableMethodsDTO` are removed; both held only `sub`, which is now taken from the authenticated context

## [0.5.0] - 2026-09-04

### Added

- **Mountable auth routes** — every auth endpoint now ships as a route bundle you mount instead of hand-writing controllers. One manifest serves NestJS, Express and Fastify; mount it twice to serve cookies to the web and JSON to mobile from one backend. `exclude` drops individual routes so you write only the ones you customise. This also reaches fifteen endpoints that previously existed as services with no route anywhere. See [the guide](https://nauth.dev/docs/guides/routes).
- **Authorization provider** — administrative operations now delegate to an `IAuthorizationProvider` you supply, enforced inside the services so one policy covers shipped routes, your own controllers and scripts alike. Denials are audited. Without a provider, behaviour is unchanged and the admin route group refuses to mount. See [the guide](https://nauth.dev/docs/concepts/authorization).
- **`runAsSystem()`** — wraps trusted work with no authenticated caller (seeds, migrations, scheduled jobs) so it bypasses the authorization provider explicitly rather than by accident.
- **OpenID Connect mounts itself** — `OIDCProviderModule` attaches the provider during module initialisation, so `main.ts` needs no OpenID Connect code. The mount selects its attach mechanism from the running HTTP driver, so the Fastify driver is supported alongside Express.

### Security

- **Do not derive authority from `user.metadata`.** That column is caller-writable through `POST /auth/signup` and `PUT /auth/profile`, so a user could grant themselves any role stored there. Authorization providers must read authority from a store the user cannot write. This is documented on the [authorization guide](https://nauth.dev/docs/concepts/authorization) and the shipped examples follow it.

### Changed

- Two route bundles requesting different token deliveries now fail at startup with a message naming the offending bundle, rather than on the first request.

## [0.4.0] - 2026-09-04

### Added

- **OpenID Connect provider** — a new optional package, `@nauth-toolkit/oidc-provider`, that turns your application into an OAuth 2.0 authorization server so other apps can offer "Sign in with your app". Your existing login runs unchanged inside the flow, challenges and MFA included. NestJS gets the interaction routes registered for you; every artifact lives in your existing storage adapter, so there are no new tables and no migrations. See [the guide](https://nauth.dev/docs/guides/oauth-provider/how-oauth-provider-works).
- **Frontend SDK support for the consent screen** — `client.oidc` (and `auth.oidc` in Angular) drives the interaction routes, remembers a pending request across the login detour, and ships an optional `oidcReturnGuard()` for apps whose own components handle navigation.
- **Audit trail for third-party sign-in** — `OIDC_LOGIN_COMPLETED`, `OIDC_CONSENT_GRANTED`, `OIDC_CONSENT_DENIED` and `OIDC_ACCESS_DENIED` record which application a user was signed into, with the requested and granted scopes. The ordinary `LOGIN_SUCCESS` cannot carry this, because the authorization request is still parked when the user signs in.
- Error codes `OIDC_INTERACTION_NOT_FOUND` (404), `OIDC_LOGIN_REQUIRED` (401) and `OIDC_ACCESS_DENIED` (403).
- **`migrations.autoRun`** (default `true`) — set it to `false` to apply migrations from a release task instead of on boot.

### Changed

- **Node.js 22 and 24 are both verified.** The declared `engines` floor stays `>=22.0.0`; CI now builds, lints and tests on both, so the floor is exercised rather than assumed.

### Fixed

- **Parallel instances no longer race on startup migrations.** Instances that boot together (ECS tasks, Kubernetes pods) each saw an empty migrations table and ran the same DDL. Migrations are now serialized behind a database-level lock — a Postgres advisory lock or a MySQL named lock — released automatically if an instance dies. Always on, nothing to configure. This mattered most on MySQL, which commits implicitly on DDL, so concurrent runs could half-apply a migration with no rollback.
- **Geolocation no longer goes missing on the instances that lose the MaxMind download race.** Previously every instance but one skipped the download and came up with no readers loaded, leaving them without geolocation until restart. Instances now wait their turn and load the database, reusing `.mmdb` files under 24 hours old.
- **Redis storage: `keys()` no longer throws.** The adapter called `SCAN` with ioredis's argument style, which node-redis v5 rejects outright, so every prefix scan failed. Affects any deployment on `@nauth-toolkit/storage-redis` with node-redis v5.

## [0.3.3] - 2026-07-05

### Fixed

- **API keys on public routes now identify the caller** — a valid key on a `@Public()` route attaches the owning user (so `@CurrentUser()` works), matching JWT optional-auth. A missing/invalid key is tolerated; protected routes stay strict (invalid key ⇒ denied, no fallback).

## [0.3.2] - 2026-07-03

### Changed

- **API keys — corrected the public API** (feature introduced in 0.3.1). Self-service `ApiKeyService` methods now resolve the acting user from the auth context instead of taking a user id, and every method takes a request DTO and returns a response DTO (validated at runtime). Admin key management now lives on `ApiKeyService` as `adminCreateKey` / `adminListKeys` / `adminUpdateKey` / `adminRevokeKey` / `adminDeleteKey` (keyed by `sub`); the `AdminAuthService` API-key wrappers were removed. Generated keys are now a plain server-generated secret — the `nauth_` prefix / embedded lookup id and the `apiKeys.keyPrefix` option were removed.

### Migration

- Self-service calls: drop the `userId` argument — identity comes from the session (e.g. `apiKeys.createKey(dto)`).
- Admin calls: use `apiKeys.adminCreateKey({ sub, … })` (and siblings) instead of `adminAuthService.createApiKeyForUser(…)`.
- Remove `apiKeys.keyPrefix` from config. The `nauth_api_keys` schema change (drop `lookupId`, unique index on `keyHash`) ships as an automatic follow-up migration — no manual step, whether you're upgrading from 0.3.1 or installing fresh.

## [0.3.1] - 2026-07-03

### Added

- **API key authentication** — long-lived keys that authenticate as their owning user, for scripts and machine-to-machine calls. Off by default; enable via the new `apiKeys` config. Adds `ApiKeyService`, admin key management on `AdminAuthService`, `@AllowApiKey()`/`@DenyApiKey()` route decorators (with `allowApiKey()`/`denyApiKey()` helpers for Express/Fastify), configurable auth header, per-key IP allowlists, mandatory config-bounded expiry, usage tracking, `API_KEY_*` error codes and audit events, and `client.apiKeys.*` in the frontend SDK. A `nauth_api_keys` table is added and migrated automatically on startup. [Guide](https://nauth.dev/docs/guides/api-keys)

### Security

- When the API-key header is present it is the only credential used — cookies/bearer are ignored, and an invalid/expired/revoked/IP-blocked key is denied with no fallback. Keys are stored hashed; the plaintext is returned only once at creation.

## [0.3.0] - 2026-06-11

### Added

- **Anonymous usage telemetry (opt-out)** — nauth-toolkit now sends a small anonymous payload at boot and once per day describing the *shape* of your configuration: token delivery mode, MFA enforcement/methods, registered provider names, package version, Node version, and framework. No PII, IP addresses, secrets, domains, or configuration values are ever collected; telemetry never runs inside a request path and adds zero startup latency. A one-time console notice is shown on first boot. **Opt out** with `NAUTH_TELEMETRY_DISABLED=1`, `DO_NOT_TRACK=1`, or `telemetry: { enabled: false }`; always disabled in CI and tests. Full payload documentation: https://nauth.dev/docs/concepts/telemetry
- **`telemetry` config section** — `{ enabled?: boolean; endpoint?: string }` on `NAuthConfig`
- **`telemetryService` on `NAuthInstance`** — exposes `shutdown()` to stop the heartbeat timer (NestJS apps stop it automatically on application shutdown)

### Changed

- **Node 24 is now the recommended runtime** — CI and the example Docker images run Node 24. Node >= 22 remains the supported minimum; no action required for existing Node 22 deployments

## [0.2.7] - 2026-06-11

### Changed

- **All packages are now MIT licensed** — nauth-toolkit is open source. Every `@nauth-toolkit/*` package ships with the MIT license (previously `SEE LICENSE` with a custom license file). The source code is public at [github.com/noorixorg/nauth-toolkit](https://github.com/noorixorg/nauth-toolkit), including all example apps
- **Package READMEs link to the MIT license** — replaced the previous license link (which pointed to a page that no longer exists) with a direct link to the LICENSE file on GitHub

### Added

- **README for `@nauth-toolkit/sms-twilio`** — the npm page now documents installation and configuration for both `fromNumber` and `messagingServiceSid` setups

### Fixed

- **`@nauth-toolkit/sms-twilio` tarball slimmed down** — the package now publishes only `dist`, `LICENSE`, and `README.md` instead of the full source tree

## [0.2.6] - 2026-05-08

### Fixed

- **Social signup preserves empty-string name fields from the provider** — when a social provider returns an empty first or last name, the saved user now stores an empty string instead of treating it as missing. Applies to Google, Facebook, and Apple, on both the web (OAuth callback) and native (mobile ID-token) flows. Behavior is unchanged when the provider omits the field entirely or returns it as null — those continue to write a missing value. Pre-signup and post-signup hooks see the same preserved value

## [0.2.5] - 2026-04-17

### Added

- **Per-delivery refresh token TTL in hybrid mode** — new `hybridPolicy.cookieRefreshExpiresIn` and `hybridPolicy.jsonRefreshExpiresIn` config fields let you issue different refresh token lifetimes for cookie-delivered (web) vs JSON-delivered (mobile, workers) clients. Typical pairing: short cookie TTL (e.g. `7d`) for browsers, long JSON TTL (e.g. `90d`) for mobile. The resolved TTL drives both the refresh JWT's `exp` claim and the refresh cookie's `Max-Age`, and flows through login, refresh, and MFA/social challenge completion. Both fields are optional — unset falls back to `jwt.refreshToken.expiresIn`. Fields are only consulted when `tokenDelivery.method === 'hybrid'`
- **`JwtService` TTL override params** — `generateRefreshToken`, `generateTokenPair`, and `getRefreshTokenTTL` now accept an optional per-call TTL override. Default behavior unchanged when omitted
- **`resolveRefreshExpiresIn` utility** (`@nauth-toolkit/core`) — framework-agnostic resolver that mirrors the delivery-mode precedence used by `TokenDeliveryHandler`: route-level override (`@TokenDelivery()` decorator or `nauth.helpers.tokenDelivery()` middleware) wins, origin-based classification via `webOrigins`/`nativeOrigins` as fallback
- **E2E coverage** — new `tests/e2e/specs/hybrid-refresh-ttl.spec.ts` validates the feature end-to-end for both delivery modes: asserts the issued TTL matches config, refresh inside the window succeeds, refresh after expiry returns 401

### Fixed

- **Reuse-detection storage TTL alignment** — when a hybrid-policy TTL override is applied, the Redis used-token entry TTL (via `markRefreshTokenAsUsed`) now matches the issued JWT's lifetime instead of the global `refreshToken.expiresIn`, closing a window where the storage entry could outlive the token

## [0.2.4] - 2026-04-10

### Added

- **Twilio SMS provider** (`@nauth-toolkit/sms-twilio`) — new first-party SMS provider using the Twilio Programmable Messaging API. Supports direct phone numbers and Messaging Services. Full template engine and global variables support, matching the same pattern as the AWS SNS provider

## [0.2.3] - 2026-03-09

### Changed

- **Lazy reCAPTCHA script loading by default** — `RecaptchaService` no longer preloads the Google reCAPTCHA script at startup. The script is loaded on first `execute()` call, avoiding unnecessary network requests on pages that don't need reCAPTCHA. Set `autoLoadScript: true` to restore eager preloading
- **Removed `APP_INITIALIZER` for reCAPTCHA** — the NgModule no longer force-instantiates `RecaptchaService` at app bootstrap; it initializes naturally when injected

### Fixed

- **reCAPTCHA first-login failure** — `injectScript()` now waits for `grecaptcha.ready()` / `grecaptcha.enterprise.ready()` instead of just `script.onload`, fixing a race condition where the first `execute()` call failed because the library hadn't finished initializing
- **Docusaurus trailing slash** — set `trailingSlash: false` to prevent duplicate URLs

## [0.2.2] - 2026-03-03

### Added

- **`nauth.socialRedirect` on `NAuthInstance`** — `NAuth.create()` now constructs and returns the `SocialRedirectHandler` when any social provider is enabled. Express/Fastify consumers no longer need to import from `@nauth-toolkit/core/internal` or manually construct the handler

### Changed

- **Rewrote README files across all 20 packages** — npm landing pages now include install commands, quick-start code examples, feature lists, related package links, and documentation links
- **MySQL shown as alternative** — install commands and code examples in core and NestJS READMEs now show MySQL as a commented alternative alongside PostgreSQL
- **Fixed GitHub links** — example app links now correctly point to the public repo (`noorixorg/nauth-toolkit`)

### Removed

- **Removed internal API leak** — deleted `test.service.ts` from sample NestJS app that imported from `@nauth-toolkit/core/internal`

## [0.2.1] - 2026-02-27

### Added

- **reCAPTCHA per-action score overrides** — new `actionScores` config option allows different minimum score thresholds for each reCAPTCHA action (e.g., stricter for signup, more permissive for login)
- **reCAPTCHA startup validation** — new `validateOnStartup` config option (`'warn'` | `'error'` | `false`) probes the Google API on boot to verify credentials and connectivity before serving traffic
- **`RecaptchaProvider.validateConfig()` method** — providers can now implement optional startup validation; all three built-in providers (v2, v3, Enterprise) include validation logic
- **`RecaptchaValidationResult` interface** — structured result type for startup validation with `valid`, `message`, `hint`, and `httpStatus` fields

### Breaking Changes

- **`skipInDevelopment` removed from `RecaptchaConfig`** — reCAPTCHA enforcement is now controlled exclusively via the `@RequireRecaptcha()` decorator. Remove `skipInDevelopment` from your config and apply `@RequireRecaptcha()` to the specific endpoints that should be protected
- **`isRemembered` renamed to `isTrustedDevice`** — the `isRemembered` flag on session and login flows has been renamed to `isTrustedDevice` across all DTOs and services
- **`isPrimary` renamed to `isPreferred`** on MFA devices — MFA device management now uses `isPreferred` instead of `isPrimary` in all DTOs and service methods
- **`UserResponse` renamed to `UserResponseDTO`** — standardized DTO naming across all services and response types

## [0.2.0] - 2026-02-27

Initial public release.
