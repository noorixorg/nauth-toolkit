# nauth-toolkit

**Authentication that lives in your codebase.**

nauth-toolkit is an embedded TypeScript authentication library for Node.js. It runs inside your server process, stores all data in your own database, and makes zero external API calls. No per-user fees, no vendor lock-in — you own the code and the data.

Works with **NestJS**, **Express**, and **Fastify**. Frontend SDKs for **Angular** and vanilla TypeScript (React, Vue, Svelte).

## What it handles

- **Email + password** — signup, login, configurable password policies, email and phone verification, forgot/change password
- **Social OAuth** — Google, Apple, Facebook with web redirect and native mobile token flows, automatic account linking
- **Multi-factor authentication** — TOTP (authenticator apps), SMS codes, email OTP, WebAuthn passkeys, recovery codes
- **Adaptive MFA** — risk-based enforcement triggered by new devices, location changes, or anomalous login patterns
- **JWT lifecycle** — access + refresh tokens, rotation with reuse detection, configurable delivery via HttpOnly cookies or JSON
- **Sessions** — concurrent session limits, device tracking with fingerprinting, IP geolocation, trusted device management, revocation
- **Security** — Argon2id hashing, CSRF protection, per-IP and per-user rate limiting, account lockout, audit trail for every security event
- **reCAPTCHA** — v3 and Enterprise integration
- **OpenAPI** — auto-generated schema from your configuration

## How it works

One TypeScript config object defines your entire auth policy — signup rules, MFA enforcement, social providers, session limits, rate limits, token delivery. At startup, nauth-toolkit reads this config and bootstraps all services, middleware, and flows. Your routes stay thin: call `authService.signup(dto)` and get a result. Multi-step flows (email verification, MFA, password changes) use a challenge-based architecture that returns verification states instead of errors.

## Packages

| Package | Purpose |
|---------|---------|
| [`@nauth-toolkit/core`](https://www.npmjs.com/package/@nauth-toolkit/core) | Auth engine — all business logic, framework-agnostic |
| [`@nauth-toolkit/nestjs`](https://www.npmjs.com/package/@nauth-toolkit/nestjs) | NestJS module — guards, decorators, interceptors |
| [`@nauth-toolkit/client`](https://www.npmjs.com/package/@nauth-toolkit/client) | Frontend SDK (vanilla JS/TS) |
| [`@nauth-toolkit/client-angular`](https://www.npmjs.com/package/@nauth-toolkit/client-angular) | Angular SDK |

### Storage & Database

| Package | Purpose |
|---------|---------|
| [`@nauth-toolkit/database-typeorm-postgres`](https://www.npmjs.com/package/@nauth-toolkit/database-typeorm-postgres) | PostgreSQL via TypeORM |
| [`@nauth-toolkit/database-typeorm-mysql`](https://www.npmjs.com/package/@nauth-toolkit/database-typeorm-mysql) | MySQL / MariaDB via TypeORM |
| [`@nauth-toolkit/storage-redis`](https://www.npmjs.com/package/@nauth-toolkit/storage-redis) | Redis / Dragonfly session storage |
| [`@nauth-toolkit/storage-database`](https://www.npmjs.com/package/@nauth-toolkit/storage-database) | Database-backed session storage |

### Providers

| Package | Purpose |
|---------|---------|
| [`@nauth-toolkit/mfa-totp`](https://www.npmjs.com/package/@nauth-toolkit/mfa-totp) | TOTP / authenticator apps |
| [`@nauth-toolkit/mfa-sms`](https://www.npmjs.com/package/@nauth-toolkit/mfa-sms) | SMS one-time codes |
| [`@nauth-toolkit/mfa-email`](https://www.npmjs.com/package/@nauth-toolkit/mfa-email) | Email one-time codes |
| [`@nauth-toolkit/mfa-passkey`](https://www.npmjs.com/package/@nauth-toolkit/mfa-passkey) | Passkeys / WebAuthn / FIDO2 |
| [`@nauth-toolkit/social-google`](https://www.npmjs.com/package/@nauth-toolkit/social-google) | Google OAuth |
| [`@nauth-toolkit/social-apple`](https://www.npmjs.com/package/@nauth-toolkit/social-apple) | Sign in with Apple |
| [`@nauth-toolkit/social-facebook`](https://www.npmjs.com/package/@nauth-toolkit/social-facebook) | Facebook Login |
| [`@nauth-toolkit/email-nodemailer`](https://www.npmjs.com/package/@nauth-toolkit/email-nodemailer) | Email via Nodemailer / SMTP |
| [`@nauth-toolkit/email-console`](https://www.npmjs.com/package/@nauth-toolkit/email-console) | Console email output (dev) |
| [`@nauth-toolkit/sms-aws-sns`](https://www.npmjs.com/package/@nauth-toolkit/sms-aws-sns) | SMS via AWS SNS |
| [`@nauth-toolkit/sms-twilio`](https://www.npmjs.com/package/@nauth-toolkit/sms-twilio) | SMS via Twilio |
| [`@nauth-toolkit/sms-console`](https://www.npmjs.com/package/@nauth-toolkit/sms-console) | Console SMS output (dev) |
| [`@nauth-toolkit/recaptcha`](https://www.npmjs.com/package/@nauth-toolkit/recaptcha) | reCAPTCHA v3 / Enterprise |

## Examples

Runnable sample applications live in [`examples/`](./examples):

| Example | Stack |
|---------|-------|
| [`demo-nestjs`](./examples/demo-nestjs) | NestJS + TypeORM + PostgreSQL (most complete) |
| [`starter-express`](./examples/starter-express) | Express + TypeORM + PostgreSQL |
| [`starter-fastify`](./examples/starter-fastify) | Fastify + TypeORM + PostgreSQL |
| [`demo-angular`](./examples/demo-angular) | Angular frontend using `@nauth-toolkit/client-angular` |
| [`starter-react`](./examples/starter-react) | React + Vite frontend using `@nauth-toolkit/client` |

## Development

This is a pnpm workspace monorepo (pnpm only — npm/yarn are blocked by a preinstall hook):

```bash
pnpm install
pnpm build:all   # build every package in dependency order
pnpm test:all    # run all test suites
pnpm lint        # lint all workspaces
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full development workflow and [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for the architecture reference.

## Links

| | |
|---|---|
| **Documentation** | [nauth.dev](https://nauth.dev) |
| **Live demo** | [demo.nauth.dev](https://demo.nauth.dev) |
| **Source & community** | [github.com/noorixorg/nauth-toolkit](https://github.com/noorixorg/nauth-toolkit) |
| **npm** | [npmjs.com/org/nauth-toolkit](https://www.npmjs.com/org/nauth-toolkit) |

## License

[MIT](./LICENSE)
