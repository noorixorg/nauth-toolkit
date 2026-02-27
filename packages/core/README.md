# @nauth-toolkit/core

For documentation see [`Nauth.dev`](https://nauth.dev)

The platform-agnostic engine behind nauth-toolkit. All authentication business logic lives here — no framework-specific code. Runs inside your server process, stores data in your own database, makes zero external API calls.

Free to use. NestJS, Express, and Fastify all run the same core.

## What's inside

- **Auth flows** — signup, login, email/phone verification, forgot/change password, account lockout
- **Social OAuth** — Google, Apple, Facebook with web and native mobile flows, automatic account linking
- **Multi-factor auth** — TOTP, SMS, email OTP, WebAuthn passkeys, recovery codes, adaptive MFA by login risk
- **JWT lifecycle** — access + refresh tokens, rotation with reuse detection, cookie or JSON delivery
- **Sessions** — concurrent limits, device tracking, IP geolocation, trusted devices, revocation
- **Security** — Argon2id hashing, CSRF protection, rate limiting, audit trail for every event
- **Challenge-based architecture** — multi-step flows (verification, MFA, password changes) return challenge states, not errors
- **Single config** — one TypeScript object defines your entire auth policy; everything bootstraps from it

## Usage

For most setups, install the adapter for your framework:

- **NestJS** — [`@nauth-toolkit/nestjs`](https://www.npmjs.com/package/@nauth-toolkit/nestjs)
- **Express** — [`@nauth-toolkit/express`](https://www.npmjs.com/package/@nauth-toolkit/express)
- **Fastify** — [`@nauth-toolkit/fastify`](https://www.npmjs.com/package/@nauth-toolkit/fastify)

Then add storage, MFA, social, and email/SMS providers as needed. Each is a separate package you opt into.

**Docs:** [nauth.dev](https://nauth.dev) · **Examples:** [github.com/noorixorg/nauth](https://github.com/noorixorg/nauth) · **Live demo:** [demo.nauth.dev](https://demo.nauth.dev)
