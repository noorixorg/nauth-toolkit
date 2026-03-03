# @nauth-toolkit/client

Framework-agnostic frontend SDK for [nauth-toolkit](https://nauth.dev).

Handles authentication flows from the browser — signup, login, token refresh, MFA, social OAuth, session management. Works with React, Vue, Svelte, or any TypeScript/JavaScript frontend. Ships as both CJS and ESM.

**[Documentation](https://nauth.dev/docs/frontend-sdk)** · **[GitHub](https://github.com/noorixorg/nauth)**

> Part of [nauth-toolkit](https://www.npmjs.com/package/@nauth-toolkit/core). Works with any nauth-toolkit backend.

---

## Install

```bash
npm install @nauth-toolkit/client
```

## Quick start

```typescript
import { NAuthClient } from '@nauth-toolkit/client';

const auth = new NAuthClient({
  baseUrl: 'https://api.example.com/auth',
});

// Sign up
await auth.signup({ email: 'user@example.com', password: 'securePass1!' });

// Log in
const result = await auth.login({ email: 'user@example.com', password: 'securePass1!' });

// Get current user
const user = auth.getUser();

// Listen for auth state changes
auth.on('authStateChanged', (user) => {
  console.log('Auth state:', user);
});
```

## What's included

- **NAuthClient** — typed API client for all nauth-toolkit endpoints
- **Token management** — automatic silent refresh, pluggable storage (browser or in-memory)
- **MFA flows** — TOTP enrollment, SMS/email verification, passkey registration and authentication
- **Social OAuth** — redirect and popup flows for Google, Apple, Facebook
- **Session management** — list sessions, revoke sessions, device info
- **Challenge router** — automatic multi-step flow handling (MFA challenges, email verification)
- **Admin operations** — user management for admin-scoped tokens

---

## Angular

For Angular apps, use [`@nauth-toolkit/client-angular`](https://www.npmjs.com/package/@nauth-toolkit/client-angular) which wraps this SDK with Angular services, guards, and HTTP interceptors.

---

Free to use. See [license](https://nauth.dev/docs/license).
