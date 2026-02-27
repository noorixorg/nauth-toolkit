# Changelog

All notable changes to nauth-toolkit will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

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
