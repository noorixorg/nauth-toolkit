---
title: Configuration
description: Configuration guide for nauth-toolkit frontend SDK
sidebar_position: 20
keywords: [configuration, options, setup, csrf, endpoints]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Configuration

Complete guide to configuring `@nauth-toolkit/client` for your application.

## Basic Configuration

<Tabs groupId="framework">
<TabItem value="vanilla" label="Vanilla JS/TS">

```typescript
import { NAuthClient } from '@nauth-toolkit/client';

const client = new NAuthClient({
  baseUrl: 'https://api.example.com/auth',
  tokenDelivery: 'cookies',
  onSessionExpired: () => {
    window.location.replace('/login');
  },
});
```

See [NAuthClientConfig](./api/nauth-client-config) for complete interface.

</TabItem>
<TabItem value="angular" label="Angular">

```typescript
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { NAUTH_CLIENT_CONFIG } from '@nauth-toolkit/client-angular';

export const appConfig = {
  providers: [
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
  ],
};
```

</TabItem>
</Tabs>

## Required Options

| Option             | Type                  | Description                                                                          |
| ------------------ | --------------------- | ------------------------------------------------------------------------------------ |
| `baseUrl`          | `string`              | Backend auth API URL                                                                 |
| `tokenDelivery`    | `'json' \| 'cookies'` | Token delivery mode (must match backend). See [Token Management](./token-management) |
| `onSessionExpired` | `() => void`          | Callback when session expires                                                        |

See [NAuthClientConfig](./api/nauth-client-config) for all options.

## Token Delivery Modes

### Cookies (Web Applications)

```typescript
{
  baseUrl: 'https://api.example.com/auth',
  tokenDelivery: 'cookies',
}
```

- Tokens stored in HTTP-only cookies (server-managed)
- Automatic CSRF protection required
- Interceptor adds `withCredentials: true`
- Most secure option for web browsers

### JSON (Mobile/Native Apps)

```typescript
{
  baseUrl: 'https://api.example.com/mobile/auth',  // Different endpoint for mobile
  tokenDelivery: 'json',
}
```

- Tokens returned in response body
- Stored in provided storage adapter (secure storage recommended)
- Interceptor adds `Authorization: Bearer` header
- Required for Capacitor, React Native, etc.

:::info Hybrid Backend Deployment
When your backend supports both web and mobile apps (hybrid deployment), it exposes
**separate endpoints** for each delivery mode:

- Web (cookies): `/auth/*`
- Mobile (JSON): `/mobile/auth/*`

The frontend chooses ONE mode based on the platform and uses the appropriate `baseUrl`.
See [Token Delivery](/docs/features/token-delivery) for backend setup.
:::

## CSRF Configuration

Required for `cookies` mode:

```typescript
{
  tokenDelivery: 'cookies',
  csrf: {
    cookieName: 'csrf_token',    // Default
    headerName: 'x-csrf-token',  // Default
  },
}
```

The interceptor automatically:

1. Reads CSRF token from cookie
2. Attaches to `POST`, `PUT`, `PATCH`, `DELETE` requests

:::warning
CSRF cookie and header names must match your backend configuration.
:::

## Custom Storage

By default, uses `localStorage` in browser. Provide custom adapter for:

- Mobile apps (Capacitor, React Native)
- SSR (in-memory or server-side storage)
- Session storage

```typescript
import { NAuthClient, InMemoryStorage, BrowserStorage } from '@nauth-toolkit/client';

// Session storage instead of local storage
const client = new NAuthClient({
  baseUrl: 'https://api.example.com/auth',
  tokenDelivery: 'json',
  storage: new BrowserStorage('sessionStorage'),
  onSessionExpired: () => {},
});

// In-memory for SSR
const ssrClient = new NAuthClient({
  baseUrl: 'https://api.example.com/auth',
  tokenDelivery: 'json',
  storage: new InMemoryStorage(),
  onSessionExpired: () => {},
});
```

