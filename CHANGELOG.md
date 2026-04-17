# Changelog

All notable changes to nauth-toolkit will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

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
- **Fixed GitHub links** — example app links now correctly point to the public repo (`noorixorg/nauth`)

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
