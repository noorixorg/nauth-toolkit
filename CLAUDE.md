# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## GitHub URL Rules — CRITICAL

There are two GitHub repositories. **Always use the correct one:**

| Repo | URL | Use for |
|------|-----|---------|
| **Public community repo** | `https://github.com/noorixorg/nauth` | All documentation links, homepage nav, CTA buttons, any user-facing link |
| **Private source repo** | `https://github.com/noorixorg/nauth-toolkit` | Internal references only (e.g. JSON-LD `codeRepository`, package.json, internal notes) |

**Never link users to `noorixorg/nauth-toolkit` in any public-facing page or doc.** The public GitHub repo is `noorixorg/nauth`.

## Project Overview

nauth-toolkit is a monorepo authentication framework for Node.js backends. It provides a framework-agnostic core with adapters for Express, Fastify, and NestJS. The architecture is layered: framework adapters → core services → storage layer.

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

Docusaurus 3.x site in `nauth-docs/`. Published at https://nauth.dev.

**Style authority:** `nauth-docs/DOCUMENTATION_RULES.md` — read it before writing or editing any doc page. Audit progress tracked in `nauth-docs/DOCUMENTATION_MASTER_PLAN.md`.

### Commands (run from `nauth-docs/`)
```bash
yarn start        # Dev server on :3001
yarn build        # Production build
yarn typecheck    # TypeScript check
```

### Docs Structure
| Directory | Contains |
|-----------|----------|
| `docs/quick-start/` | End-to-end setup guides (NestJS, Express, Fastify, Angular, React) |
| `docs/concepts/` | Architecture and "how X works" explanations |
| `docs/features/` | Feature guides (MFA, social login, email templates, etc.) |
| `docs/guides/` | Targeted how-to guides (reCAPTCHA, OpenAPI, etc.) |
| `docs/api/` | API reference — services, DTOs, entities, adapters |
| `docs/frontend-sdk/` | Client SDK guides and API reference |

### Code → Docs Mapping
When you change code in these packages, update the corresponding docs:
- `packages/core/src/services/` → `docs/api/core/` service pages
- `packages/core/src/dto/` → `docs/api/core/` DTO pages
- `packages/core/src/entities/` → `docs/api/core/` entity pages
- `packages/core/src/interfaces/config.interface.ts` → `docs/concepts/configuration.md`
- `packages/nestjs/` → `docs/api/nestjs/` and `docs/quick-start/nestjs.mdx`
- `packages/client/` → `docs/frontend-sdk/`
- `packages/mfa/*/` → `docs/features/mfa.md` and `docs/api/mfa/`
- `packages/social/*/` → `docs/features/social-login.md` and `docs/api/social/`
- `packages/email/*/` → `docs/api/email/`
- `packages/sms/*/` → `docs/api/sms/`
- `packages/storage/*/` → `docs/api/storage/`
- `packages/database/*/` → `docs/api/database/`

### Documentation Principles
1. **Accuracy-first** — verify every code sample against source before documenting; delete over disclaiming
2. **Copy-paste ready** — examples must compile and run against the current codebase
3. **Developer journey** — structure around what developers need to DO, not what code IS
4. **Code-first** — minimal prose, no filler, no "Coming Soon" stubs; delete placeholder pages

### Visual Rules
- **No emojis** — ever. Use FontAwesome icons (`fa-duotone fa-light fa-[name]`) via `<FeatureCard>` where icons are needed
- **Components** — `<FeatureCard>`, `<Tooltip>`, `<Tabs groupId="platform">`, admonitions (`:::warning/note/tip`), Mermaid, `<details>` — prefer these over custom HTML
- **Colors** — use `--ifm-color-primary` CSS variables only; no hardcoded hex values inline
