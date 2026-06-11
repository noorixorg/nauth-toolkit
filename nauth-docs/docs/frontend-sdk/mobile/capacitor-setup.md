---
title: Capacitor Setup
description: Set up nauth-toolkit in Capacitor mobile applications with JSON token delivery
keywords: [capacitor, mobile, native, ios, android, storage, json tokens]
image: /img/api-social-card.png
sidebar_position: 1
---

# Capacitor Setup

Set up `@nauth-toolkit/client` (or `@nauth-toolkit/client-angular`) in a Capacitor mobile application using JSON token delivery with native storage.

:::note Sample Application
The [NestJS example](https://github.com/noorixorg/nauth-toolkit/tree/main/examples/demo-nestjs) backend supports hybrid token delivery (cookies + JSON) out of the box — pair it with this mobile setup guide.
:::

## Why JSON Mode for Mobile?

Mobile apps cannot use HTTP-only cookies — native WebView containers have limited cookie support. JSON token delivery stores tokens in native secure storage and sends them via `Authorization: Bearer` headers.

| Mode      | Web (Browser) | Mobile (Capacitor) |
| --------- | ------------- | ------------------- |
| `cookies` | Recommended   | Not supported       |
| `json`    | Supported     | Recommended         |

## Installation

```bash npm2yarn
npm install @nauth-toolkit/client @capacitor/preferences
```

For Angular apps, also install the Angular adapter:

```bash npm2yarn
npm install @nauth-toolkit/client-angular
```

## Step 1: Create a Storage Adapter

Implement `NAuthStorageAdapter` using Capacitor Preferences for secure native storage:

```typescript title="src/app/core/services/auth-storage.ts"
import { Preferences } from '@capacitor/preferences';
import type { NAuthStorageAdapter } from '@nauth-toolkit/client';

export class AuthStorage implements NAuthStorageAdapter {
  async setItem(key: string, value: string): Promise<void> {
    await Preferences.set({ key, value });
  }

  async getItem(key: string): Promise<string | null> {
    const { value } = await Preferences.get({ key });
    return value;
  }

  async removeItem(key: string): Promise<void> {
    await Preferences.remove({ key });
  }

  async clear(): Promise<void> {
    await Preferences.clear();
  }
}
```

## Step 2: Detect Platform

Use Capacitor's platform detection to switch between cookie and JSON modes:

```typescript title="src/app/utils/platform.ts"
import { Capacitor } from '@capacitor/core';

export const isMobile = Capacitor.isNativePlatform();
export const isAndroid = Capacitor.getPlatform() === 'android';
export const isIOS = Capacitor.getPlatform() === 'ios';
```

## Step 3: Configure Dual-Mode SDK

### Angular NgModule

```typescript title="src/app/app.module.ts"
import { Capacitor } from '@capacitor/core';
import { NAuthModule } from '@nauth-toolkit/client-angular';
import { AuthStorage } from './core/services/auth-storage';
import { environment } from '../environments/environment';

const isMobile = Capacitor.isNativePlatform();

@NgModule({
  imports: [
    NAuthModule.forRoot({
      baseUrl: environment.baseUrl,
      authPathPrefix: 'auth',
      tokenDelivery: isMobile ? 'json' : 'cookies',

      // CSRF only applies to cookie mode
      csrf: isMobile ? undefined : {
        cookieName: 'nauth_csrf_token',
        headerName: 'x-csrf-token',
      },

      // Native storage for JSON mode
      storage: isMobile ? new AuthStorage() : undefined,

      // Mobile endpoints return tokens in response body
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
})
export class AppModule {}
```

### Angular Standalone

```typescript title="src/app/app.config.ts"
import { Capacitor } from '@capacitor/core';
import { NAUTH_CLIENT_CONFIG, AuthService, AngularHttpAdapter, authInterceptor } from '@nauth-toolkit/client-angular/standalone';
import { AuthStorage } from './core/services/auth-storage';

const isMobile = Capacitor.isNativePlatform();

export const appConfig: ApplicationConfig = {
  providers: [
    {
      provide: NAUTH_CLIENT_CONFIG,
      useValue: {
        baseUrl: 'https://api.example.com',
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
        } : undefined,
      },
    },
    AngularHttpAdapter,
    AuthService,
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
};
```

### Vanilla JS / React

```typescript title="src/config/auth.config.ts"
import { NAuthClient } from '@nauth-toolkit/client';
import { Capacitor } from '@capacitor/core';
import { AuthStorage } from './auth-storage';

const isMobile = Capacitor.isNativePlatform();

const client = new NAuthClient({
  baseUrl: 'https://api.example.com/auth',
  tokenDelivery: isMobile ? 'json' : 'cookies',
  storage: isMobile ? new AuthStorage() : undefined,
  csrf: isMobile ? undefined : {
    cookieName: 'nauth_csrf_token',
    headerName: 'x-csrf-token',
  },
  endpoints: isMobile ? {
    login: '/mobile/login',
    signup: '/mobile/signup',
    logout: '/mobile/logout',
    refresh: '/mobile/refresh',
    respondChallenge: '/mobile/challenge',
  } : undefined,
  onAuthResponse: () => {},
  redirects: {
    sessionExpired: '/login',
    oauthError: '/login',
  },
});
```

## Backend Requirements

Your backend must support the JSON token delivery mode with separate mobile endpoints. In your backend config:

```typescript title="nauth.config.ts"
{
  tokenDelivery: {
    method: 'hybrid',
  },
}
```

This makes the backend serve both cookie-based (`/auth/*`) and JSON-based (`/mobile/auth/*`) endpoints from the same deployment.

## Related Documentation

- [Native Social Login](./native-social) - Use native OAuth on iOS/Android
- [Token Management](../concepts/token-management) - Token storage and refresh
- [NgModule Setup](../angular/ngmodule-setup) - Angular NgModule configuration
- [Standalone Setup](../angular/standalone-setup) - Angular standalone configuration
