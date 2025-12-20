# nauth-toolkit Architecture

**Version:** 0.1.0 | **Status:** Development | **Updated:** 2025-12-05

---

## Core Principle

Zero framework dependencies. Pure TypeScript with constructor injection. Platform abstraction via `NAuthRequest`/`NAuthResponse` interfaces.

---

## Packages

| Package                                    | Purpose                                                     |
| ------------------------------------------ | ----------------------------------------------------------- |
| `@nauth-toolkit/core`                      | Auth services, JWT, sessions, universal bootstrap, adapters |
| `@nauth-toolkit/nestjs`                    | NestJS guards, interceptors, decorators, modules            |
| `@nauth-toolkit/database-typeorm-postgres` | PostgreSQL entities                                         |
| `@nauth-toolkit/database-typeorm-mysql`    | MySQL entities                                              |
| `@nauth-toolkit/storage-database`          | Database storage adapter                                    |
| `@nauth-toolkit/storage-redis`             | Redis storage adapter                                       |
| `@nauth-toolkit/email-*`                   | Email providers (console, nodemailer)                       |
| `@nauth-toolkit/sms-*`                     | SMS providers (console, aws-sns)                            |
| `@nauth-toolkit/social-*`                  | OAuth providers (google, apple, facebook)                   |
| `@nauth-toolkit/mfa-*`                     | MFA providers (totp, sms, email, passkey)                   |

---

## Platform Abstraction

```typescript
// Generic interfaces - handlers operate on these, NOT raw req/res
interface NAuthRequest {
  method: string;
  path: string;
  url: string;
  body: any;
  query: any;
  params: any;
  headers: Record<string, string | string[] | undefined>;
  cookies: Record<string, string | undefined>;
  ip: string;
  attributes: NAuthRequestAttributes;
  raw: any; // Escape hatch (avoid using)
  getHeader(name: string): string | undefined;
}

interface NAuthResponse {
  raw: any;
  status(code: number): this;
  header(name: string, value: string): this;
  setCookie(name: string, value: string, options?: NAuthCookieOptions): this;
  clearCookie(name: string, options?: NAuthCookieOptions): this;
  send(body: any): void;
  json(body: any): void;
  redirect(url: string, status?: number): void;
  isSent(): boolean;
}

interface NAuthAdapter {
  name: string;
  registerMiddleware(name: string, handler: NAuthMiddlewareHandler): any;
  registerResponseInterceptor(handler: NAuthResponseInterceptorHandler): any;
  wrapRouteHandler<T>(handler: NAuthRouteHandler<T>): any;
}
```

**Adapters handle:** Request/response wrapping, AsyncLocalStorage context management, framework-specific conversions.

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

// Routes
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

// Hooks (order matters)
fastify.addHook('onRequest', nauth.middleware.clientInfo); // FIRST
fastify.addHook('onRequest', nauth.middleware.csrf);
fastify.addHook('onRequest', nauth.middleware.auth);
fastify.addHook('onSend', nauth.middleware.tokenDelivery);

// Routes - wrap with nauth.adapter.wrapRouteHandler for context access
fastify.post(
  '/signup',
  { preHandler: nauth.helpers.public() },
  nauth.adapter.wrapRouteHandler(async (req) => nauth.authService.signup(req.body as any)),
);
fastify.get(
  '/profile',
  { preHandler: nauth.helpers.requireAuth() },
  nauth.adapter.wrapRouteHandler(async () => ({ user: nauth.helpers.getCurrentUser() })),
);
```

### NestJS

```typescript
import { AuthModule } from '@nauth-toolkit/nestjs';
import { GoogleSocialAuthModule } from '@nauth-toolkit/social-google/nestjs';

