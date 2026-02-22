---
title: Standalone Setup
description: Set up nauth-toolkit in Angular standalone component applications
keywords: [angular, standalone, setup, providers, interceptor, configuration]
image: /img/api-social-card.png
sidebar_position: 1
---

# Standalone Setup

Set up `@nauth-toolkit/client-angular` in an Angular application using standalone components (Angular 17+).

:::note Sample Application
A complete working example is available at [github.com/noorixorg/nauth/tree/main/angular](https://github.com/noorixorg/nauth/tree/main/angular) — Angular standalone + `@nauth-toolkit/client-angular` paired with the NestJS backend example.
:::

## Installation

```bash npm2yarn
npm install @nauth-toolkit/client @nauth-toolkit/client-angular
```

## Configure Providers

Register the SDK in your application config:

```typescript title="src/app/app.config.ts"
import { ApplicationConfig, inject } from '@angular/core';
import { Router, provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  NAUTH_CLIENT_CONFIG,
  AuthService,
  AngularHttpAdapter,
  authInterceptor,
} from '@nauth-toolkit/client-angular/standalone';
import { routes } from './app.routes';

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
          csrf: {
            cookieName: 'nauth_csrf_token',
            headerName: 'x-csrf-token',
          },
          redirects: {
            loginSuccess: '/dashboard',
            sessionExpired: '/login',
            oauthError: '/login',
            challengeBase: '/auth/challenge',
          },
        };
      },
    },
    AngularHttpAdapter,
    AuthService,
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
};
```

```typescript title="src/main.ts"
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

bootstrapApplication(AppComponent, appConfig);
```

## Route Protection

Use the functional `authGuard`:

```typescript title="src/app/app.routes.ts"
import { Routes } from '@angular/router';
import { authGuard } from '@nauth-toolkit/client-angular/standalone';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./login/login.component') },
  { path: 'auth/callback', loadComponent: () => import('./callback/callback.component') },
  {
    path: 'dashboard',
    loadComponent: () => import('./dashboard/dashboard.component'),
    canActivate: [authGuard()],
  },
];
```

## Basic Login Component

```typescript title="src/app/login/login.component.ts"
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '@nauth-toolkit/client-angular/standalone';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  template: `
    <form (ngSubmit)="login()">
      <input [(ngModel)]="email" name="email" placeholder="Email" required />
      <input [(ngModel)]="password" name="password" type="password" required />
      @if (error) {
        <div class="error">{{ error }}</div>
      }
      <button [disabled]="loading">{{ loading ? 'Loading...' : 'Login' }}</button>
    </form>
  `,
})
export class LoginComponent {
  email = '';
  password = '';
  error = '';
  loading = false;

  constructor(
    private auth: AuthService,
    private router: Router,
  ) {}

  async login(): Promise<void> {
    this.loading = true;
    this.error = '';

    try {
      const response = await this.auth.login(this.email, this.password);
      if (response.challengeName) {
        this.router.navigate(['/auth/challenge', response.challengeName.toLowerCase()]);
      } else {
        this.router.navigate(['/dashboard']);
      }
    } catch (err: unknown) {
      this.error = (err as Error).message;
    } finally {
      this.loading = false;
    }
  }
}
```

## JSON Token Delivery (Mobile)

For JSON mode, add a storage adapter:

```typescript title="src/app/app.config.ts"
import { BrowserStorage } from '@nauth-toolkit/client';

{
  provide: NAUTH_CLIENT_CONFIG,
  useValue: {
    baseUrl: 'https://api.example.com/auth',
    tokenDelivery: 'json',
    storage: new BrowserStorage('localStorage'),
  },
},
```

For mobile apps (Capacitor), see [Capacitor Setup](../mobile/capacitor-setup).

## Package Exports

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
- [Guards](./guards) - Route guard configuration
- [HTTP Interceptor](./interceptor) - Interceptor behavior
- [NgModule Setup](./ngmodule-setup) - Traditional NgModule approach
- [Configuration](../concepts/configuration) - All configuration options
