---
title: NgModule Setup
description: Set up nauth-toolkit in Angular NgModule-based applications
keywords: [angular, ngmodule, setup, module, interceptor, configuration]
image: /img/api-social-card.png
sidebar_position: 2
---

# NgModule Setup

Set up `@nauth-toolkit/client-angular` in a traditional Angular application using NgModule.

:::note Sample Application
A complete working example is available at [github.com/noorixorg/nauth-toolkit/tree/main/examples/demo-angular](https://github.com/noorixorg/nauth-toolkit/tree/main/examples/demo-angular) — includes both standalone and NgModule patterns paired with the NestJS backend example.
:::

## Installation

```bash npm2yarn
npm install @nauth-toolkit/client @nauth-toolkit/client-angular
```

## Register NAuthModule

Import `NAuthModule.forRoot()` in your root module:

```typescript title="src/app/app.module.ts"
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HTTP_INTERCEPTORS, provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { NAuthModule, AuthInterceptorClass } from '@nauth-toolkit/client-angular';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { environment } from '../environments/environment';

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    AppRoutingModule,
    NAuthModule.forRoot({
      baseUrl: environment.baseUrl,
      authPathPrefix: 'auth',
      tokenDelivery: 'cookies',
      csrf: {
        cookieName: 'nauth_csrf_token',
        headerName: 'x-csrf-token',
      },
      redirects: {
        loginSuccess: '/dashboard',
        signupSuccess: null,
        sessionExpired: '/auth',
        oauthError: '/auth',
        challengeBase: '/auth/challenge',
      },
    }),
  ],
  providers: [
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptorClass,
      multi: true,
    },
    provideHttpClient(withInterceptorsFromDi()),
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
```

## Route Protection

Use the class-based `AuthGuard`:

```typescript title="src/app/app-routing.module.ts"
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from '@nauth-toolkit/client-angular';

const routes: Routes = [
  { path: 'auth', loadChildren: () => import('./auth/auth.module').then(m => m.AuthModule) },
  {
    path: 'dashboard',
    loadChildren: () => import('./dashboard/dashboard.module').then(m => m.DashboardModule),
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

## Custom Auth Guard

For additional logic (e.g., fetching user profile after authentication):

```typescript title="src/app/core/guards/auth.guard.ts"
import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router } from '@angular/router';
import { AuthService } from '@nauth-toolkit/client-angular';

@Injectable({ providedIn: 'root' })
export class AppAuthGuard implements CanActivate {
  constructor(
    private authService: AuthService,
    private router: Router,
  ) {}

  async canActivate(
    _route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot,
  ): Promise<boolean> {
    if (this.authService.isAuthenticated()) {
      return true;
    }

    this.router.navigate(['/auth'], {
      queryParams: { returnUrl: state.url },
    });
    return false;
  }
}
```

## Dual-Mode Setup (Web + Mobile)

For apps that run on both web and Capacitor native, detect the platform at startup:

```typescript title="src/app/app.module.ts"
import { Capacitor } from '@capacitor/core';
import { NAuthModule, AuthInterceptorClass } from '@nauth-toolkit/client-angular';
import { AuthStorage } from './core/services/auth-storage';
import { environment } from '../environments/environment';

const isMobile = Capacitor.isNativePlatform();

@NgModule({
  imports: [
    NAuthModule.forRoot({
      baseUrl: environment.baseUrl,
      authPathPrefix: 'auth',
      tokenDelivery: isMobile ? 'json' : 'cookies',
      csrf: isMobile ? undefined : {
        cookieName: 'nauth_csrf_token',
        headerName: 'x-csrf-token',
      },
      storage: isMobile ? new AuthStorage() : undefined,
      endpoints: isMobile ? {
        login: '/mobile/login',
        signup: '/mobile/signup',
        logout: '/mobile/logout',
        refresh: '/mobile/refresh',
        respondChallenge: '/mobile/challenge',
        socialRedirectStart: '/mobile/social/:provider/redirect',
      } : undefined,
      redirects: {
        loginSuccess: null,
        signupSuccess: null,
        sessionExpired: '/auth',
        oauthError: '/auth',
        challengeBase: '/auth/challenge',
      },
    }),
  ],
  // ...
})
export class AppModule {}
```

See [Capacitor Setup](../mobile/capacitor-setup) for the `AuthStorage` implementation and full mobile configuration.

## Package Exports

| Export                 | Description                       |
| ---------------------- | --------------------------------- |
| `NAUTH_CLIENT_CONFIG`  | Injection token for configuration |
| `NAuthModule`          | NgModule with `forRoot()`         |
| `AuthService`          | Main service wrapping NAuthClient |
| `AngularHttpAdapter`   | HTTP client adapter               |
| `AuthInterceptorClass` | Class-based HTTP interceptor      |
| `AuthGuard`            | Class-based route guard           |

## Related Documentation

- [AuthService API](./auth-service) - Full service reference
- [Guards](./guards) - Route guard configuration
- [HTTP Interceptor](./interceptor) - Interceptor behavior
- [Standalone Setup](./standalone-setup) - Modern standalone approach
- [Capacitor Setup](../mobile/capacitor-setup) - Mobile native app setup
