# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

nauth-toolkit is a monorepo authentication framework for NestJS/Node backends. It provides a platform-agnostic core with adapters for Express, Fastify, and NestJS. The architecture is layered: framework adapters → platform-agnostic handlers → core services → storage layer.

## Commands

### Build
```bash
yarn build                                    # Build core package only (most common)
yarn build:all                                # Build entire monorepo (sequential dependency chain)
yarn workspace @nauth-toolkit/core build      # Build specific package
```

### Test
```bash
yarn test                                     # Run core package tests
yarn workspace @nauth-toolkit/core test       # Same as above
yarn workspace @nauth-toolkit/nestjs test     # Test NestJS package
yarn workspace @nauth-toolkit/core test -- --testPathPattern="auth.service"  # Run single test file
yarn workspace @nauth-toolkit/core test -- --coverage  # With coverage report
```

### Lint & Format
```bash
yarn workspace @nauth-toolkit/core lint       # Lint core
yarn workspace @nauth-toolkit/core lint:fix   # Lint + autofix
yarn workspace @nauth-toolkit/core format     # Format with Prettier
yarn lint                                     # Lint all workspaces
yarn fix                                      # Lint fix + format all
```

### E2E Tests
```bash
npx playwright test                           # Run Playwright E2E tests
```

## Critical Rules

- **Yarn only** — never use npm or pnpm. The repo enforces this via a preinstall hook.
- **Never run `yarn start` or `nest start`** — causes port conflicts.
- **No `console.log()`** — use the project logger module. `console.warn`/`console.error` are allowed.
- **No `any` types** — use `unknown` if needed. TypeScript strict mode is fully enabled.
- **Explicit return types** on all functions.
- **JSDoc required** on every class, public method, interface, and enum/constant.
- **Conventional commits** enforced via Husky + commitlint (max header: 200 chars, max body line: 300 chars).

## Monorepo Structure

Yarn workspaces with ~20 packages. No Lerna/Nx/Turborepo — plain Yarn with manual build orchestration.

### Key Packages

| Package | Path | Purpose |
|---------|------|---------|
| `@nauth-toolkit/core` | `packages/core` | Platform-agnostic auth engine (services, handlers, DTOs, entities) |
| `@nauth-toolkit/nestjs` | `packages/nestjs` | NestJS DynamicModule adapter (guards, decorators, interceptors) |
| `@nauth-toolkit/client` | `packages/client` | Frontend SDK (CJS + ESM) |
| `@nauth-toolkit/client-angular` | `packages/client-angular` | Angular-specific SDK |
| `@nauth-toolkit/recaptcha` | `packages/recaptcha` | reCAPTCHA integration |

### Provider Packages (optional, pluggable)
- **Database**: `packages/database/typeorm-postgres`, `packages/database/typeorm-mysql`
- **Email**: `packages/email/console`, `packages/email/nodemailer`
- **SMS**: `packages/sms/console`, `packages/sms/aws-sns`
- **Social OAuth**: `packages/social/google`, `packages/social/apple`, `packages/social/facebook`
- **MFA**: `packages/mfa/totp`, `packages/mfa/sms`, `packages/mfa/email`, `packages/mfa/passkey`
- **Storage**: `packages/storage/redis`, `packages/storage/database`

## Architecture

### Core Package (`packages/core/src/`)

**Entry point**: `NAuth.create(options)` in `bootstrap.ts` — initializes all services and returns a typed `NAuthInstance`.

**Export structure** (3 entry points):
- `.` (`index.ts`) — Public API: AuthService, MFAService, SocialAuthService, DTOs, entities, interfaces
- `./internal` (`internal.ts`) — For framework adapters only: PasswordService, JwtService, SessionService, ChallengeService, etc.
- `./openapi` — OpenAPI schema generation

**Key directories**:
- `services/` — Business logic (71 files). Main entry is `auth.service.ts` (132KB). Other key services: `mfa.service.ts`, `social-auth.service.ts`, `challenge.service.ts`, `auth-flow-state-machine.service.ts`
- `handlers/` — Platform-agnostic middleware: `auth.handler.ts` (JWT validation), `client-info.handler.ts`, `csrf.handler.ts`, `token-delivery.handler.ts`
- `adapters/` — Framework adapters implementing `NAuthAdapter` interface: `express.adapter.ts`, `fastify.adapter.ts`
- `platform/interfaces.ts` — Core abstractions: `NAuthRequest`, `NAuthResponse`, `NAuthAdapter`, `NAuthMiddlewareHandler`
- `dto/` — 88 request/response models with class-validator decorators
- `entities/` — 15 TypeORM-agnostic base entity classes (consumers extend these)
- `interfaces/` — Provider contracts: `StorageAdapter`, `EmailProvider`, `SMSProvider`, `MFAProvider`, `SocialAuthProvider`
- `schemas/` — Zod schemas for runtime config validation
- `utils/context-storage.ts` — AsyncLocalStorage for request context
- `utils/setup/` — Initialization helpers (init-services, init-storage, init-social, register-mfa)

### NestJS Package (`packages/nestjs/src/`)

- `auth.module.ts` — DynamicModule with `forRoot()`/`forRootAsync()`, auto-registers MFA + Social providers on bootstrap
- `guards/` — `AuthGuard`, `CsrfGuard`, `NAuthContextGuard`
- `decorators/` — `@CurrentUser()`, `@Public()`, `@ClientInfo()`, `@TokenDelivery()`, `@RequireRecaptcha()`
- `interceptors/` — Context management and cookie-based token delivery

### Request Flow
```
HTTP Request → Framework (Express/Fastify/NestJS)
  → ClientInfoHandler (extracts IP, user-agent, device token)
  → CsrfHandler (validates CSRF token)
  → AuthHandler (validates JWT, sets user on request)
  → TokenDeliveryHandler (response interceptor for cookies/JSON)
  → Your route handler → Core services
```

## Testing Patterns

- Tests use direct service instantiation with mocked dependencies (no NestJS test module in core).
- Test files are colocated: `foo.service.ts` → `foo.service.spec.ts`.
- Jest with ts-jest. The `jose` ESM module is transformed (see `transformIgnorePatterns`).
- `jest.setup.ts` imports `reflect-metadata` for TypeORM decorator support.
- Coverage thresholds (core): statements 75%, branches 57%, functions 70%, lines 75%.

## Config System

- `interfaces/config.interface.ts` (74KB) — Comprehensive `NAuthConfig` type
- `schemas/auth-config.schema.ts` — Zod schema for runtime validation
- Config drives everything: auth modes, MFA policies, session settings, token delivery, rate limiting, password policies

## Documentation Site

Docusaurus site in `nauth-docs/`. Follow `nauth-docs/DOCUMENTATION_RULES.md` when updating docs — covers all page types (Quickstart, Concept, Guide, API Reference). Track audit progress in `nauth-docs/DOCUMENTATION_MASTER_PLAN.md`.
