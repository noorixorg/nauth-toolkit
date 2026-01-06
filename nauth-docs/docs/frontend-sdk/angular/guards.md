---
title: Guards
description: Angular route guards for authentication
sidebar_position: 4
keywords: [angular, guard, route, authentication]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Route Guards

**Package:** `@nauth-toolkit/client-angular`

Route guards for protecting routes based on authentication.

## Available Guards

| Guard       | Type            | Description                       |
| ----------- | --------------- | --------------------------------- |
| `authGuard` | `CanActivateFn` | Requires authentication           |
| `AuthGuard` | `class`         | Class-based auth guard (NgModule) |

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

Functional guard factory that redirects unauthenticated users to `/login`.

:::important Call the Function
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

### Behavior

1. Checks `AuthService.isAuthenticated()` synchronously
2. If authenticated → allows navigation
3. If not authenticated → redirects to `/login`

### Custom Login Route

The default redirect is `/login`. To customize:

```typescript
// Create custom guard with different redirect
export const customAuthGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isAuthenticated()) {
    return true;
  }

  // Custom redirect with return URL
  return router.createUrlTree(['/signin'], {
    queryParams: { returnUrl: state.url },
  });
};
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

## Related APIs

- [AuthService](./auth-service) - Authentication service
- [Interceptor](./interceptor) - HTTP interceptor
