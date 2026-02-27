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
pnpm build                                    # Build core package only (most common)
pnpm build:all                                # Build entire monorepo (sequential dependency chain)
pnpm --filter @nauth-toolkit/core run build   # Build specific package
```

### Test
```bash
pnpm test                                     # Run core package tests
pnpm test:all                                 # Run tests across all packages
pnpm --filter @nauth-toolkit/core run test    # Same as `pnpm test`
pnpm --filter @nauth-toolkit/nestjs run test  # Test NestJS package
pnpm --filter @nauth-toolkit/core run test -- --testPathPattern="auth.service"  # Run single test file
pnpm --filter @nauth-toolkit/core run test -- --coverage  # With coverage report
```

### Maintenance
```bash
pnpm clean                                    # Remove all dist/ and .tsbuildinfo from packages
pnpm kill                                     # Kill process on port 3000 (useful after orphaned nest start)
```

### Publishing
```bash
node scripts/publish.js latest                # Publish all packages to npm
node scripts/publish.js latest --dry-run      # Dry-run publish (no actual publish)
node scripts/publish.js latest --skip-version-bump  # Publish without bumping versions
```

### Lint & Format
```bash
pnpm --filter @nauth-toolkit/core run lint       # Lint core
pnpm --filter @nauth-toolkit/core run lint:fix   # Lint + autofix
pnpm --filter @nauth-toolkit/core run format     # Format with Prettier
pnpm lint                                        # Lint all workspaces
pnpm fix                                         # Lint fix + format all
```

### E2E Tests
```bash
npx playwright test                           # Run Playwright E2E tests
```

## Critical Rules

- **pnpm only** — never use npm or yarn. The repo enforces this via a preinstall hook.
- **Never start dev servers** — no `pnpm start`, `nest start`, `ng serve`, `docusaurus start`, or any server-starting command. The developer runs servers manually; starting them here causes port conflicts.
- **No `console.log()`** — use the project logger module. `console.warn`/`console.error` are allowed.
- **No `any` types** — use `unknown` if needed. TypeScript strict mode is fully enabled.
- **Explicit return types** on all functions.
- **JSDoc required** on every class, public method, interface, and enum/constant.
- **Conventional commits** enforced via Husky + commitlint (max header: 200 chars, max body line: 300 chars).

## Monorepo Structure

pnpm workspaces with ~20 packages. No Lerna/Nx/Turborepo — plain pnpm with manual build orchestration. Workspace config in `pnpm-workspace.yaml`.

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
- **Persistence**: `packages/persistence/typeorm` — TypeORM persistence layer
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
- `services/` — Business logic (71 files). Main entry is `auth.service.ts` (~133KB). Other key services: `mfa.service.ts`, `social-auth.service.ts`, `challenge.service.ts`, `auth-flow-state-machine.service.ts`
- `handlers/` — Platform-agnostic middleware: `auth.handler.ts` (JWT validation), `client-info.handler.ts`, `csrf.handler.ts`, `token-delivery.handler.ts`
- `adapters/` — Framework adapters implementing `NAuthAdapter` interface: `express.adapter.ts`, `fastify.adapter.ts`
- `platform/interfaces.ts` — Core abstractions: `NAuthRequest`, `NAuthResponse`, `NAuthAdapter`, `NAuthMiddlewareHandler`
- `dto/` — 86 request/response models with class-validator decorators
- `entities/` — 13 TypeORM-agnostic base entity classes (consumers extend these)
- `enums/` — Auth audit event types, error codes, MFA methods, risk factors
- `exceptions/` — `NAuthException` custom exception class
- `interfaces/` — Provider contracts: `StorageAdapter`, `EmailProvider`, `SMSProvider`, `MFAProvider`, `SocialAuthProvider`
- `schemas/` — Zod schemas for runtime config validation
- `storage/` — Internal storage services (account lockout, rate limiting, in-memory adapter)
- `templates/` — SMS template engine
- `validators/` — Template validator
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
- Jest with ts-jest. The `jose` ESM module is transformed (see `transformIgnorePatterns` in jest.config.js — pattern accounts for pnpm's `.pnpm` directory).
- `jest.setup.ts` imports `reflect-metadata` for TypeORM decorator support.
- Coverage thresholds (core): statements 75%, branches 57%, functions 70%, lines 75%.

## Config System

- `interfaces/config.interface.ts` (~75KB) — Comprehensive `NAuthConfig` type
- `schemas/auth-config.schema.ts` — Zod schema for runtime validation
- Config drives everything: auth modes, MFA policies, session settings, token delivery, rate limiting, password policies, reCAPTCHA (`minimumScore`, `actionScores` for per-action thresholds)

## Root-Level Directories

| Directory | Purpose |
|-----------|---------|
| `examples/` | Sample apps (`sample-nestjs` on :3000, `sample-angular` on :4200) with Docker + Caddy setup |
| `tests/e2e/` | Playwright E2E tests (config: `playwright.config.ts`) |
| `docs/` | Internal architecture/design documents (20+ files, not published) |
| `scripts/` | Build tooling: `publish.js` (npm publish), `setup-package-files.js` |

## Documentation Site

Docusaurus 3.x site in `nauth-docs/`. Published at https://nauth.dev.

**Style authority:** `nauth-docs/DOCUMENTATION_RULES.md` — read it before writing or editing any doc page.

### Commands (run from `nauth-docs/`)
```bash
pnpm start        # Dev server on :3001
pnpm build        # Production build
pnpm typecheck    # TypeScript check
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

### Code → Docs Sync (MANDATORY)

**After any code change that alters a public API** (method signature, DTO field, config option, error code, enum value, class rename, or behavioral change), you MUST:

1. **Read `nauth-docs/DOCUMENTATION_RULES.md`** — it governs all doc page structure and formatting.
2. **Search broadly** — the affected API may appear in multiple doc locations (API reference, guides, quick-starts, concepts, frontend SDK). Run a grep across `nauth-docs/docs/` for the changed symbol (method name, DTO name, config key, error code, etc.) to find every reference.
3. **Update every occurrence** — don't stop at the primary mapping below. Guides contain code samples, concepts reference config keys, quick-starts show method calls. All must stay in sync.
4. **Verify accuracy** — every updated code sample must compile against the current source. If you can't verify it, delete it rather than leaving stale code.

**Primary mapping** (start here, then grep for additional references):
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

**Common cross-cutting locations** (grep these when in doubt):
- `docs/guides/` — implementation walkthroughs with full code samples
- `docs/quick-start/` — setup guides with method calls and config snippets
- `docs/concepts/` — architecture pages referencing config keys and service behavior
- `docs/frontend-sdk/` — client SDK examples calling backend APIs

### Documentation Principles
1. **Accuracy-first** — verify every code sample against source before documenting; delete over disclaiming
2. **Copy-paste ready** — examples must compile and run against the current codebase
3. **Developer journey** — structure around what developers need to DO, not what code IS
4. **Code-first** — minimal prose, no filler, no "Coming Soon" stubs; delete placeholder pages

### Visual Rules
- **No emojis** — ever. Use FontAwesome icons (`fa-duotone fa-light fa-[name]`) via `<FeatureCard>` where icons are needed
- **Components** — `<FeatureCard>`, `<Tooltip>`, `<Tabs groupId="platform">`, admonitions (`:::warning/note/tip`), Mermaid, `<details>` — prefer these over custom HTML
- **Colors** — use `--ifm-color-primary` CSS variables only; no hardcoded hex values inline
