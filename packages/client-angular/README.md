# @nauth-toolkit/client-angular

Angular SDK for [nauth-toolkit](https://nauth.dev).

Wraps the framework-agnostic [`@nauth-toolkit/client`](https://www.npmjs.com/package/@nauth-toolkit/client) with Angular services, guards, and HTTP interceptors. Integrates with Angular dependency injection and handles token refresh, auth state, and route protection. Supports Angular 17+.

**[Documentation](https://nauth.dev/docs/frontend-sdk)** · **[GitHub](https://github.com/noorixorg/nauth)**

> Part of [nauth-toolkit](https://www.npmjs.com/package/@nauth-toolkit/core). Requires `@nauth-toolkit/client`.

---

## Install

```bash
npm install @nauth-toolkit/client @nauth-toolkit/client-angular
```

## Quick start (NgModule)

```typescript
import { NAuthModule } from '@nauth-toolkit/client-angular';

@NgModule({
  imports: [
    NAuthModule.forRoot({
      baseUrl: 'https://api.example.com/auth',
    }),
  ],
})
export class AppModule {}
```

Use the `AuthService` in your components:

```typescript
import { AuthService } from '@nauth-toolkit/client-angular';

@Component({ /* ... */ })
export class LoginComponent {
  constructor(private auth: AuthService) {}

  async login(): Promise<void> {
    await this.auth.login({ email: this.email, password: this.password });
  }
}
```

## What's included

- **NAuthModule** — Angular module with `forRoot()` configuration
- **AuthService** — reactive auth state, login, signup, logout, token refresh
- **AuthGuard** — route protection with automatic redirect
- **HTTP interceptor** — attaches tokens to outgoing requests, handles 401 refresh
- **Social redirect guard** — handles OAuth callback routes
- **reCAPTCHA service** — Angular-integrated reCAPTCHA token generation

---

## Framework-agnostic

For non-Angular frontends (React, Vue, Svelte), use [`@nauth-toolkit/client`](https://www.npmjs.com/package/@nauth-toolkit/client) directly.

---

Free to use. See [license](https://nauth.dev/docs/license).
