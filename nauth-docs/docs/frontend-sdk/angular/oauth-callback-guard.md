---
title: Social Redirect Callback Guard
description: Drop-in route guard for handling redirect-first web social login callbacks
sidebar_position: 50
keywords: [social, oauth, guard, redirect, callback, route, angular]
image: /img/api-social-card.png
---

# Social Redirect Callback Guard

**Package:** `@nauth-toolkit/client-angular`
**Type:** Route Guard

Drop-in route guard for the redirect-first social flow. It supports:

- Cookies mode: backend sets cookies before redirecting back; guard redirects to `redirects.success`
- JSON/hybrid (and cookies-with-challenge): backend redirects back with `exchangeToken`; guard exchanges it and redirects

```typescript
import { socialRedirectCallbackGuard } from '@nauth-toolkit/client-angular';
```

## Overview

The `socialRedirectCallbackGuard` eliminates the need to write custom callback logic. Add it to your callback route and it handles:

- Detecting `exchangeToken` or provider errors in the callback URL
- Completing authentication via backend exchange (`POST /auth/social/exchange`)
- Redirecting to success/challenge/error pages

## Basic Usage

```typescript
// app.routes.ts
import { Routes } from '@angular/router';
import { socialRedirectCallbackGuard } from '@nauth-toolkit/client-angular';

export const routes: Routes = [
  {
    path: 'auth/callback',
    canActivate: [socialRedirectCallbackGuard],
    children: [], // Guard-only callback route
  },
  {
    path: 'home',
    component: HomeComponent,
  },
  {
    path: 'auth/challenge/:type',
    component: ChallengeComponent,
  },
];
```

## Default Behavior

| Scenario                  | Redirect                          |
| ------------------------- | --------------------------------- |
| Authentication successful | `/` (root)                        |
| Challenge required        | `/auth/challenge/:challengeName`  |
| OAuth error               | `/login`                          |
| Not an OAuth callback     | Redirect to `redirects.success`   |

## Custom Configuration

Configure redirect URLs using the unified `NAUTH_CLIENT_CONFIG`:

```typescript
// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { NAUTH_CLIENT_CONFIG, type NAuthClientConfig } from '@nauth-toolkit/client-angular';

export const appConfig: ApplicationConfig = {
  providers: [
    {
      provide: NAUTH_CLIENT_CONFIG,
      useValue: {
        baseUrl: 'https://api.example.com/auth',
        tokenDelivery: 'cookies',
        redirects: {
          success: '/home', // Common redirect for all successful auth
          challengeBase: '/auth/verify',
          oauthError: '/login?error=oauth',
      },
      } satisfies NAuthClientConfig,
    },
  ],
};
```

## Configuration Options

The guard uses `NAUTH_CLIENT_CONFIG.redirects` for routing:

| Property        | Type     | Default           | Description                                             |
| --------------- | -------- | ----------------- | ------------------------------------------------------- |
| `success`       | `string` | `'/'`             | Redirect URL on successful authentication (login, signup, or OAuth) |
| `challengeBase` | `string` | `'/auth/challenge'` | Base URL for challenge routes (challenge type appended) |
| `oauthError`    | `string` | `'/login'`        | Redirect URL on OAuth error                             |

## How It Works

```mermaid
sequenceDiagram
    participant OAuth as OAuth Provider
    participant Backend as NAuth Backend
    participant App as Your App
    participant Guard as socialRedirectCallbackGuard

    OAuth->>Backend: Callback (provider -> backend)
    Backend->>App: 302 Redirect<br/>/auth/callback?exchangeToken=...
    App->>Guard: canActivate()
    Guard->>Guard: Detect exchangeToken
    Guard->>Backend: POST /auth/social/exchange
    Backend-->>Guard: AuthResponse

    alt No Challenge
        Guard->>App: Navigate to success URL (from config.redirects.success)
    else Challenge Required
        Guard->>App: Navigate to /auth/challenge/:type
    end
```

## Event Integration

The guard works seamlessly with the [AuthService observables](./auth-service#observables):

```typescript
@Component({
  selector: 'app-root',
  template: `...`,
})
export class AppComponent implements OnInit {
  constructor(private auth: AuthService) {}

  ngOnInit(): void {
    // Listen to OAuth completion
    this.auth.authEvents$.pipe(filter((e) => e.type === 'oauth:completed')).subscribe((event) => {
      const response = event.data as AuthResponse;
      this.toastr.success(`Welcome, ${response.user?.firstName}!`);
    });

    // Listen to OAuth errors
    this.auth.authError$.subscribe((event) => {
      this.toastr.error(event.data.message);
    });
  }
}
```

## Related

- [Social Authentication Guide](/docs/frontend-sdk/guides/social-auth) - Complete social auth guide
- [`NAuthClient.loginWithSocial()`](../api/nauth-client#loginwithsocial) - Initiate OAuth flow
- [`NAuthClientConfig`](../api/nauth-client-config#redirect-urls) - Configuration with redirect URLs
