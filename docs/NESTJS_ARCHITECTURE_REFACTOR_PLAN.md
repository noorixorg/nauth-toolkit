# NestJS Architecture Refactor

**Date**: 2025-12-23
**Status**: Planning

---

## Problem

1. Repository injections scattered across `AuthGuard`, `AuthHandler`, multiple services
2. Auth logic duplicated between core `AuthHandler` and NestJS `AuthGuard`
3. NestJS interceptors run after guards, so guards cannot safely use `ContextStorage` (it throws unless `ContextStorage.run()` has already executed)
4. `hasPasswordHash` is derived in the NestJS `AuthGuard`, but is not consistently available across platforms (core `AuthHandler` does not derive it), and the derivation logic is duplicated
5. Framework layer doing business logic instead of delegating to services

**Current**: Guards directly query database, validate tokens, check sessions (100+ lines of business logic in framework layer)

---

## Solution

**Service-First Architecture**: Services own all business logic and repository access. Handlers coordinate services. Guards only enforce policies.
Cannot introduce Express/Fastify coupling into core. Follow the existing `NAuthRequest` / `NAuthResponse` abstractions and the context contract defined in the core adapters.
---

## Changes Required

### Key Feasibility Note (Fastify)

The sample Nest app (`examples/sample-nestjs`) uses `@nestjs/platform-fastify`. Nest "middleware" is not consistently supported across adapters the same way Express middleware is. So the plan MUST avoid relying on `NestMiddleware` to run before guards.

**Feasible approach:** Mirror the core `FastifyAdapter` pattern:
- Initialize a per-request `ContextStorage` store EARLY in a **global guard** (runs before route guards).
- Persist the store on the raw request object.
- Re-enter that store in a small **global interceptor** so controllers/services execute inside the same AsyncLocalStorage context.

This avoids Express/Fastify coupling while still guaranteeing context availability for both guards and controllers.

### Core Package

**`packages/core/src/services/auth.service.ts`**
- Add `getUserForAuthContext(sub: string)` method
- Selects all user fields INCLUDING `passwordHash`
- Derives `hasPasswordHash = Boolean(passwordHash)`
- Deletes `passwordHash`, `totpSecret`, `backupCodes`, `passwordHistory` before returning
- Returns safe user object with boolean flag, no sensitive data

**`packages/core/src/handlers/auth.handler.ts`**
- Replace `userRepository` injection with `authService` injection
- Replace `findOne()` call with `authService.getUserForAuthContext()`
- Delete `getUserSelectFields()` method entirely
- Remove TypeORM/Repository imports

**`packages/core/src/bootstrap.ts`**
- Update `AuthHandler` instantiation to pass `authService` instead of `userRepository`

### NestJS Package

#### AsyncLocalStorage Context Initialization (NEW)

**`packages/nestjs/src/guards/nauth-context.guard.ts`** (NEW, `APP_GUARD`)
- Runs FIRST for HTTP requests.
- Creates a new AsyncLocalStorage store using `ContextStorage.run(...)`.
- Stores the created store on the raw request object (use a `Symbol.for('nauth.contextStore')` key to avoid collisions).
- Extracts and stores client info into the store (equivalent to core `ClientInfoHandler` behavior), including:
  - IP, user agent
  - device token (cookie/header)
  - optional geolocation (if `GeoLocationService` is available)
- Stores `HTTP_RESPONSE` in the context (for services that need response access, e.g., cookie clearing).
- Does NOT validate JWT or check sessions (keeps this guard focused on context + client metadata).

**`packages/nestjs/src/interceptors/nauth-context.interceptor.ts`** (NEW, `APP_INTERCEPTOR`)
- Re-enters the stored AsyncLocalStorage store using `ContextStorage.enterStore(store, ...)`
- Wraps `next.handle()` so controllers/services run inside the same request store.
- NO business logic besides context restoration.

**Replace/Delete**
- Remove `ClientInfoInterceptor` usage from `AuthModule` (`APP_INTERCEPTOR` provider).
- Delete:
  - `packages/nestjs/src/interceptors/client-info.interceptor.ts`
  - `packages/nestjs/src/interceptors/client-info.interceptor.spec.ts`

Rationale:
- Interceptors run after guards, so a pure-interceptor `ContextStorage.run()` prevents guards from safely calling `ContextStorage.set()` (it throws outside a context).
- The guard+interceptor pattern makes context available for both guards AND controllers, and works with Fastify like the core `FastifyAdapter` does.

**`packages/nestjs/src/guards/auth.guard.ts`**
- Remove `UserRepository` injection and ALL direct database access.
- Load user via `AuthService.getUserForAuthContext()` (service-first).
- Wrap all auth work inside `ContextStorage.enterStore(request[NAUTH_CONTEXT_STORE], ...)` so it can safely set:
  - `CURRENT_USER`
  - `CURRENT_SESSION`
  - `JWT_PAYLOAD`
- Keep route policy/enforcement in the guard:
  - Check `@Public()` and bypass if public
  - Enforce token delivery source rules based on `@TokenDelivery()` + hybrid policy (this requires `Reflector`)
  - If token missing: throw `TOKEN_INVALID` or `AUTH_REQUIRED` according to current behavior (preserve semantics)
  - If token invalid/session invalid: throw the same `NAuthException` codes as today

Note:
- The existing guard already derives `hasPasswordHash`; after refactor, that derivation should move into `AuthService.getUserForAuthContext()` so ALL platforms (core + NestJS) get consistent `hasPasswordHash` without exposing `passwordHash`.

**`packages/nestjs/src/auth.module.ts`**
- Remove `ClientInfoInterceptor` from `APP_INTERCEPTOR` providers
- Add:
  - `APP_GUARD` → `NAuthContextGuard` (must run before other guards)
  - `APP_INTERCEPTOR` → `NAuthContextInterceptor` (restores context for controllers)
- Simplify `AuthGuard` provider (remove repository injections)

### Sample App

No change required if `AuthModule` registers the guard/interceptor globally.

If any consumer wants full manual control, they can override global providers, but the default should be zero-config like the core bootstrap.

---

## Testing

**Core**: `yarn workspace @nauth-toolkit/core test`
**NestJS**: `yarn workspace @nauth-toolkit/nestjs test`
**Manual**: Signup (password/social), login, forgot password, MFA flows, `@CurrentUser()` includes `hasPasswordHash`

---

## Documentation

Update without "migration" language - write as current state:
- `docs/ARCHITECTURE.md` - NestJS section with middleware setup
- `nauth-docs/docs/guides/` - NestJS setup guide

---

## Success Criteria

- AuthService owns all user operations (no repos outside services)
- AuthGuard is thin (enforcement only; delegates validation/loading to services/handlers)
- `@CurrentUser()` includes `hasPasswordHash: boolean`
- All existing features work unchanged
- NestJS pattern matches core architecture (middleware → services → enforcement)

Clarification:
- In NestJS, the “middleware” role is fulfilled by **NAuthContextGuard + NAuthContextInterceptor** to ensure compatibility with Fastify and to preserve AsyncLocalStorage across the request lifecycle.

---


