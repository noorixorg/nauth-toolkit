---
title: NAuthClientConfig
description: Configuration options for NAuthClient
sidebar_position: 2
keywords: [config, configuration, options, settings]
image: /img/api-social-card.png
---

# NAuthClientConfig

**Package:** `@nauth-toolkit/client`
**Type:** Interface

Configuration options for initializing NAuthClient.

```typescript
import { NAuthClientConfig } from '@nauth-toolkit/client';
```

## Properties

| Property | Type | Required | Description |
| -------- | ---- | -------- | ----------- |
| `baseUrl` | `string` | Yes | Backend auth API base URL (e.g., `https://api.example.com/auth`) |
| `tokenDelivery` | [`TokenDeliveryMode`](./types/token-delivery-mode) | Yes | Token delivery mode. Choose based on platform (web or mobile). |
| `redirects` | `object` | No | Redirect URLs for various authentication scenarios (see below) |
| `storage` | [`NAuthStorageAdapter`](./types/nauth-storage-adapter) | No | Custom storage adapter. Defaults to localStorage (browser) or in-memory. |
| `csrf` | `{ cookieName?: string; headerName?: string }` | No | CSRF configuration for cookie mode. Defaults: `nauth_csrf_token`, `x-csrf-token` |
| `endpoints` | `Partial<[NAuthEndpoints](./types/nauth-endpoints)>` | No | Override default endpoint paths |
| `deviceTrust` | `{ headerName?: string; storageKey?: string }` | No | Device trust header and storage configuration |
| `headers` | `Record<string, string>` | No | Additional headers to include in all requests |
| `timeout` | `number` | No | Request timeout in milliseconds |
| `onSessionExpired` | `() => void` | No | **(Deprecated)** Use `redirects.sessionExpired` instead |
| `onTokenRefresh` | `() => void` | No | Callback after successful token refresh |
| `onAuthStateChange` | `(user: [AuthUser](./types/auth-user) \| null) => void` | No | Callback when authentication state changes |
| `onError` | `(error: [NAuthClientError](./nauth-client-error)) => void` | No | Global error handler |
| `debug` | `boolean` | No | Enable debug logging |

### Redirect URLs

The `redirects` object provides platform-agnostic routing configuration:

| Property | Type | Default | Description |
| -------- | ---- | ------- | ----------- |
| `success` | `string` | `'/'` | URL to redirect to after successful authentication (login, signup, or OAuth) |
| `sessionExpired` | `string` | `'/login'` | URL to redirect to when session expires |
| `oauthError` | `string` | `'/login'` | URL to redirect to when OAuth fails |
| `challengeBase` | `string` | `'/auth/challenge'` | Base URL for challenge routes (type is appended) |

## Token Delivery Modes

| Mode | Description | Use Case |
| ---- | ----------- | -------- |
| `cookies` | Tokens stored in HTTP-only cookies by backend | Web apps (recommended) |
| `json` | Tokens returned in response body, stored client-side | Mobile/native apps |

:::info Backend Hybrid Deployment
When your backend supports both web and mobile (hybrid deployment), it exposes separate endpoints:
- Web: `/auth/*` (cookies mode)
- Mobile: `/mobile/auth/*` (JSON mode)

The frontend chooses ONE mode and the appropriate `baseUrl` based on the platform.
:::

## Example

```typescript
import { NAuthClient, BrowserStorage } from '@nauth-toolkit/client';

const client = new NAuthClient({
  // Required
  baseUrl: 'https://api.example.com/auth',
  tokenDelivery: 'cookies',

  // Optional - redirect URLs (platform-agnostic)
  redirects: {
    success: '/',
    sessionExpired: '/login',
    oauthError: '/login',
    challengeBase: '/auth/challenge',
  },

  // Optional - custom storage
  storage: new BrowserStorage('sessionStorage'),

  // Optional - CSRF config
  csrf: {
    cookieName: 'nauth_csrf_token',
    headerName: 'x-csrf-token',
  },

  // Optional - callbacks
  onAuthStateChange: (user) => {
    console.log('Auth state changed:', user?.email);
  },
  onTokenRefresh: () => {
    console.log('Tokens refreshed');
  },

  // Optional - debugging
  debug: process.env.NODE_ENV === 'development',
});
```

## Custom Endpoints

Override default endpoint paths if your backend uses different routes:

```typescript
const client = new NAuthClient({
  baseUrl: 'https://api.example.com/auth',
  tokenDelivery: 'cookies',
  onSessionExpired: () => {},
  endpoints: {
    login: '/signin',           // Default: /login
    signup: '/register',        // Default: /signup
    logout: '/signout',         // Default: /logout
    refresh: '/token/refresh',  // Default: /refresh
  },
});
```

