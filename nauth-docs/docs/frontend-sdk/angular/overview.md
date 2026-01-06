---
title: Angular Overview
description: Angular integration guide for nauth-toolkit client SDK
sidebar_position: 1
keywords: [angular, integration, service, interceptor, guard]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Angular Integration

**Package:** `@nauth-toolkit/client-angular`
**Supports:** Angular 17+ (both NgModule and Standalone)

The Angular adapter provides a single package with two entry points:

- **`@nauth-toolkit/client-angular`** - NgModule-based apps
- **`@nauth-toolkit/client-angular/standalone`** - Standalone components

## Features

- **Dual Entry Points** - Choose based on your app architecture (NgModule or Standalone)
- **AuthService** - Injectable wrapper around NAuthClient with RxJS Observables
- **HTTP Interceptor** - Automatic token refresh, CSRF handling, session management
- **Route Guards** - Protect routes with authentication checks
- **NAuthModule** - Easy setup for NgModule-based apps with `forRoot()`
- **Forward Compatible** - Built with Angular 17, works with Angular 17+

## Installation

```bash npm2yarn
npm install @nauth-toolkit/client @nauth-toolkit/client-angular
```

> **Note:** You need both packages - `@nauth-toolkit/client` (core) and `@nauth-toolkit/client-angular` (Angular adapter).

## Quick Start

<Tabs groupId="angular-style">
<TabItem value="standalone" label="Standalone (Recommended)">

```typescript
// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  NAUTH_CLIENT_CONFIG,
  AuthService,
  AngularHttpAdapter,
  authInterceptor,
} from '@nauth-toolkit/client-angular/standalone';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    {
      provide: NAUTH_CLIENT_CONFIG,
      useValue: {
        baseUrl: 'https://api.example.com/auth',
        tokenDelivery: 'cookies',
      },
    },
    AngularHttpAdapter,
    AuthService,
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
};
```

```typescript
// main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

bootstrapApplication(AppComponent, appConfig);
```

</TabItem>
<TabItem value="ngmodule" label="NgModule">

```typescript
// app.module.ts
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { NAuthModule } from '@nauth-toolkit/client-angular';

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    NAuthModule.forRoot({
      baseUrl: 'https://api.example.com/auth',
      tokenDelivery: 'cookies',
    }),
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
```

</TabItem>
</Tabs>

## Route Protection

<Tabs groupId="angular-routes">
<TabItem value="standalone-routes" label="Standalone">

```typescript
// app.routes.ts
import { Routes } from '@angular/router';
import { authGuard } from '@nauth-toolkit/client-angular/standalone';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [authGuard()],
  },
];
```

</TabItem>
<TabItem value="ngmodule-routes" label="NgModule">

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
  providers: [AuthGuard],
})
export class AppRoutingModule {}
```

</TabItem>
</Tabs>

## Storage Configuration

For JSON token delivery mode, configure a storage adapter:

<Tabs groupId="angular-storage">
<TabItem value="standalone-storage" label="Standalone">

```typescript
import { BrowserStorage } from '@nauth-toolkit/client';

export const appConfig: ApplicationConfig = {
  providers: [
    {
      provide: NAUTH_CLIENT_CONFIG,
      useValue: {
        baseUrl: 'https://api.example.com/auth',
        tokenDelivery: 'json', // JSON mode requires storage
        storage: new BrowserStorage('localStorage'), // Default for web
      },
    },
    AngularHttpAdapter,
    AuthService,
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
};
```

</TabItem>
<TabItem value="ngmodule-storage" label="NgModule">

```typescript
import { BrowserStorage } from '@nauth-toolkit/client';

@NgModule({
  imports: [
    BrowserModule,
    NAuthModule.forRoot({
      baseUrl: 'https://api.example.com/auth',
      tokenDelivery: 'json',
      storage: new BrowserStorage('localStorage'),
    }),
  ],
})
export class AppModule {}
```

</TabItem>
</Tabs>

**Storage Options:**

- `BrowserStorage('localStorage')` - Persistent storage (default for web apps)
- `BrowserStorage('sessionStorage')` - Session-only storage
- `InMemoryStorage` - In-memory storage (for SSR or testing)
- Custom adapter - Implement [`NAuthStorageAdapter`](../api/types/nauth-storage-adapter) for mobile apps (Capacitor, React Native)

**Note:** For `cookies` mode, tokens are managed by the browser and backend—no storage adapter needed.

See [`NAuthStorageAdapter`](../api/types/nauth-storage-adapter) for interface details and custom implementation examples.

## Basic Usage

```typescript
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@nauth-toolkit/client-angular';
// Or for standalone: '@nauth-toolkit/client-angular/standalone'

@Component({
  selector: 'app-login',
  template: `
    <form (ngSubmit)="login()">
      <input [(ngModel)]="email" placeholder="Email" />
      <input [(ngModel)]="password" type="password" />
      <button type="submit">Login</button>
    </form>

    @if (auth.isAuthenticated()) {
      <p>Welcome, {{ auth.currentUser?.email }}</p>
    }
  `,
})
export class LoginComponent {
  email = '';
  password = '';

  constructor(
    public auth: AuthService,
    private router: Router,
  ) {}

  async login(): Promise<void> {
    try {
      const response = await this.auth.login(this.email, this.password);
      if (response.challengeName) {
        this.router.navigate(['/verify', response.challengeName.toLowerCase()]);
      } else {
        this.router.navigate(['/dashboard']);
      }
    } catch (error) {
      console.error('Login failed:', error);
    }
  }
}
```

## Package Exports

### Default Export (`@nauth-toolkit/client-angular`)

For NgModule-based applications:

| Export                 | Description                       |
| ---------------------- | --------------------------------- |
| `NAUTH_CLIENT_CONFIG`  | Injection token for configuration |
| `NAuthModule`          | NgModule with `forRoot()`         |
| `AuthService`          | Main service wrapping NAuthClient |
| `AngularHttpAdapter`   | HTTP client adapter               |
| `AuthInterceptorClass` | Class-based HTTP interceptor      |
| `AuthGuard`            | Class-based route guard           |

### Standalone Export (`@nauth-toolkit/client-angular/standalone`)

For standalone component applications:

| Export                        | Description                       |
| ----------------------------- | --------------------------------- |
| `NAUTH_CLIENT_CONFIG`         | Injection token for configuration |
| `AuthService`                 | Main service wrapping NAuthClient |
| `AngularHttpAdapter`          | HTTP client adapter               |
| `authInterceptor`             | Functional HTTP interceptor       |
| `authGuard`                   | Functional route guard            |
| `socialRedirectCallbackGuard` | OAuth callback guard              |

## Related Documentation

- [AuthService API](./auth-service) - Full service reference
- [Interceptor](./interceptor) - Interceptor behavior
- [Guards](./guards) - Route guard configuration
- [Challenge Handling](../guides/challenge-handling) - Verification flows
