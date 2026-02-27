# @nauth-toolkit/client-angular

Angular SDK for [nauth-toolkit](https://nauth.dev).

Wraps the framework-agnostic `@nauth-toolkit/client` with Angular services, guards, and HTTP interceptors. Integrates with Angular dependency injection and handles token refresh, auth state, and route protection.

## What's included

- **NAuthModule** — Angular module for DI integration
- **AuthService** — reactive auth state, login, signup, logout, token refresh
- **AuthGuard** — route protection with automatic redirect
- **HTTP interceptor** — attaches tokens to outgoing requests, handles 401 refresh
- **Lazy-loadable** — ships only what your app imports

**Docs:** [nauth.dev](https://nauth.dev) · **Examples:** [github.com/noorixorg/nauth](https://github.com/noorixorg/nauth) · **Live demo:** [demo.nauth.dev](https://demo.nauth.dev)
