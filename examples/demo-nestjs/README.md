# demo-nestjs — Full-Scale NestJS Demo

Full-featured demo of `@nauth-toolkit/nestjs` showing the complete surface of the toolkit: email/password auth, email + phone verification, MFA (TOTP, SMS, email, passkeys), adaptive MFA with risk scoring, social login (Google, Apple, Facebook), hybrid token delivery (cookies + JSON), CSRF protection, custom email/SMS templates, lifecycle hooks, and admin user management.

For a minimal integration, see [`examples/starter-nestjs`](../starter-nestjs) instead.

## Prerequisites

- Node.js 22+, pnpm
- PostgreSQL (any recent version)
- Redis (sessions, rate limits, challenge state)

## Quick Start

```bash
# From the repo root
pnpm install
pnpm build:all

cd examples/demo-nestjs
cp .env.example .env
# Edit .env: database credentials, JWT secrets, Redis URL

pnpm start
```

Visit http://localhost:3000/api/health to confirm the app is running.

> The demo uses console email/SMS providers by default — verification codes are printed to the server console instead of being sent. Swap in `NodemailerEmailProvider` / `TwilioSMSProvider` in `src/config/auth.config.ts` for real delivery.

You can also run the full stack (API + Angular frontend + Postgres + Redis + Caddy) with Docker — see [`examples/DOCKER.md`](../DOCKER.md).

## What's Inside

| Path | Purpose |
|------|---------|
| `src/config/auth.config.ts` | The heart of the demo — a comprehensive, commented `NAuthModuleConfig` covering JWT, signup verification, MFA, adaptive risk, social providers, token delivery, email/SMS templates, reCAPTCHA, sessions, and audit logs |
| `src/auth/auth.module.ts` | Module wiring: `AuthModule.forRoot(config)` + social/MFA provider modules + lifecycle hooks |
| `src/auth/auth.controller.ts` | Custom controllers built on toolkit services: signup, login, challenges, password reset, admin user management, mobile variants |
| `src/auth/social-redirect.controller.ts` | Social OAuth redirect/callback/exchange flows (web + mobile) |
| `src/auth/hooks/` | Pre/post signup lifecycle hooks registered via `NAuthHooksModule.forFeature()` |
| `src/test/` | Test-only endpoints used by the E2E suite (latest verification code, TOTP secret, user reset) |
| `resources/email-templates/` | Custom Handlebars email template override example |
| `src/sms-templates/` | File-based SMS template example |

## Environment Variables

All configuration is environment-driven — see [`.env.example`](.env.example) for the full annotated list. The essentials:

| Variable | Purpose |
|----------|---------|
| `DB_HOST` / `DB_PORT` / `DB_USERNAME` / `DB_PASSWORD` / `DB_DATABASE` | PostgreSQL connection |
| `REDIS_URL` | Redis connection (default `redis://localhost:6379`) |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | Token signing secrets |
| `API_BASE_URL` / `FRONTEND_BASE_URL` | Used for OAuth callbacks, email links, CORS, passkey origins |
| `GOOGLE_CLIENT_ID`, `APPLE_SERVICE_ID`, `FACEBOOK_CLIENT_ID`, … | Social providers — each activates only when its client ID is set |

Generate strong secrets:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

> Some token TTLs in `auth.config.ts` are deliberately short (e.g. `10s` access tokens) because this app doubles as the target for the repo's Playwright E2E suite. Use realistic values (`15m` / `30d`) in your own app.

## Development Workflow

Test local toolkit changes against the demo:

```bash
# Terminal 1: watch-compile core (full build also regenerates the OpenAPI schema)
cd packages/core
npx tsc -b --watch

# Terminal 2: run the demo in watch mode
cd examples/demo-nestjs
pnpm start:dev
```

## Key Endpoints

All routes are prefixed with `/api` (set in `main.ts`).

- `POST /api/auth/signup`, `POST /api/auth/login` — credentials auth (cookie delivery)
- `POST /api/auth/signup/mobile`, `POST /api/auth/login/mobile` — JSON token delivery variants
- `POST /api/auth/respond-challenge` — answer MFA / verification challenges
- `POST /api/auth/forgot-password`, `POST /api/auth/reset-password/confirm` — password reset flow
- `GET /api/auth/social/:provider/redirect` → `/callback` → `POST /api/auth/social/exchange` — social OAuth
- `GET /api/auth/admin/users`, `POST /api/auth/admin/users/:sub/disable`, … — admin operations
- `GET /api/health` — health check

The full route list lives in `src/auth/auth.controller.ts` and `src/auth/social-redirect.controller.ts`.

## Troubleshooting

**"Cannot connect to database"** — verify PostgreSQL is running and the `DB_*` values in `.env` are correct. Create the database if needed: `CREATE DATABASE nauth_sample;`. Tables are auto-created via TypeORM `synchronize: true` (development only — use migrations in production).

**"Cannot find module '@nauth-toolkit/...'"** — rebuild the workspace from the repo root:

```bash
pnpm install
pnpm build:all
```

**Changes to packages not reflecting** — rebuild the changed package (`pnpm --filter @nauth-toolkit/core run build`), then restart the app.

## Learning Resources

- [Documentation site](https://nauth.dev) — quick starts, concepts, full API reference
- [`docs/ARCHITECTURE.md`](../../docs/ARCHITECTURE.md) — internal architecture reference
- [Root README](../../README.md) — project overview and package list
