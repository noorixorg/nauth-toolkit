# nauth-toolkit Architecture

**Version:** 0.2.6 | **Updated:** 2026-06-11

This is the canonical internal architecture reference for the nauth-toolkit monorepo. The published, consumer-facing documentation lives in `nauth-docs/` (https://nauth.dev). This document is for contributors and tooling working on the source.

---

## Core Principle

Zero framework dependencies in the core. Pure TypeScript with constructor injection. Platform abstraction via `NAuthRequest`/`NAuthResponse` interfaces, with adapters that bind the core to Express, Fastify, or NestJS.

---

## Monorepo Layout

pnpm workspaces (see `pnpm-workspace.yaml`). No Lerna/Nx/Turborepo - plain pnpm with manual build orchestration. The repo enforces pnpm via a `preinstall` hook.

### Packages

| Package                                    | Path                                 | Purpose                                                    |
| ------------------------------------------ | ------------------------------------ | ---------------------------------------------------------- |
| `@nauth-toolkit/core`                      | `packages/core`                      | Auth services, JWT, sessions, universal bootstrap, adapters |
| `@nauth-toolkit/nestjs`                    | `packages/nestjs`                    | NestJS guards, interceptors, decorators, modules            |
| `@nauth-toolkit/client`                    | `packages/client`                    | Frontend SDK (CJS + ESM)                                    |
| `@nauth-toolkit/client-angular`            | `packages/client-angular`            | Angular-specific SDK                                        |
| `@nauth-toolkit/recaptcha`                 | `packages/recaptcha`                 | reCAPTCHA integration (per-action score thresholds)         |
| `@nauth-toolkit/database-typeorm-postgres` | `packages/database/typeorm-postgres` | PostgreSQL TypeORM entities                                 |
| `@nauth-toolkit/database-typeorm-mysql`    | `packages/database/typeorm-mysql`    | MySQL TypeORM entities                                      |
| `@nauth-toolkit/storage-database`          | `packages/storage/database`          | Database transient-storage adapter                          |
| `@nauth-toolkit/storage-redis`             | `packages/storage/redis`             | Redis transient-storage adapter                             |
| `@nauth-toolkit/email-console`             | `packages/email/console`             | Console email provider (dev)                                |
| `@nauth-toolkit/email-nodemailer`          | `packages/email/nodemailer`          | SMTP email provider                                         |
| `@nauth-toolkit/sms-console`               | `packages/sms/console`               | Console SMS provider (dev)                                  |
| `@nauth-toolkit/sms-aws-sns`               | `packages/sms/aws-sns`               | AWS End User Messaging / SNS SMS provider                   |
| `@nauth-toolkit/sms-twilio`                | `packages/sms/twilio`                | Twilio SMS provider                                         |
| `@nauth-toolkit/social-google`             | `packages/social/google`             | Google OAuth provider                                       |
| `@nauth-toolkit/social-apple`              | `packages/social/apple`              | Apple OAuth provider                                        |
| `@nauth-toolkit/social-facebook`           | `packages/social/facebook`           | Facebook OAuth provider                                     |
| `@nauth-toolkit/mfa-totp`                  | `packages/mfa/totp`                  | TOTP (authenticator app) MFA                                |
| `@nauth-toolkit/mfa-sms`                   | `packages/mfa/sms`                   | SMS-code MFA                                                |
| `@nauth-toolkit/mfa-email`                 | `packages/mfa/email`                 | Email-code MFA                                              |
| `@nauth-toolkit/mfa-passkey`               | `packages/mfa/passkey`               | WebAuthn/FIDO2 passkeys                                     |

Provider packages expose a `/nestjs` subpath (e.g. `@nauth-toolkit/social-google/nestjs`) with a ready-made NestJS module.

### Examples

| Directory                 | Purpose                                       |
| ------------------------- | --------------------------------------------- |
| `examples/demo-nestjs`  | NestJS demo backend (port 3000, most complete)|
| `examples/demo-angular` | Angular demo client (port 4200)               |
| `examples/starter-express` | Express demo backend (`ExpressAdapter`)       |
| `examples/starter-fastify` | Fastify demo backend (`FastifyAdapter`)       |
| `examples/starter-react`   | React + Vite demo client (`@nauth-toolkit/client`) |

Docker + Caddy setup for both lives in `examples/`.

### Commands

```bash
pnpm build                  # Build core package only
pnpm build:all              # Build entire monorepo (dependency order)
pnpm test                   # Run core package tests
pnpm test:all               # Tests across all packages
pnpm --filter @nauth-toolkit/core run test -- --testPathPattern="auth.service"
pnpm --filter @nauth-toolkit/core run lint
pnpm clean                  # Remove all dist/ and .tsbuildinfo
npx playwright test         # E2E tests (requires running sample app)
```

Never start dev servers from automation (`pnpm start`, `nest start`, `ng serve`, `docusaurus start`) - the developer runs servers manually.

---

## Platform Abstraction

Handlers operate on generic interfaces, never raw framework objects (`packages/core/src/platform/interfaces.ts`):

```typescript
interface NAuthRequest {
  readonly method: string;
  readonly path: string;
  readonly url: string;
  readonly body: Record<string, unknown>;
  readonly query: Record<string, unknown>;
  readonly params: Record<string, string>;
  readonly headers: Record<string, string | string[] | undefined>;
  readonly cookies: Record<string, string | undefined>;
  readonly ip: string;
  readonly attributes: NAuthRequestAttributes; // request-scoped storage (user, token, clientInfo, overrides)
  readonly raw: unknown; // escape hatch (avoid)
  getHeader(name: string): string | undefined;
}

interface NAuthResponse {
  readonly raw: unknown;
  status(code: number): this;
  header(name: string, value: string | string[]): this;
  setCookie(name: string, value: string, options?: NAuthCookieOptions): this;
  clearCookie(name: string, options?: NAuthCookieOptions): this;
  send(body: unknown): void;
  json(body: unknown): void;
  redirect(url: string, status?: number): void;
  isSent(): boolean;
}

interface NAuthAdapter {
  name: string;
  registerMiddleware(name: string, handler: NAuthMiddlewareHandler): unknown;
  registerResponseInterceptor(handler: NAuthResponseInterceptorHandler): unknown;
  wrapRouteHandler<T>(handler: NAuthRouteHandler<T>): unknown;
}
```

**Adapters handle:** request/response wrapping, AsyncLocalStorage context management, framework-specific conversions. Built-in: `ExpressAdapter`, `FastifyAdapter` (`packages/core/src/adapters/`). The NestJS package wires the same handlers through guards/interceptors instead.

---

## Usage

### Express

```typescript
import { NAuth, ExpressAdapter } from '@nauth-toolkit/core';

const nauth = await NAuth.create({ config, dataSource, adapter: new ExpressAdapter() });

// Middleware (order matters)
app.use(nauth.middleware.clientInfo); // FIRST - initializes context
app.use(nauth.middleware.csrf);
app.use(nauth.middleware.auth);
app.use(nauth.middleware.tokenDelivery);

app.post('/signup', nauth.helpers.public(), async (req, res) => {
  res.json(await nauth.authService.signup(req.body));
});
app.get('/profile', nauth.helpers.requireAuth(), (req, res) => {
  res.json({ user: nauth.helpers.getCurrentUser() });
});
```

### Fastify

```typescript
import { NAuth, FastifyAdapter } from '@nauth-toolkit/core';

const nauth = await NAuth.create({ config, dataSource, adapter: new FastifyAdapter() });

fastify.addHook('onRequest', nauth.middleware.clientInfo); // FIRST
fastify.addHook('onRequest', nauth.middleware.csrf);
fastify.addHook('onRequest', nauth.middleware.auth);
fastify.addHook('onSend', nauth.middleware.tokenDelivery);

// Routes must be wrapped for context access
fastify.post(
  '/signup',
  { preHandler: nauth.helpers.public() },
  nauth.adapter.wrapRouteHandler(async (req) => nauth.authService.signup(req.body)),
);
```

### NestJS

```typescript
import { AuthModule } from '@nauth-toolkit/nestjs';
import { GoogleSocialAuthModule } from '@nauth-toolkit/social-google/nestjs';
import { getNAuthEntities } from '@nauth-toolkit/database-typeorm-postgres';

@Module({
  imports: [
    TypeOrmModule.forRoot({ type: 'postgres', entities: getNAuthEntities() }),
    AuthModule.forRoot(config),
    GoogleSocialAuthModule,
  ],
})
export class AppModule {}
```

Note: only `AuthModule.forRoot()` exists today; `forRootAsync()` is not implemented (see Known Gaps).

---

## Request Flow & Context Storage

```
HTTP Request -> Framework (Express/Fastify/NestJS)
 -> ClientInfoHandler   (extracts IP, user-agent, device token; initializes context)
 -> CsrfHandler         (validates CSRF token for cookie delivery)
 -> AuthHandler         (validates JWT, loads session + user, sets request attributes)
 -> Route handler       (your code -> core services)
 -> TokenDeliveryHandler (response interceptor: cookies vs JSON token delivery)
```

AsyncLocalStorage context keys (`packages/core/src/utils/context-storage.ts`):

| Key               | Contents                               |
| ----------------- | -------------------------------------- |
| `CLIENT_INFO`     | IP, user agent, device info, sessionId |
| `CURRENT_USER`    | Authenticated user object              |
| `CURRENT_SESSION` | Session ID                             |
| `JWT_PAYLOAD`     | Token payload                          |

- **Express:** context propagates automatically.
- **Fastify:** context stored on `request.__nauthContextStore`, restored by the adapter. Use `nauth.adapter.wrapRouteHandler()` for route handlers.
- **NestJS:** `NAuthContextGuard` / `NAuthContextInterceptor` manage context.

---

## Services

### Public API (`@nauth-toolkit/core`)

| Service                                            | Purpose                                      |
| -------------------------------------------------- | -------------------------------------------- |
| `AuthService`                                      | Signup, login, refresh, logout, password ops |
| `AdminAuthService`                                 | Admin-side user management operations        |
| `MFAService`                                       | MFA setup, verification, device management   |
| `SocialAuthService`                                | OAuth flows (redirect + native token verify) |
| `EmailVerificationService` / `PhoneVerificationService` | Verification codes and confirmation     |
| `ClientInfoService`                                | Client/device info extraction                |
| `GeoLocationService`                               | MaxMind GeoIP enrichment                     |
| `AuthAuditService`                                 | Audit trail queries                          |
| `CsrfService`                                      | CSRF token issue/validate                    |
| `HookRegistryService`                              | Lifecycle hook registration                  |

### Internal (`@nauth-toolkit/core/internal` - framework adapters only)

| Category    | Services                                                                                          |
| ----------- | ------------------------------------------------------------------------------------------------- |
| Auth flow   | `AuthFlowStateMachineService`, `AuthFlowContextBuilder`, state definitions and rules               |
| Challenge   | `ChallengeService`, `AuthChallengeHelperService`                                                   |
| Primitives  | `PasswordService`, `JwtService`, `SessionService`, `PasswordResetService`, `TrustedDeviceService` |
| Risk        | `RiskDetectionService`, `RiskScoringService`, `AdaptiveMFADecisionService`                         |
| Social      | `SocialProviderRegistry`, `SocialAuthStateStore`, `BaseSocialAuthProviderService`                  |
| MFA         | `BaseMFAProviderService`                                                                           |
| Hooks       | `registerBuiltInEmailNotificationHooks`                                                            |

Storage-side internals (`packages/core/src/storage/`): `RateLimitStorageService`, `AccountLockoutStorageService`, `MemoryStorageAdapter`.

There is also an `@nauth-toolkit/core/openapi` subpath export for OpenAPI schema generation.

### NestJS adapter surface (`packages/nestjs`)

- `AuthModule.forRoot()` - DynamicModule; auto-registers MFA + Social providers on bootstrap
- Guards: `AuthGuard`, `CsrfGuard`, `NAuthContextGuard`
- Interceptors: `NAuthContextInterceptor`, `CookieTokenInterceptor`
- Decorators: `@CurrentUser()`, `@Public()`, `@ClientInfo()`, `@TokenDelivery()`, `@RequireRecaptcha()`, hook decorators
- Misc: `NAuthHttpExceptionFilter`, `NAuthValidationPipe`, `HooksModule`, `MigrationsBootstrapService`, `NestjsLoggerAdapter`

---

## Entities

Base entities live in core (fields + business logic, no ORM decorators). Database packages extend them with TypeORM decorators and database-specific column types.

| Entity                     | Purpose                              |
| -------------------------- | ------------------------------------ |
| `BaseUser`                 | User accounts                        |
| `BaseSession`              | Active sessions (with `@VersionColumn` for optimistic locking) |
| `BaseTrustedDevice`        | Remembered devices (MFA bypass)      |
| `BaseLoginAttempt`         | Login history                        |
| `BaseVerificationToken`    | Email/phone verification             |
| `BaseSocialAccount`        | OAuth linked accounts                |
| `BaseSocialProviderSecret` | DB-stored social provider secrets    |
| `BaseChallengeSession`     | MFA/verification challenge sessions  |
| `BaseMFADevice`            | Enrolled MFA devices                 |
| `BaseAuthAudit`            | Audit trail                          |
| `BaseRateLimit`            | Transient storage (rate limits)      |
| `BaseStorageLock`          | Transient storage (distributed locks)|

Use `getNAuthEntities()` from the database package for TypeORM config. Add `getNAuthTransientStorageEntities()` if using `DatabaseStorageAdapter`.

### Why separate database packages instead of one adapter?

TypeORM decorators are compile-time metadata requiring static literal values, so column types cannot be switched at runtime. Each database package hardcodes the right types:

| Feature      | PostgreSQL          | MySQL        |
| ------------ | ------------------- | ------------ |
| UUID column  | `uuid` (native)     | `char(36)`   |
| JSON storage | `jsonb`             | `json`       |
| Arrays       | `text[]`            | `json`       |
| Boolean      | `boolean`           | `tinyint(1)` |

Business logic stays in the core base classes; database packages contain only decorator overlays. Adding a new database means adding a new entity package.

---

## Auth Flow State Machine & Challenge System

Challenges are **HTTP 200 responses, not errors**. A single endpoint (`respondToChallenge()`) completes any challenge. The state machine (`packages/core/src/services/auth-flow-state-definitions.ts`) evaluates states in priority order; the first matching condition wins:

| Priority | State                          | Challenge               | Trigger                                                  |
| -------- | ------------------------------ | ----------------------- | -------------------------------------------------------- |
| 1        | `PENDING_PASSWORD_CHANGE`      | `FORCE_CHANGE_PASSWORD` | Admin-forced password change                              |
| 2        | `PENDING_EMAIL_VERIFICATION`   | `VERIFY_EMAIL`          | Unverified email (sequential: before phone)               |
| 3        | `PENDING_PHONE_COLLECTION`     | `VERIFY_PHONE`          | Phone required but not yet provided                       |
| 4        | `PENDING_PHONE_VERIFICATION`   | `VERIFY_PHONE`          | Unverified phone (after email)                            |
| 5        | `PENDING_MFA_SETUP`            | `MFA_SETUP_REQUIRED`    | REQUIRED/ADAPTIVE enforcement, grace period expired       |
| 6        | `PENDING_MFA_VERIFICATION`     | `MFA_REQUIRED`          | MFA enabled, verification needed                          |
| 7        | `GRACE_PERIOD_ACTIVE`          | (none - login allowed)  | ADAPTIVE grace period active; metadata includes deadline  |
| 8        | `BLOCKED`                      | (none - login rejected) | High-risk sign-in blocked; metadata includes `blockedUntil` |
| 9        | `AUTHENTICATED`                | (none)                  | Fallback - all challenges complete, tokens issued         |

Special case: at priority 5, if the user's phone is already verified and their preferred MFA method is SMS, SMS verification during MFA setup is skipped (`skipMFAVerification`).

`AuthChallenge` enum: `VERIFY_EMAIL`, `VERIFY_PHONE`, `MFA_REQUIRED`, `MFA_SETUP_REQUIRED`, `FORCE_CHANGE_PASSWORD`.

### Unified Auth Response (discriminated union)

Every auth endpoint (`signup`, `login`, social callback/verify, `refresh`, `respondToChallenge`) returns `AuthResponseDTO` - either tokens **or** a challenge, never both:

```typescript
// Success
{
  user: { sub, email, firstName?, lastName?, isEmailVerified, socialProviders? },
  accessToken, refreshToken,
  accessTokenExpiresAt, refreshTokenExpiresAt, // unix seconds
}

// Challenge
{
  challengeName: AuthChallenge,
  session: string,                              // temporary challenge session token
  challengeParameters?: Record<string, unknown>,
  userSub: string,
}
```

Challenge completion goes through the single endpoint:

```
POST /auth/respond-challenge
{ "session": "<uuid>", "type": "VERIFY_EMAIL", "code": "123456" }
-> AuthResponseDTO (success or the NEXT challenge in priority order)
```

Frontends discriminate with `'challengeName' in response`.

---

## Token Delivery

| Mode      | Use case         | Storage                            | Client sends                   |
| --------- | ---------------- | ---------------------------------- | ------------------------------ |
| `cookies` | Web apps         | httpOnly cookies (server-managed)  | `withCredentials: true`        |
| `json`    | Mobile/native    | Secure storage (Keychain etc.)     | `Authorization: Bearer` header |
| `hybrid`  | Web + mobile     | Both paths exposed by backend      | Depends on endpoint            |

**Hybrid is a backend deployment pattern, not a frontend mode.** Keep delivery deterministic per route - either explicit routes (recommended: `/auth/*` cookies, `/mobile/auth/*` JSON) or `hybridPolicy` (Origin-based). Per-route override: `nauth.helpers.tokenDelivery('cookies')` or `@TokenDelivery('cookies')` in NestJS. A response must never contain both cookie tokens and JSON tokens.

Cookie defaults: `nauth_access_token` / `nauth_refresh_token`, `httpOnly: true`, `secure: true`, `sameSite: 'strict'`, `path: '/'`.

### CSRF Protection

Enforced when cookie delivery is in effect (`cookies` or hybrid-resolved cookies). Configurable via `security.csrf`.

- Server sets readable (non-httpOnly) cookie: `nauth_csrf_token`
- Client sends header: `x-csrf-token`
- GET/HEAD/OPTIONS skipped
- Bypass per route: `nauth.helpers.public()` or `@Public()`

JSON mode is not CSRF-vulnerable (no automatic credential send), so CSRF only applies to cookie flows.

---

## Sessions, Refresh Tokens & Concurrency

### Refresh flow

1. Login creates a **Session** row (hard expiry, e.g. 30-90 days) plus an access token (short, e.g. `15m`) and refresh token (e.g. `30d` with `rotation: true`).
2. On refresh: refresh token validated, **new access + refresh tokens issued**, old refresh token blacklisted (rotation).
3. Session expiry is a hard ceiling - even with active refresh, re-authentication is forced when the session expires.
4. Logout revokes the session immediately; all tokens become invalid.
5. **Reuse detection:** presenting an already-used refresh token revokes sessions (treated as theft).

### Optimistic locking (TOCTOU protection)

Sessions are always database-stored with a TypeORM `@VersionColumn()`. The auth guard uses a double-check pattern:

```typescript
const session = await sessionService.findByIdLight(sessionId);
const initialVersion = session.version;
// ... validation work (50-200ms window) ...
const revalidated = await sessionService.findByIdLight(sessionId);
if (revalidated.version !== initialVersion) throw /* session modified mid-request */;
```

This blocks mid-request session revocation bypass, concurrent refresh exploitation, and token rotation races. Rule: only security-critical operations (token rotation, revocation) update the session and bump the version - activity tracking must not.

### Storage adapters vs sessions

| Concern              | Sessions (database)               | Storage adapters (Memory/Database/Redis)        |
| -------------------- | --------------------------------- | ----------------------------------------------- |
| Data                 | Full session entities             | Rate limits, distributed locks, used tokens, lockout state |
| Race prevention      | `@VersionColumn` double-check     | Atomic ops (Redis `INCR`, DB pessimistic locks) |
| Lifetime             | Long-lived, queryable             | Short-lived, TTL-based                          |
| Affected by adapter choice | No - always database        | Yes                                             |

| Adapter                  | Use case                |
| ------------------------ | ----------------------- |
| `MemoryStorageAdapter`   | Dev/testing only (single instance) |
| `DatabaseStorageAdapter` | Low-traffic production  |
| `RedisStorageAdapter`    | High-traffic production / multi-instance |

A refresh operation mixes both: lock acquisition + used-token marking via the storage adapter (atomic), session validation + token update via the database (versioned).

---

## JWT

**Library:** `jose` (platform-agnostic, ESM).

- Algorithms: HS256/384/512 (symmetric), RS256/384/512 (asymmetric: `privateKey` + `publicKey` required)
- `expiresIn` is required config (no runtime default). Typical production: access `15m`, refresh `30d` with rotation.
- Refresh rotation and reuse detection are built in.

---

## MFA

| Provider                     | Method             |
| ---------------------------- | ------------------ |
| `@nauth-toolkit/mfa-totp`    | Authenticator apps |
| `@nauth-toolkit/mfa-sms`     | SMS codes          |
| `@nauth-toolkit/mfa-email`   | Email codes        |
| `@nauth-toolkit/mfa-passkey` | WebAuthn/FIDO2     |

Plus backup codes (built into core). Providers implement the `MFAProvider` contract and self-register via their `/nestjs` modules or `NAuth.create()` options. `MFAService` handles setup (`getSetupData`), verification (`verifyCode`), and device management (list/update/delete/disable).

**Enforcement policies:** `OPTIONAL` | `REQUIRED` (with optional grace period) | `ADAPTIVE` (risk-based).

### Remember Device

Skips MFA for a configured period after a successful MFA completion.

- Server-generated UUID device token; only the SHA-256 hash is stored (`BaseTrustedDevice`)
- Cookies mode: `nauth_device_id` httpOnly cookie (automatic). JSON mode: token in response body; client stores securely and sends `X-Device-Token` header
- Config: `mfa.rememberDevice`, `mfa.rememberDeviceDays` (default 30), `mfa.bypassMFAForTrustedDevices` (default `false`; does NOT apply to ADAPTIVE mode)

### Adaptive MFA (risk-based)

Integrated into `AuthService.login()` via `AuthChallengeHelperService.checkMFARequirement()` -> `AdaptiveMFADecisionService.evaluateAdaptiveMFA()`:

1. `RiskDetectionService.detectRiskFactors()` - `new_device`, `new_ip` (skipped when `new_country` detected), `new_country`, `impossible_travel`, `suspicious_activity`
2. `RiskScoringService.calculateRiskScore()` - sums configured weights, classifies low/medium/high
3. Action by configured `riskLevels` thresholds: `allow` -> tokens issued, `require_mfa` -> `MFA_REQUIRED` challenge, `block_signin` -> sign-in blocked (`SIGNIN_BLOCKED_HIGH_RISK`, with `blockedUntil`)

Geo data comes from `GeoLocationService` (MaxMind, optional auto-download at startup).

---

## Social Auth

Providers: Google, Apple, Facebook. Two backend flows, both returning `AuthResponseDTO`:

1. **Web redirect flow:** `/auth/social/:provider` -> provider -> `/auth/social/:provider/callback` (state validated via `SocialAuthStateStore`). For hybrid delivery, decide delivery at the **start** request (explicit route or `@TokenDelivery`) and persist it server-side for the callback.
2. **Native token verify flow (Capacitor/mobile):** `POST /auth/social/:provider/verify` with the provider `idToken` obtained natively on-device. The backend verifies the ID token signature against the provider's JWKS - no redirect needed.

Social logins pass through the same challenge state machine: depending on `verificationMethod` config, social users can be required to verify email, collect + verify a phone, or set up MFA before tokens are issued. Provider secrets can be DB-stored (`BaseSocialProviderSecret`).

---

## Error Handling

`NAuthException` extends `Error` (not NestJS `HttpException`) so it is usable in HTTP, WebSocket, GraphQL, gRPC, queue workers, and CLIs:

```typescript
throw new NAuthException(AuthErrorCode.RATE_LIMIT_SMS, 'Too many verification SMS sent', {
  retryAfter: 3600,
});
```

- Core throws structured domain errors (`code: AuthErrorCode`, `message`, `details`)
- Consumers map to transport: use `NAuthHttpExceptionFilter` (from `@nauth-toolkit/nestjs`) or a custom filter with `getHttpStatusForErrorCode()` (exported from core)
- The toolkit never formats HTTP responses itself

---

## Email & SMS Providers

**Email** (`EmailProvider` contract): `email-console` (dev), `email-nodemailer` (SMTP). Templates are Handlebars with a greeting-name fallback chain (`firstName` -> `email` local part). Custom templates via config (`email.templates.<name>.path`) or programmatic registration; the `TemplateValidator` checks required variables per template type.

**SMS** (`SMSProvider` contract): `sms-console` (dev), `sms-aws-sns` (AWS End User Messaging), `sms-twilio`. SMS templates use the core template engine (`packages/core/src/templates/`). Providers can auto-configure from environment variables.

---

## Config System

- `packages/core/src/interfaces/config.interface.ts` - the comprehensive `NAuthConfig` TypeScript type
- `packages/core/src/schemas/auth-config.schema.ts` - the Zod schema validating config at runtime (fails fast)

Cross-field requirements enforced by the schema:

- Email verification -> `emailProvider` required
- Phone verification / MFA SMS -> `smsProvider` required
- MFA `ADAPTIVE` -> `mfa.enabled` + `mfa.adaptive` required
- Asymmetric JWT -> `privateKey` + `publicKey` required

Config drives everything: auth modes, MFA policies, session settings, token delivery, rate limiting, password policies, reCAPTCHA (`minimumScore`, per-action `actionScores`).

---

## Creating Custom Adapters

Implement `NAuthAdapter`:

```typescript
class KoaAdapter implements NAuthAdapter {
  name = 'koa';
  registerMiddleware(name: string, handler: NAuthMiddlewareHandler) {
    return async (ctx: Koa.Context, next: Koa.Next) => {
      const req = new KoaRequestWrapper(ctx.request);
      const res = new KoaResponseWrapper(ctx.response);
      await handler(req, res, next);
    };
  }
  registerResponseInterceptor(handler: NAuthResponseInterceptorHandler) { /* ... */ }
  wrapRouteHandler<T>(handler: NAuthRouteHandler<T>) { /* ... */ }
}
```

The adapter is responsible for AsyncLocalStorage context propagation across the request lifecycle.

---

## Testing

### Unit tests (Jest)

- Direct service instantiation with mocked dependencies (no NestJS testing module in core)
- Colocated: `foo.service.ts` -> `foo.service.spec.ts`
- `jose` (ESM) is transformed via `transformIgnorePatterns` (accounts for pnpm's `.pnpm` directory)
- `jest.setup.ts` imports `reflect-metadata`
- Coverage thresholds (core): statements 75%, branches 57%, functions 70%, lines 75%

```bash
pnpm --filter @nauth-toolkit/core run test
pnpm --filter @nauth-toolkit/core run test -- --coverage
```

### E2E tests (Playwright, `tests/e2e/`)

- Two projects: `cookies` (web `/auth/*` endpoints) and `json` (mobile `/mobile/auth/*` endpoints); set `TEST_BASE_URL` / `TEST_FRONTEND_URL` env vars
- `config-matrix.ts` defines 20 named configs (tokenDelivery x verificationMethod x mfaEnforcement x grace period); `current-config-filter.ts` reads `examples/demo-nestjs/src/config/auth.config.ts` and skips non-matching suites
- Fixtures (`fixtures.ts`) provide flows, cookie jar, and test-mode endpoints exposed by the sample app: `POST /test/reset`, `GET /test/email/latest`, `GET /test/sms/latest`, `GET /test/totp/secret`
- Specs: full auth lifecycle, deferred verification, hybrid refresh TTL, and refresh-race bug repros

```bash
pnpm test:e2e                          # all projects
npx playwright test --project json     # single project
npx playwright show-report
```

Prerequisite: `examples/demo-nestjs` running on the target URL with test mode enabled.

---

## Performance Notes (hot path)

Validated bottlenecks on authenticated requests and safe remediations:

1. **Two sequential session reads** in `AuthGuard` (TOCTOU double-check) + user load = 3 DB round-trips. Safe fix: fetch session + user in one joined query, preserving the same-snapshot guarantee.
2. **Per-request public key parsing** in `JwtService.validateAccessToken()` when RS* is configured. Safe fix: cache the parsed `crypto.KeyObject` in `prepareKeys()`.
3. **Heavy user columns on the hot path** - `getUserForAuthContext()` selects `metadata`, `backupCodes`, `passwordHistory`, `totpSecret` by default. Safe fix: `select: false` on heavy/sensitive columns, explicit `addSelect` where needed.
4. **Geo enrichment** is auxiliary - restrict to auth events rather than every request if not used in authorization decisions.

Trade-off options (not free): dropping the second session check (weakens TOCTOU), caching session validation (revocation propagation delay), stateless access tokens (no immediate revocation).

---

## Known Gaps / Roadmap

Documented or partially-built features that are **not** fully implemented:

| Gap | State |
| --- | ----- |
| `AuthModule.forRootAsync()` | Mentioned in the NestJS README but not implemented in `auth.module.ts` |
| `BLOCK_NEW` concurrent-session policy | Only `maxConcurrent` / `disallowMultipleSessions` exist |
| New-device login notification email | `EmailProvider.sendNewDeviceEmail` contract + templates exist, but core never calls it (no hook wired) |
| SQLite / MSSQL entity packages | PostgreSQL and MySQL only |
| CLI / `@nauth-toolkit/testing` package | Not started |
| Advanced rate limiting / security headers | Basic rate limiting only |

---

## Key Files

```
packages/core/src/
├── bootstrap.ts                       # NAuth.create()
├── index.ts                           # Public API exports
├── internal.ts                        # Internal exports (adapters only)
├── platform/interfaces.ts             # NAuthRequest, NAuthResponse, NAuthAdapter
├── adapters/                          # ExpressAdapter, FastifyAdapter, storage factory
├── handlers/                          # ClientInfo, Auth, Csrf, TokenDelivery
├── services/                          # Business logic (auth.service.ts is the main entry)
│   ├── auth-flow-state-machine.service.ts
│   ├── auth-flow-state-definitions.ts # 9-priority state table
│   └── ...
├── dto/                               # Request/response models (class-validator)
├── entities/                          # 12 base entity classes
├── enums/                             # Error codes, audit events, MFA methods, risk factors
├── exceptions/nauth.exception.ts      # NAuthException
├── interfaces/config.interface.ts     # NAuthConfig TypeScript types
├── schemas/auth-config.schema.ts      # Zod runtime validation
├── storage/                           # Lockout, rate limiting, memory adapter
├── templates/                         # SMS template engine
└── utils/context-storage.ts           # AsyncLocalStorage wrapper

packages/nestjs/src/
├── auth.module.ts                     # AuthModule.forRoot()
├── guards/                            # AuthGuard, CsrfGuard, NAuthContextGuard
├── interceptors/                      # NAuthContextInterceptor, CookieTokenInterceptor
└── decorators/                        # @CurrentUser, @Public, @TokenDelivery, ...

tests/e2e/                             # Playwright E2E (config matrix + fixtures)
nauth-docs/                            # Published Docusaurus site (nauth.dev)
examples/                              # demo-nestjs, demo-angular, starter-express, starter-fastify, starter-react
```