@Module({
  imports: [
    TypeOrmModule.forRoot({ entities: getNAuthEntities() }),
    AuthModule.forRoot(config),
    GoogleSocialAuthModule,
  ],
})
export class AppModule {}
```

---

## Context Storage (AsyncLocalStorage)

| Key               | Contents                               |
| ----------------- | -------------------------------------- |
| `CLIENT_INFO`     | IP, user agent, device info, sessionId |
| `CURRENT_USER`    | Authenticated user object              |
| `CURRENT_SESSION` | Session ID                             |
| `JWT_PAYLOAD`     | Token payload                          |

**Flow:** `ClientInfoHandler` → `CsrfHandler` → `AuthHandler` → Route handler

**Express:** Context propagates automatically.
**Fastify:** Context stored on `request.__nauthContextStore`, restored by adapters. Use `nauth.adapter.wrapRouteHandler()` for route handlers.

---

## Services

| Category      | Services                                                                   |
| ------------- | -------------------------------------------------------------------------- |
| **Auth**      | `AuthService`, `PasswordService`, `JwtService`, `SessionService`           |
| **Verify**    | `EmailVerificationService`, `PhoneVerificationService`                     |
| **MFA**       | `MFAService` + provider packages                                           |
| **Social**    | `SocialAuthService`, `SocialProviderRegistry`                              |
| **Challenge** | `ChallengeService`, `AuthChallengeHelperService`                           |
| **Risk**      | `RiskDetectionService`, `RiskScoringService`, `AdaptiveMFADecisionService` |
| **Storage**   | `RateLimitStorageService`, `AccountLockoutStorageService`                  |
| **Context**   | `ClientInfoService`, `ContextStorage`                                      |
| **Audit**     | `AuthAuditService`                                                         |

---

## Entities

Base entities in core (fields + logic). Database packages extend with ORM decorators.

| Entity                             | Purpose                     |
| ---------------------------------- | --------------------------- |
| `BaseUser`                         | User accounts               |
| `BaseSession`                      | Active sessions             |
| `BaseLoginAttempt`                 | Login history               |
| `BaseVerificationToken`            | Email/phone verification    |
| `BaseSocialAccount`                | OAuth linked accounts       |
| `BaseChallengeSession`             | MFA/verification challenges |
| `BaseMFADevice`                    | Enrolled MFA devices        |
| `BaseAuthAudit`                    | Audit trail                 |
| `BaseRateLimit`, `BaseStorageLock` | Storage entities            |

Use `getNAuthEntities()` for TypeORM config. Add `getNAuthTransientStorageEntities()` if using DatabaseStorageAdapter.

---

## Challenge System

Challenges are HTTP 200 responses, not errors. Single endpoint: `respondToChallenge()`.

| Type                    | Priority | Trigger          |
| ----------------------- | -------- | ---------------- |
| `FORCE_CHANGE_PASSWORD` | 1        | Admin action     |
| `VERIFY_EMAIL`          | 2        | Unverified email |
| `VERIFY_PHONE`          | 3        | Unverified phone |
| `MFA_SETUP_REQUIRED`    | 4        | MFA enforcement  |
| `MFA_REQUIRED`          | 5        | MFA verification |

---

## Token Delivery

| Mode      | Behavior                               |
| --------- | -------------------------------------- |
| `json`    | Tokens in response body only           |
| `cookies` | Tokens in httpOnly cookies only        |
| `hybrid`  | Auto-detect (web=cookies, mobile=json) |

Override per-route: `nauth.helpers.tokenDelivery('cookies')` or `@TokenDelivery('cookies')`

---

## CSRF Protection

Auto-enabled for `cookies`/`hybrid` modes.

- Server sets httpOnly cookie: `nauth_csrf_token`
- Client sends header: `X-CSRF-Token`
- Skips GET, HEAD, OPTIONS

Bypass: `nauth.helpers.public()` or `@Public()`

---

## Storage Adapters

| Adapter                  | Use Case                |
| ------------------------ | ----------------------- |
| `MemoryStorageAdapter`   | Dev/testing only        |
| `DatabaseStorageAdapter` | Low-traffic production  |
| `RedisStorageAdapter`    | High-traffic production |

Used for: Rate limits, account lockout, token reuse detection, distributed locks.

---

## JWT

**Library:** `jose` (platform-agnostic)

| Setting           | Default           |
| ----------------- | ----------------- |
| Algorithm         | HS256 (symmetric) |
| Access token TTL  | 15m               |
| Refresh token TTL | 7d                |

Supported: HS256/384/512 (symmetric), RS256/384/512 (asymmetric)

---

## MFA Providers

| Provider                     | Method             |
| ---------------------------- | ------------------ |
| `@nauth-toolkit/mfa-totp`    | Authenticator apps |
| `@nauth-toolkit/mfa-sms`     | SMS codes          |
| `@nauth-toolkit/mfa-email`   | Email codes        |
| `@nauth-toolkit/mfa-passkey` | WebAuthn/FIDO2     |

**Enforcement:** `REQUIRED` | `OPTIONAL` | `ADAPTIVE` (risk-based)

---

## Adaptive MFA (Risk-Based)

| Risk Factor         | Weight |
| ------------------- | ------ |
| New device          | High   |
| New IP              | Medium |
| New location        | Medium |
| Impossible travel   | High   |
| Suspicious activity | High   |

**Actions:** Allow → Require MFA → Block sign-in

---

## Key Files

```
packages/core/src/
├── bootstrap.ts              # NAuth.create()
├── platform/interfaces.ts    # NAuthRequest, NAuthResponse, NAuthAdapter
├── adapters/                 # ExpressAdapter, FastifyAdapter
├── handlers/                 # ClientInfo, Auth, Csrf, TokenDelivery
├── services/                 # Core business logic
├── entities/                 # Base entity classes
├── interfaces/config.interface.ts  # Config schema (Zod)
└── utils/context-storage.ts  # AsyncLocalStorage wrapper

packages/nestjs/src/
├── auth.module.ts            # NestJS module
├── guards/auth.guard.ts      # Authentication guard
└── interceptors/             # ClientInfo, CookieToken, CSRF

examples/
├── sample-express/           # Express example
├── sample-fastify/           # Fastify example (native, no @fastify/express)
└── sample-app/               # NestJS example
```

---

## Creating Custom Adapters

Implement `NAuthAdapter` interface:

```typescript
class KoaAdapter implements NAuthAdapter {
  name = 'koa';
  registerMiddleware(name, handler) {
    return async (ctx, next) => {
      const req = new KoaRequestWrapper(ctx.request);
      const res = new KoaResponseWrapper(ctx.response);
      await handler(req, res, next);
    };
  }
  registerResponseInterceptor(handler) {
    /* ... */
  }
  wrapRouteHandler(handler) {
    /* ... */
  }
}
```

---

## Config Validation

Zod schemas validate at runtime. Fails fast with clear errors.

**Required combinations:**

- Email verification → `emailProvider`
- Phone verification → `smsProvider`
- MFA SMS → `smsProvider`
- MFA ADAPTIVE → `mfa.enabled` + `mfa.adaptive`
- JWT asymmetric → `privateKey` + `publicKey`
