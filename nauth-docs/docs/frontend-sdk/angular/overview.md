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

**Package:** `@nauth-toolkit/client/angular`
**Supports:** Angular 17+

The Angular adapter provides:

- **AuthService** - Injectable wrapper around NAuthClient with Observables
- **authInterceptor** - HTTP interceptor for auth headers, CSRF, and token refresh
- **authGuard** - Route guard for protected routes
- **NAuthModule** - NgModule for non-standalone apps

## Installation

```bash npm2yarn
npm install @nauth-toolkit/client
```

## Quick Start

<Tabs groupId="angular-style">
<TabItem value="standalone" label="Standalone (Recommended)">

```typescript
// app.config.ts
import { ApplicationConfig, inject } from '@angular/core';
import { Router, provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { NAUTH_CLIENT_CONFIG, authInterceptor } from '@nauth-toolkit/client/angular';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    {
      provide: NAUTH_CLIENT_CONFIG,
      useFactory: () => {
        const router = inject(Router);
        return {
          baseUrl: 'https://api.example.com/auth',
          tokenDelivery: 'cookies',
          onSessionExpired: () => router.navigate(['/login']),
        };
      },
    },
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
import { Router } from '@angular/router';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { NAuthModule, AuthInterceptor, NAUTH_CLIENT_CONFIG } from '@nauth-toolkit/client/angular';

@NgModule({
  imports: [BrowserModule, HttpClientModule],
  providers: [
    {
      provide: NAUTH_CLIENT_CONFIG,
      useFactory: (router: Router) => ({
        baseUrl: 'https://api.example.com/auth',
        tokenDelivery: 'cookies',
        onSessionExpired: () => router.navigate(['/login']),
      }),
      deps: [Router],
    },
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
```

</TabItem>
</Tabs>

## Route Protection

```typescript
// app.routes.ts
import { Routes } from '@angular/router';
import { authGuard } from '@nauth-toolkit/client/angular';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [authGuard()],
  },
];
```

## Storage Configuration

For JSON token delivery mode, configure a storage adapter in `NAUTH_CLIENT_CONFIG`:

```typescript
import { BrowserStorage } from '@nauth-toolkit/client';

export const appConfig: ApplicationConfig = {
  providers: [
    {
      provide: NAUTH_CLIENT_CONFIG,
      useFactory: () => {
        const router = inject(Router);
        return {
          baseUrl: 'https://api.example.com/auth',
          tokenDelivery: 'json', // JSON mode requires storage
          storage: new BrowserStorage('localStorage'), // Default for web apps
          // Or use sessionStorage: new BrowserStorage('sessionStorage')
          // Or custom adapter: new MyCustomStorage()
          onSessionExpired: () => router.navigate(['/login']),
        };
      },
    },
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
};
```

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
import { AuthService } from '@nauth-toolkit/client/angular';
import { AuthResponse } from '@nauth-toolkit/client';

@Component({
  selector: 'app-login',
  template: `
    <form (ngSubmit)="login()">
      <input [(ngModel)]="email" placeholder="Email" />
      <input [(ngModel)]="password" type="password" />
      <button type="submit">Login</button>
    </form>

    @if (currentUser$ | async; as user) {
      <p>Welcome, {{ user.email }}</p>
    }
  `,
})
export class LoginComponent {
  email = '';
  password = '';
  currentUser$ = this.auth.currentUser$;

  constructor(
    private auth: AuthService,
    private router: Router,
  ) {}

  login(): void {
    this.auth.login(this.email, this.password).subscribe({
      next: (response: AuthResponse) => {
        if (response.challengeName) {
          this.router.navigate(['/verify', response.challengeName.toLowerCase()]);
        } else {
          this.router.navigate(['/dashboard']);
        }
      },
      error: (err) => console.error('Login failed:', err.message),
    });
  }
}
```

## Package Exports

| Export                | Description                          |
| --------------------- | ------------------------------------ |
| `NAUTH_CLIENT_CONFIG` | Injection token for configuration    |
| `AuthService`         | Main service wrapping NAuthClient    |
| `authInterceptor`     | Functional interceptor (Angular 17+) |
| `AuthInterceptor`     | Class interceptor (NgModule)         |
| `authGuard`           | Functional route guard               |
| `AuthGuard`           | Class route guard (NgModule)         |
| `NAuthModule`         | NgModule with `forRoot()`            |

## Related Documentation

- [AuthService API](./auth-service) - Full service reference
- [Interceptor](./interceptor) - Interceptor behavior
- [Guards](./guards) - Route guard configuration
- [Challenge Handling](../guides/challenge-handling) - Verification flows
