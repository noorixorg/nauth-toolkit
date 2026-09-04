---
title: NAuthRedirectsConfig
description: Configuration interface for redirect URLs and challenge routing
keywords: [redirects, config, routing, challenges, navigation]
image: /img/api-social-card.png
---

# NAuthRedirectsConfig

**Package:** `@nauth-toolkit/client`
**Type:** Interface

Configuration interface for redirect URLs and challenge routing. Provides platform-agnostic routing configuration for all authentication flows (login, signup, social OAuth, and challenges).

```typescript
import { NAuthRedirectsConfig } from '@nauth-toolkit/client';
```

## Properties

| Property                  | Type                                      | Required | Default              | Description                                                          |
| ------------------------- | ----------------------------------------- | -------- | -------------------- | -------------------------------------------------------------------- |
| `loginSuccess`            | `string \| null`                           | No       | `'/'`                | URL to redirect after successful login/social (no challenge). Set `null` to disable auto-navigation. |
| `signupSuccess`           | `string \| null`                           | No       | `undefined`          | URL to redirect after successful signup (no challenge). Set `null` to disable auto-navigation. |
| `success`                 | `string \| null`                           | No       | `undefined`          | Legacy alias for `loginSuccess`. Deprecated. Set `null` to disable auto-navigation. |
| `sessionExpired`          | `string \| null`                           | No       | `'/login'`           | URL to redirect when session expires (refresh fails with 401). Set `null` to disable auto-navigation. |
| `oauthError`              | `string \| null`                           | No       | `'/login'`           | URL to redirect when OAuth authentication fails. Set `null` to disable auto-navigation. |
| `challengeBase`           | `string`                                  | No       | `'/auth/challenge'`  | Base URL for challenge routes. Challenge type appended by default     |
| `challengeRoutes`         | `Partial<Record<[AuthChallenge](./auth-challenge), string>>` | No | `undefined`          | Custom route mapping for each challenge type. Overrides default route construction. See [AuthChallenge enum](./auth-challenge) for all challenge types. |
| `useSingleChallengeRoute` | `boolean`                                 | No       | `false`              | When `true`, uses query param mode: `/auth/challenge?challenge=VERIFY_EMAIL`. When `false`, uses separate routes: `/auth/challenge/verify-email` |
| `mfaRoutes`               | [`MfaRoutesConfig`](#mfaroutesconfig)  | No       | `undefined`          | MFA-specific route overrides (only applies to `MFA_REQUIRED` challenge). See below. |

### MfaRoutesConfig {/* #mfaroutesconfig */}
Fine-grained control over MFA navigation. Only applies when challenge type is [`MFA_REQUIRED`](./auth-challenge#values). The SDK selects routes based on the MFA method and available options:

| Property   | Type     | Required | Description                                          |
| ---------- | -------- | -------- | ---------------------------------------------------- |
| `passkey`  | `string` | No       | Route for passkey verification. Used when [`preferredMethod`](./mfa-method) is `'passkey'` |
| `selector` | `string` | No       | Route for MFA method selector. Used when multiple [`availableMethods`](./mfa-method) exist and no `preferredMethod` is set |
| `default`  | `string` | No       | Route for other MFA methods. Used for SMS, email, and TOTP ([`MFAMethod`](./mfa-method) values: `'sms'`, `'email'`, `'totp'`) |

## Route Building Priority

The SDK builds challenge URLs in this order (highest to lowest priority):

1. **`challengeRoutes`** - Custom route mapping (overrides everything)
2. **`useSingleChallengeRoute`** - Query param mode (`/auth/challenge?challenge=VERIFY_EMAIL`)
3. **`mfaRoutes`** - MFA-specific routes (only for `MFA_REQUIRED` challenge)
4. **Default separate routes** - Kebab-case routes based on challenge type

## Example

```typescript
import { NAuthRedirectsConfig, AuthChallenge } from '@nauth-toolkit/client';

const redirects: NAuthRedirectsConfig = {
  loginSuccess: '/dashboard',
  signupSuccess: '/onboarding',
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
};
```

## Usage in NAuthClientConfig

This interface is used as the type for the `redirects` property in [`NAuthClientConfig`](../nauth-client-config):

```typescript
import { NAuthClientConfig } from '@nauth-toolkit/client';

const config: NAuthClientConfig = {
  baseUrl: 'https://api.example.com/auth',
  tokenDelivery: 'cookies',
  redirects: {
    loginSuccess: '/dashboard',
    challengeBase: '/auth/challenge',
  },
};
```

## Related Types

- [`NAuthClientConfig`](../nauth-client-config) - Main client configuration interface
- [`AuthChallenge`](./auth-challenge) - Enum of all challenge types
- [`MFAMethod`](./mfa-method) - Type of all MFA methods
- [Challenge Handling Guide](../../guides/challenge-handling) - Complete guide with examples

## See Also

- [NAuthClientConfig](../nauth-client-config) - Complete configuration reference
- [Challenge Handling Guide](../../guides/challenge-handling) - Detailed challenge routing examples

