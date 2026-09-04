---
title: Guards
description: Angular route guards for authentication
keywords: [angular, guard, route, authentication]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Route Guards

**Package:** `@nauth-toolkit/client-angular`

Route guards for protecting routes based on authentication.

## Available Guards

| Guard             | Type            | Description                                                |
| ----------------- | --------------- | ---------------------------------------------------------- |
| `authGuard`       | `CanActivateFn` | Requires authentication                                     |
| `AuthGuard`       | `class`         | Class-based auth guard (NgModule)                           |
| `oidcReturnGuard` | `CanActivateFn` | Returns a user to a pending OpenID Connect request          |

## Setup

<Tabs groupId="angular-style">
<TabItem value="standalone" label="Standalone (Angular 17+)">

```typescript
// app.routes.ts
import { Routes } from '@angular/router';
import { authGuard } from '@nauth-toolkit/client-angular';

export const routes: Routes = [
  // Public routes
  { path: '', component: HomeComponent },
  { path: 'login', component: LoginComponent },

  // Protected routes (authenticated users)
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [authGuard()],
  },
  {
    path: 'profile',
    component: ProfileComponent,
    canActivate: [authGuard()],
  },
];
```

</TabItem>
<TabItem value="ngmodule" label="NgModule">

```typescript
// app-routing.module.ts
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from '@nauth-toolkit/client-angular';

const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [AuthGuard],
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
```

</TabItem>
</Tabs>

## authGuard

Functional guard factory that redirects unauthenticated users to the configured `redirects.sessionExpired` route, or `/login` by default.

:::important[Call the Function]
`authGuard` is a **factory function** that must be called with `()` to return the guard function:

```typescript
canActivate: [authGuard()]; //  Correct - calls the factory
canActivate: [authGuard]; //  Wrong - passes the factory itself
```

:::

```typescript
import { authGuard } from '@nauth-toolkit/client-angular';

const routes: Routes = [
  {
    path: 'protected',
    component: ProtectedComponent,
    canActivate: [authGuard()],
  },
];
```

### Signature

```typescript
function authGuard(redirectTo?: string): CanActivateFn
```

| Parameter    | Type     | Description                                                                                                    |
| ------------ | -------- | -------------------------------------------------------------------------------------------------------------- |
| `redirectTo` | `string` | Optional path to redirect to when not authenticated. Overrides `redirects.sessionExpired` for this route only. |

### Behavior

1. Checks `AuthService.isAuthenticated()` synchronously
2. If authenticated → allows navigation
3. If not authenticated → redirects to `redirectTo` if provided, else `redirects.sessionExpired` from config, else `/login`

### Custom Redirect per Route

Pass an optional `redirectTo` argument to override the config for a specific route:

```typescript
const routes: Routes = [
  {
    path: 'admin',
    component: AdminComponent,
    canActivate: [authGuard('/admin/login')],
  },
];
```

The optional `redirectTo` parameter overrides the `redirects.sessionExpired` config for that specific route. Example: `authGuard('/custom-login')`.

### Global Redirect Configuration

Set `redirects.sessionExpired` in your module config to apply a default redirect to all guards:

```typescript
NAuthModule.forRoot({
  baseUrl: 'https://api.example.com/auth',
  tokenDelivery: 'cookies',
  redirects: {
    sessionExpired: '/login?expired=true',
  },
})
```

## Lazy Loading with Guards

```typescript
const routes: Routes = [
  {
    path: 'admin',
    canActivate: [authGuard()],
    loadChildren: () => import('./admin/admin.module').then((m) => m.AdminModule),
  },
];
```

## Challenge-Aware Guard

Redirect to appropriate challenge page if user has pending challenge:

```typescript
export const challengeAwareGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  // Check if there's a pending challenge
  const challenge = auth.getCurrentChallenge();
  if (challenge?.challengeName) {
    switch (challenge.challengeName) {
      case 'VERIFY_EMAIL':
        return router.createUrlTree(['/verify-email']);
      case 'VERIFY_PHONE':
        return router.createUrlTree(['/verify-phone']);
      case 'MFA_REQUIRED':
        return router.createUrlTree(['/mfa']);
      case 'MFA_SETUP_REQUIRED':
        return router.createUrlTree(['/mfa-setup']);
      case 'FORCE_CHANGE_PASSWORD':
        return router.createUrlTree(['/change-password']);
    }
  }

  // No challenge, proceed with normal auth check
  if (auth.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login']);
};
```

## oidcReturnGuard

Returns a user to a pending OpenID Connect authorization request after they finish signing in. Only relevant when your application is itself an [OpenID Connect provider](/docs/guides/oauth-provider/how-oauth-provider-works).

When a third-party application starts an authorization request and the user is not signed in, the consent page stashes the request id and sends them to login. Your challenge chain then runs — possibly several steps of it — and lands the user wherever your app puts people after login. This guard intercepts that landing and sends them back to finish the authorization request.

### Signature

```typescript
function oidcReturnGuard(interactionPath?: string): CanActivateFn
```

`interactionPath` defaults to the client config's `oidc.interactionPath`, which itself defaults to `/interaction`.

### Usage

```typescript title="src/app/app.routes.ts"
import { authGuard, oidcReturnGuard } from '@nauth-toolkit/client-angular/standalone';

export const routes: Routes = [
  {
    path: 'dashboard',
    loadComponent: () => import('./dashboard/dashboard.component').then((m) => m.DashboardComponent),
    canActivate: [authGuard(), oidcReturnGuard()],
  },
];
```

Put it on every route a freshly logged-in user can land on. It consumes the stash, so a later visit to the same route is not diverted a second time.

:::tip[You may not need it]
If your app lets the SDK drive navigation, the `navigationHandler` config option is a single chokepoint that does the same job without touching your routes. Reach for the guard when your own challenge components call `router.navigate()` themselves — a common pattern, and one that bypasses `navigationHandler` entirely. See [Building the Consent Screen](/docs/guides/oauth-provider/consent-screen#returning-after-login).
:::

## Related APIs

- [AuthService](./auth-service) - Authentication service
- [Interceptor](./interceptor) - HTTP interceptor
- [OIDCOperations](../api/oidc-operations) - What the guard reads its stash from
