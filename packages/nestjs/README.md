# @nauth-toolkit/nestjs

NestJS module for [nauth-toolkit](https://nauth.dev) — the embedded authentication library for Node.js.

Provides a `DynamicModule` with `forRoot()` / `forRootAsync()` that wires the nauth-toolkit core into NestJS dependency injection. Adds guards, decorators, and interceptors so authentication integrates with NestJS conventions.

## What's included

- **AuthModule** — `forRoot()` and `forRootAsync()` registration with full config support
- **Guards** — `AuthGuard` (JWT validation), `CsrfGuard` (CSRF token enforcement)
- **Decorators** — `@CurrentUser()`, `@Public()`, `@ClientInfo()`, `@TokenDelivery()`, `@RequireRecaptcha()`
- **Interceptors** — context management and cookie-based token delivery
- **Auto-registration** — MFA and social providers are discovered and registered at bootstrap

Requires `@nauth-toolkit/core` and a database adapter (e.g. `@nauth-toolkit/database-typeorm-postgres`). Add storage, email, SMS, MFA, and social providers as needed.

**Docs:** [nauth.dev](https://nauth.dev) · **Examples:** [github.com/noorixorg/nauth](https://github.com/noorixorg/nauth) · **Live demo:** [demo.nauth.dev](https://demo.nauth.dev)