### Default Endpoints

| Endpoint | Default Path |
| -------- | ------------ |
| `login` | `/login` |
| `signup` | `/signup` |
| `logout` | `/logout` |
| `logoutAll` | `/logout/all` |
| `refresh` | `/refresh` |
| `respondChallenge` | `/respond-challenge` |
| `resendCode` | `/challenge/resend` |
| `getSetupData` | `/challenge/setup-data` |
| `getChallengeData` | `/challenge/challenge-data` |
| `profile` | `/profile` |
| `updateProfile` | `/profile` |
| `changePassword` | `/change-password` |
| `mfaStatus` | `/mfa/status` |
| `mfaDevices` | `/mfa/devices` |
| `mfaSetupData` | `/mfa/setup-data` |
| `mfaVerifySetup` | `/mfa/verify-setup` |
| `mfaRemove` | `/mfa/remove` |
| `mfaPreferred` | `/mfa/preferred` |
| `mfaBackupCodes` | `/mfa/backup-codes` |
| `mfaExemption` | `/mfa/exemption` |
| `socialAuthUrl` | `/social/auth-url` |
| `socialCallback` | `/social/callback` |
| `socialVerify` | `/social/:provider/verify` |
| `socialLinked` | `/social/linked` |
| `socialLink` | `/social/link` |
| `socialUnlink` | `/social/unlink` |
| `trustDevice` | `/trust-device` |
| `auditHistory` | `/audit-history` |

---

## NAuthStorageAdapter

Interface for custom storage implementations. See [`NAuthStorageAdapter`](./types/nauth-storage-adapter) for complete documentation.

```typescript
interface NAuthStorageAdapter {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  clear(): Promise<void>;
}
```

### Built-in Adapters

| Adapter | Description |
| ------- | ----------- |
| [`BrowserStorage`](#built-in-adapters) | Uses localStorage (default) or sessionStorage |
| [`InMemoryStorage`](#built-in-adapters) | In-memory storage (for SSR or testing) |

See [`NAuthStorageAdapter`](./types/nauth-storage-adapter) for interface details and custom implementation examples.

### Custom Adapter Example

```typescript
import { NAuthStorageAdapter } from '@nauth-toolkit/client';
import { Preferences } from '@capacitor/preferences';

// Capacitor storage adapter for mobile apps
class CapacitorStorage implements NAuthStorageAdapter {
  async getItem(key: string): Promise<string | null> {
    const { value } = await Preferences.get({ key });
    return value;
  }

  async setItem(key: string, value: string): Promise<void> {
    await Preferences.set({ key, value });
  }

  async removeItem(key: string): Promise<void> {
    await Preferences.remove({ key });
  }

  async clear(): Promise<void> {
    await Preferences.clear();
  }
}

const client = new NAuthClient({
  baseUrl: 'https://api.example.com/auth',
  tokenDelivery: 'json', // Mobile apps use JSON mode
  storage: new CapacitorStorage(),
  onSessionExpired: () => {},
});
```

---

## Angular Example

For Angular applications, use a simple configuration object without factory methods:

```typescript
import { ApplicationConfig } from '@angular/core';
import { NAUTH_CLIENT_CONFIG, type NAuthClientConfig } from '@nauth-toolkit/client/angular';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    {
      provide: NAUTH_CLIENT_CONFIG,
      useValue: {
        baseUrl: `${environment.apiBaseUrl}/auth`,
        tokenDelivery: 'cookies',
        debug: true,
        redirects: {
          success: '/',
          sessionExpired: '/login',
          oauthError: '/login',
          challengeBase: '/auth/challenge',
        },
      } satisfies NAuthClientConfig,
    },
  ],
};
```

The `oauthCallbackGuard` and `authInterceptor` automatically use the redirect URLs from the config:

```typescript
import { Routes } from '@angular/router';
import { authGuard, oauthCallbackGuard } from '@nauth-toolkit/client/angular';

export const routes: Routes = [
  {
    path: 'auth/callback',
    canActivate: [oauthCallbackGuard], // Uses config.redirects
    children: [],
  },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [authGuard()],
  },
];
```

---

## Related APIs

- [NAuthClient](./nauth-client) - Client class using this config
- [NAuthClientError](./nauth-client-error) - Error handling
- [`AuthUser`](./types/auth-user) - User type for callbacks
- [`TokenDeliveryMode`](./types/token-delivery-mode) - Token delivery mode type
- [`NAuthEndpoints`](./types/nauth-endpoints) - Endpoint paths interface
- [`NAuthStorageAdapter`](./types/nauth-storage-adapter) - Storage adapter interface
- [Token Management](../token-management) - Token delivery modes explained
- [Configuration Guide](../configuration) - Detailed configuration guide

