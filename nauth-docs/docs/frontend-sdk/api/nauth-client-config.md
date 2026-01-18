---
title: NAuthClientConfig
description: Configuration options for NAuthClient
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

| Property            | Type                                                                                                                               | Required | Description                                                                                                                                                            |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `baseUrl`           | `string`                                                                                                                           | Yes      | Backend auth API base URL (e.g., `https://api.example.com/auth`)                                                                                                       |
| `tokenDelivery`     | [`TokenDeliveryMode`](./types/token-delivery-mode)                                                                                 | Yes      | Token delivery mode. Choose based on platform (web or mobile).                                                                                                         |
| `onAuthResponse`    | `(response: [AuthResponse](./types/auth-response), context: [AuthResponseContext](#authresponsecontext)) => void \| Promise<void>` | No       | Custom handler for auth responses. Overrides automatic navigation. Use for dialog-based flows. See [AuthResponseContext](#authresponsecontext) for context properties. |
| `navigationHandler` | `(url: string) => void \| Promise<void>`                                                                                           | No       | Custom navigation function. If not provided, uses `window.location.replace` (guards) or `window.location.href`                                                         |
| `redirects`         | [`NAuthRedirectsConfig`](./types/nauth-redirects-config)                                                                           | No       | Redirect URLs and challenge routing configuration (see below)                                                                                                          |
| `storage`           | [`NAuthStorageAdapter`](./types/nauth-storage-adapter)                                                                             | No       | Custom storage adapter. Defaults to localStorage (browser) or in-memory.                                                                                               |
| `csrf`              | `{ cookieName?: string; headerName?: string }`                                                                                     | No       | CSRF configuration for cookie mode. Defaults: `nauth_csrf_token`, `x-csrf-token`                                                                                       |
| `endpoints`         | `Partial<[NAuthEndpoints](./types/nauth-endpoints)>`                                                                               | No       | Override default endpoint paths. See [`NAuthEndpoints`](./types/nauth-endpoints) for all available endpoints.                                                          |
| `deviceTrust`       | `{ headerName?: string; storageKey?: string }`                                                                                     | No       | Device trust header and storage configuration                                                                                                                          |
| `headers`           | `Record<string, string>`                                                                                                           | No       | Additional headers to include in all requests                                                                                                                          |
| `timeout`           | `number`                                                                                                                           | No       | Request timeout in milliseconds. Default: `30000` (30 seconds)                                                                                                         |
| `onSessionExpired`  | `() => void`                                                                                                                       | No       | **(Deprecated)** Use `redirects.sessionExpired` instead                                                                                                                |
| `onTokenRefresh`    | `() => void`                                                                                                                       | No       | Callback after successful token refresh                                                                                                                                |
| `onAuthStateChange` | `(user: [AuthUser](./types/auth-user) \| null) => void`                                                                            | No       | Callback when authentication state changes                                                                                                                             |
| `onError`           | `(error: [NAuthClientError](./nauth-client-error)) => void`                                                                        | No       | Global error handler                                                                                                                                                   |
| `debug`             | `boolean`                                                                                                                          | No       | Enable debug logging                                                                                                                                                   |
| `admin`             | `{ pathPrefix?: string; endpoints?: Partial<[NAuthAdminEndpoints](./types/nauth-admin-endpoints)>; headers?: Record<string, string> }` | No       | Admin operations configuration. When provided, enables `client.admin.*` methods. See [AdminOperations](./admin-operations) for details.                                |

### Redirect URLs

The `redirects` property accepts a [`NAuthRedirectsConfig`](./types/nauth-redirects-config) object that provides platform-agnostic routing configuration for all authentication flows (login, signup, social OAuth, and challenges).

**See [`NAuthRedirectsConfig`](./types/nauth-redirects-config) for complete interface documentation.**

| Property                  | Type                                                                | Required | Default             | Description                                                                                                                                                   |
| ------------------------- | ------------------------------------------------------------------- | -------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `success`                 | `string`                                                            | No       | `'/'`               | URL to redirect after successful authentication (login, signup, OAuth)                                                                                        |
| `sessionExpired`          | `string`                                                            | No       | `'/login'`          | URL to redirect when session expires (refresh fails with 401)                                                                                                 |
| `oauthError`              | `string`                                                            | No       | `'/login'`          | URL to redirect when OAuth authentication fails                                                                                                               |
| `challengeBase`           | `string`                                                            | No       | `'/auth/challenge'` | Base URL for challenge routes. Challenge type appended by default                                                                                             |
| `challengeRoutes`         | `Partial<Record<[AuthChallenge](./types/auth-challenge), string>>`  | No       | `undefined`         | Custom route mapping for each challenge type. Overrides default route construction. See [AuthChallenge enum](./types/auth-challenge) for all challenge types. |
| `useSingleChallengeRoute` | `boolean`                                                           | No       | `false`             | When `true`, uses query param mode: `/auth/challenge?challenge=VERIFY_EMAIL`. When `false`, uses separate routes: `/auth/challenge/verify-email`              |
| `mfaRoutes`               | [`MfaRoutesConfig`](./types/nauth-redirects-config#mfaroutesconfig) | No       | `undefined`         | MFA-specific route overrides (only applies to `MFA_REQUIRED` challenge). See [MFA Routes Configuration](#mfa-routes-configuration) below.                     |

#### MFA Routes Configuration

Fine-grained control over MFA navigation. Only applies when challenge type is [`MFA_REQUIRED`](./types/auth-challenge#values). The SDK selects routes based on the MFA method and available options:

| Property   | Type     | Required | Description                                                                                                                         |
| ---------- | -------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `passkey`  | `string` | No       | Route for passkey verification. Used when [`preferredMethod`](./types/mfa-method) is `'passkey'`                                    |
| `selector` | `string` | No       | Route for MFA method selector. Used when multiple [`availableMethods`](./types/mfa-method) exist and no `preferredMethod` is set    |
| `default`  | `string` | No       | Route for other MFA methods. Used for SMS, email, and TOTP ([`MFAMethod`](./types/mfa-method) values: `'sms'`, `'email'`, `'totp'`) |

**Route Building Priority:**

The SDK builds challenge URLs in this order (highest to lowest priority):

1. **`challengeRoutes`** - Custom route mapping (overrides everything)
2. **`useSingleChallengeRoute`** - Query param mode (`/auth/challenge?challenge=VERIFY_EMAIL`)
3. **`mfaRoutes`** - MFA-specific routes (only for `MFA_REQUIRED` challenge)
4. **Default separate routes** - Kebab-case routes based on challenge type

**Example:**

```typescript
import { AuthChallenge } from '@nauth-toolkit/client';

{
  redirects: {
    success: '/dashboard',
    sessionExpired: '/login?expired=true',
    oauthError: '/login?error=oauth',
    challengeBase: '/auth/challenge',

    // Custom routes for specific challenges
    challengeRoutes: {
      [AuthChallenge.VERIFY_EMAIL]: '/verify-email',
      [AuthChallenge.MFA_REQUIRED]: '/auth/two-factor',
    },

    // MFA-specific routes (only for MFA_REQUIRED)
    mfaRoutes: {
      passkey: '/auth/passkey',
      selector: '/auth/choose-method',
      default: '/auth/verify-code',
    },

    // Use query param mode instead of separate routes
    useSingleChallengeRoute: false,
  },
}
```

**Related Types:**

- [`AuthChallenge`](./types/auth-challenge) - Enum of all challenge types
- [`MFAMethod`](./types/mfa-method) - Type of all MFA methods
- [Challenge Handling Guide](../guides/challenge-handling) - Complete guide with examples

## Navigation Patterns

The SDK supports multiple navigation patterns for handling challenges. Choose based on your app's routing structure:

### Pattern 1: Separate Routes (Default)

Each challenge gets its own route. Uses [`challengeBase`](#redirect-urls) with kebab-case challenge names.

```typescript
{
  redirects: {
    challengeBase: '/auth/challenge';
  }
}
// Results:
// - /auth/challenge/verify-email
// - /auth/challenge/verify-phone
// - /auth/challenge/mfa-required
// - /auth/challenge/mfa-required/passkey (when passkey is preferred)
// - /auth/challenge/mfa-selector (when multiple methods available)
```

### Pattern 2: Single Route with Query Param

All challenges go to one route with a query parameter. Set [`useSingleChallengeRoute`](#redirect-urls) to `true`.

```typescript
{
  redirects: {
    challengeBase: '/auth/challenge',
    useSingleChallengeRoute: true
  }
}
// Results:
// - /auth/challenge?challenge=VERIFY_EMAIL
// - /auth/challenge?challenge=MFA_REQUIRED
```

### Pattern 3: Custom Routes

Override specific challenge routes using [`challengeRoutes`](#redirect-urls). Requires importing [`AuthChallenge`](./types/auth-challenge) enum.

```typescript
import { AuthChallenge } from '@nauth-toolkit/client';

{
  redirects: {
    challengeRoutes: {
      [AuthChallenge.MFA_REQUIRED]: '/auth/mfa',
      [AuthChallenge.VERIFY_EMAIL]: '/verify',
      [AuthChallenge.VERIFY_PHONE]: '/verify-phone',
    }
  }
}
```

### Pattern 4: MFA-Specific Routes

Fine-grained control over MFA navigation using [`mfaRoutes`](#mfa-routes-configuration). Only applies to [`MFA_REQUIRED`](./types/auth-challenge#values) challenges.

```typescript
{
  redirects: {
    challengeBase: '/auth/challenge',
    mfaRoutes: {
      passkey: '/auth/passkey',        // When preferredMethod is 'passkey'
      selector: '/auth/choose-method',  // When multiple methods available
      default: '/auth/verify-code',     // For SMS, email, TOTP
    }
  }
}
```

### Pattern 5: Dialog-Based (No Navigation)

Handle challenges with dialogs instead of navigation. Use [`onAuthResponse`](#properties) callback to disable auto-navigation.

```typescript
{
  onAuthResponse: (response, context) => {
    if (response.challengeName) {
      // Open dialog/modal instead of navigating
      dialog.open(ChallengeComponent, { data: response });
    } else if (response.user) {
      router.navigate(['/dashboard']);
    }
  };
}
```

### Pattern 6: Custom Navigation Handler

Use custom navigation function for framework-specific routing. Only used when [`onAuthResponse`](#properties) is not provided.

```typescript
{
  navigationHandler: (url: string) => {
    // Angular Router
    inject(Router).navigateByUrl(url);

    // React Router
    // navigate(url);

    // Vue Router
    // router.push(url);
  };
}
```

**See [Challenge Handling Guide](../guides/challenge-handling) for complete examples and implementation details.**

## AuthResponseContext

Context object provided to the [`onAuthResponse`](#properties) callback. Contains information about the authentication operation that triggered the response.

| Property    | Type                                                          | Description                                                    |
| ----------- | ------------------------------------------------------------- | -------------------------------------------------------------- |
| `source`    | `'login' \| 'signup' \| 'social' \| 'challenge' \| 'refresh'` | Source of the auth operation                                   |
| `provider`  | `string \| undefined`                                         | OAuth provider name (only present when `source` is `'social'`) |
| `fromGuard` | `boolean \| undefined`                                        | Whether this was triggered from a route guard                  |

**Example:**

```typescript
{
  onAuthResponse: (response, context) => {
    if (context.source === 'social') {
      console.log(`Social login via ${context.provider}`);
    }

    if (context.fromGuard) {
      // Handle guard-triggered auth
    }

    if (response.challengeName) {
      // Handle challenge
    }
  };
}
```

## Token Delivery Modes

| Mode      | Description                                          | Use Case               |
| --------- | ---------------------------------------------------- | ---------------------- |
| `cookies` | Tokens stored in HTTP-only cookies by backend        | Web apps (recommended) |
| `json`    | Tokens returned in response body, stored client-side | Mobile/native apps     |

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

Override default endpoint paths if your backend uses different routes. The `endpoints` property accepts a [`Partial<NAuthEndpoints>`](./types/nauth-endpoints), allowing you to override only the endpoints you need.

```typescript
import { NAuthClient } from '@nauth-toolkit/client';

const client = new NAuthClient({
  baseUrl: 'https://api.example.com/auth',
  tokenDelivery: 'cookies',
  onSessionExpired: () => {},
  endpoints: {
    login: '/signin', // Default: /login
    signup: '/register', // Default: /signup
    logout: '/signout', // Default: /logout
    refresh: '/token/refresh', // Default: /refresh
  },
});
```

**See [`NAuthEndpoints`](./types/nauth-endpoints) for the complete interface and all available endpoints.**

### Default Endpoints

See [`NAuthEndpoints`](./types/nauth-endpoints) for the complete interface and all default values.

| Endpoint                | Default Path                 |
| ----------------------- | ---------------------------- |
| `auditHistory`          | `/audit/history`             |
| `changePassword`        | `/change-password`           |
| `confirmForgotPassword` | `/forgot-password/confirm`   |
| `forgotPassword`        | `/forgot-password`           |
| `getChallengeData`      | `/challenge/challenge-data`  |
| `getSetupData`          | `/challenge/setup-data`      |
| `isTrustedDevice`       | `/is-trusted-device`         |
| `login`                 | `/login`                     |
| `logout`                | `/logout`                    |
| `logoutAll`             | `/logout/all`                |
| `mfaBackupCodes`        | `/mfa/backup-codes/generate` |
| `mfaDevices`            | `/mfa/devices`               |
| `mfaPreferred`          | `/mfa/preferred-method`      |
| `mfaRemove`             | `/mfa/method`                |
| `mfaSetupData`          | `/mfa/setup-data`            |
| `mfaStatus`             | `/mfa/status`                |
| `mfaVerifySetup`        | `/mfa/verify-setup`          |
| `profile`               | `/profile`                   |
| `refresh`               | `/refresh`                   |
| `requestPasswordChange` | `/request-password-change`   |
| `resendCode`            | `/challenge/resend`          |
| `respondChallenge`      | `/respond-challenge`         |
| `signup`                | `/signup`                    |
| `socialExchange`        | `/social/exchange`           |
| `socialLink`            | `/social/link`               |
| `socialLinked`          | `/social/linked`             |
| `socialRedirectStart`   | `/social/:provider/redirect` |
| `socialUnlink`          | `/social/unlink`             |
| `socialVerify`          | `/social/:provider/verify`   |
| `trustDevice`           | `/trust-device`              |
| `updateProfile`         | `/profile`                   |

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

### Built-in Adapters {#built-in-adapters}

The SDK provides two built-in storage adapters that implement [`NAuthStorageAdapter`](./types/nauth-storage-adapter):

| Adapter                               | Description                                   | Export                                                    |
| ------------------------------------- | --------------------------------------------- | --------------------------------------------------------- |
| [`BrowserStorage`](#browserstorage)   | Uses localStorage (default) or sessionStorage | `import { BrowserStorage } from '@nauth-toolkit/client'`  |
| [`InMemoryStorage`](#inmemorystorage) | In-memory storage (for SSR or testing)        | `import { InMemoryStorage } from '@nauth-toolkit/client'` |

#### BrowserStorage {#browserstorage}

Browser storage adapter that wraps `localStorage` or `sessionStorage`. This is the default storage adapter for web applications.

```typescript
import { BrowserStorage } from '@nauth-toolkit/client';

// Use localStorage (default)
const storage = new BrowserStorage();

// Use sessionStorage
const storage = new BrowserStorage(window.sessionStorage);
```

#### InMemoryStorage {#inmemorystorage}

In-memory storage adapter for server-side rendering (SSR), testing, or environments without Web Storage API.

```typescript
import { InMemoryStorage } from '@nauth-toolkit/client';

const storage = new InMemoryStorage();
```

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
import { NAUTH_CLIENT_CONFIG, type NAuthClientConfig } from '@nauth-toolkit/client-angular';
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

The `socialRedirectCallbackGuard` and `authInterceptor` automatically use the redirect URLs from the config:

```typescript
import { Routes } from '@angular/router';
import { authGuard, socialRedirectCallbackGuard } from '@nauth-toolkit/client-angular';

export const routes: Routes = [
  {
    path: 'auth/callback',
    canActivate: [socialRedirectCallbackGuard], // Uses config.redirects
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

- [`AuthResponse`](./types/auth-response) - Authentication response type
- [`AuthResponseContext`](#authresponsecontext) - Context object for `onAuthResponse` callback
- [`AuthUser`](./types/auth-user) - User type for callbacks
- [Configuration Guide](../configuration) - Detailed configuration guide
- [`MfaRoutesConfig`](./types/nauth-redirects-config#mfaroutesconfig) - MFA routes configuration (see [`NAuthRedirectsConfig`](./types/nauth-redirects-config))
- [NAuthClient](./nauth-client) - Client class using this config
- [NAuthClientError](./nauth-client-error) - Error handling
- [`NAuthEndpoints`](./types/nauth-endpoints) - Endpoint paths interface
- [`NAuthRedirectsConfig`](./types/nauth-redirects-config) - Redirect configuration interface
- [`NAuthStorageAdapter`](./types/nauth-storage-adapter) - Storage adapter interface
- [`TokenDeliveryMode`](./types/token-delivery-mode) - Token delivery mode type
- [Token Management](../token-management) - Token delivery modes explained