See [NAuthClientConfig](./api/nauth-client-config#built-in-adapters) for storage adapters.

### Custom Storage Adapter

```typescript
import { NAuthStorageAdapter } from '@nauth-toolkit/client';
import { Preferences } from '@capacitor/preferences';

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
  tokenDelivery: 'json',
  storage: new CapacitorStorage(),
  onSessionExpired: () => {},
});
```

## Callbacks

### onAuthResponse

Custom handler for all authentication responses. Overrides automatic navigation. Perfect for dialog-based flows:

```typescript
{
  onAuthResponse: (response, context) => {
    // context.source: 'login' | 'signup' | 'social' | 'challenge'

    if (response.challengeName) {
      // Handle challenge (dialog, modal, or custom navigation)
      dialog.open(ChallengeComponent, {
        data: { challenge: response, source: context.source }
      });
    } else if (response.user) {
      // Authentication complete
      router.navigate(['/dashboard']);
    }
  },
}
```

**When to use:**
- Dialog/modal-based challenge flows
- Custom navigation logic
- Complex UI state management

:::note
When `onAuthResponse` is provided, the SDK skips automatic navigation. You control all routing.
:::

### navigationHandler

Custom navigation function. Use your framework's router instead of `window.location`:

```typescript
{
  navigationHandler: (url: string) => {
    // Angular
    inject(Router).navigateByUrl(url);

    // React Router
    navigate(url);

    // Vue Router
    router.push(url);
  },
}
```

**Default behavior:**
- Guards: `window.location.replace(url)`
- Other contexts: `window.location.href = url`

### onSessionExpired

Called when refresh fails (401 after refresh attempt):

```typescript
{
  onSessionExpired: () => {
    // Clear app state
    appState.reset();
    // Redirect to login
    window.location.replace('/login');
  },
}
```

### onAuthStateChange

Called when auth state changes (login, logout, token refresh):

```typescript
{
  onAuthStateChange: (user) => {
    if (user) {
      analytics.identify(user.sub);
    } else {
      analytics.reset();
    }
  },
}
```

### onTokenRefresh

Called after successful token refresh:

```typescript
{
  onTokenRefresh: () => {
    console.log('Tokens refreshed at', new Date());
  },
}
```

### onError

Global error handler:

```typescript
{
  onError: (error) => {
    // Log to monitoring service
    Sentry.captureException(error);

    // Handle specific errors
    if (error.code === 'NETWORK_ERROR') {
      showToast('Network error. Please check your connection.');
    }
  },
}
```

## Custom Endpoints

Override default endpoint paths:

```typescript
{
  baseUrl: 'https://api.example.com/auth',
  tokenDelivery: 'cookies',
  endpoints: {
    login: '/signin',
    signup: '/register',
    logout: '/signout',
    refresh: '/token/refresh',
    profile: '/me',
  },
  onSessionExpired: () => {},
}
```

### All Available Endpoints

:::warning Backend Implementation Required
To override or customize API endpoint paths, your **backend must implement these endpoints according to the NAuth specification**.
Otherwise, authentication flows will fail.
**all endpoint paths listed below should be present and correctly handle the expected request/response formats**.

See the [API Reference](./api/overview) for type requirements.
:::

| Key                | Default                     | Description              |
| ------------------ | --------------------------- | ------------------------ |
| `login`            | `/login`                    | Login endpoint           |
| `signup`           | `/signup`                   | Signup endpoint          |
| `logout`           | `/logout`                   | Logout endpoint          |
| `logoutAll`        | `/logout/all`               | Logout all sessions      |
| `refresh`          | `/refresh`                  | Token refresh            |
| `respondChallenge` | `/respond-challenge`        | Challenge response       |
| `resendCode`       | `/challenge/resend`         | Resend verification code |
| `getSetupData`     | `/challenge/setup-data`     | MFA setup data           |
| `getChallengeData` | `/challenge/challenge-data` | Challenge data           |
| `profile`          | `/profile`                  | Get profile              |
| `updateProfile`    | `/profile`                  | Update profile           |
| `changePassword`   | `/change-password`          | Change password          |
| `mfaStatus`        | `/mfa/status`               | MFA status               |
| `mfaDevices`       | `/mfa/devices`              | MFA devices              |
| `mfaSetupData`     | `/mfa/setup-data`           | MFA setup                |
| `mfaVerifySetup`   | `/mfa/verify-setup`         | Verify MFA setup         |
| `mfaRemove`        | `/mfa/remove`               | Remove MFA device        |
| `mfaPreferred`     | `/mfa/preferred`            | Set preferred MFA        |
| `mfaBackupCodes`   | `/mfa/backup-codes`         | Generate backup codes    |
| `socialRedirectStart` | `/social/:provider/redirect` | Start web social login redirect |
| `socialExchange`   | `/social/exchange`          | Exchange `exchangeToken` (json/hybrid or cookies-with-challenge) |
| `socialVerify`     | `/social/:provider/verify`  | Verify native social     |
| `socialLinked`     | `/social/linked`            | Linked accounts          |
| `socialLink`       | `/social/link`              | Link account             |
| `socialUnlink`     | `/social/unlink`            | Unlink account           |
| `trustDevice`      | `/trust-device`             | Trust device             |
| `auditHistory`     | `/audit/history`            | Audit history            |

## Device Trust

Configure device trust header:

```typescript
{
  deviceTrust: {
    headerName: 'x-device-token',    // Default
    storageKey: 'nauth_device_token', // Default
  },
}
```

## Custom Headers

Add headers to all requests:

```typescript
{
  headers: {
    'X-App-Version': '1.0.0',
    'X-Platform': 'web',
  },
}
```

## Request Timeout

Set request timeout in milliseconds:

```typescript
{
  timeout: 30000, // 30 seconds
}
```

## Debug Mode

Enable debug logging:

```typescript
{
  debug: process.env.NODE_ENV === 'development',
}
```

## Full Configuration Example

```typescript
import { AuthChallenge } from '@nauth-toolkit/client';

const client = new NAuthClient({
  // Required
  baseUrl: 'https://api.example.com/auth',
  tokenDelivery: 'cookies',

  // Challenge navigation
  redirects: {
    success: '/dashboard',
    sessionExpired: '/login',
    oauthError: '/login',
    challengeBase: '/auth/challenge',

    // Optional: Custom routes
    challengeRoutes: {
      [AuthChallenge.MFA_REQUIRED]: '/auth/mfa',
    },

    // Optional: Single route mode
    // useSingleChallengeRoute: true,

    // Optional: MFA-specific routes
    mfaRoutes: {
      passkey: '/auth/passkey',
      selector: '/auth/choose-mfa',
      default: '/auth/verify-code',
    },
  },

  // Optional: Custom navigation
  navigationHandler: (url) => inject(Router).navigateByUrl(url),

  // Optional: Dialog-based flow
  // onAuthResponse: (response, context) => {
  //   if (response.challengeName) {
  //     dialog.open(ChallengeComponent, { data: response });
  //   }
  // },

  // CSRF (for cookies mode)
  csrf: {
    cookieName: 'csrf_token',
    headerName: 'x-csrf-token',
  },

  // Callbacks
  onAuthStateChange: (user) => {
    if (user) analytics.identify(user.sub);
  },
  onTokenRefresh: () => console.log('Tokens refreshed'),
  onError: (error) => Sentry.captureException(error),

  // Device trust
  deviceTrust: {
    headerName: 'x-device-token',
    storageKey: 'nauth_device',
  },

  // Custom headers
  headers: {
    'X-App-Version': APP_VERSION,
  },

  // Timeout
  timeout: 30000,

  // Debug
  debug: isDevelopment,
});
```

## Related Documentation

- [NAuthClientConfig API](./api/nauth-client-config) - Full reference
- [Challenge Handling](./guides/challenge-handling) - Challenge navigation and routing
- [Token Management](./token-management) - Token handling
- [Getting Started](./guides/getting-started) - Setup guide
