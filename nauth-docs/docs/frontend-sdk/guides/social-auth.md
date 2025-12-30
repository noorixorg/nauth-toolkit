---
title: Social Authentication
description: Web redirect-first and native mobile social login with Google, Apple, and Facebook
sidebar_position: 3
keywords: [social, oauth, google, apple, facebook, login, mobile, native, capacitor]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Social Authentication

Social login for web apps (redirect-first OAuth) and native mobile apps (token verification).

**Web Apps:**

- Start: [`NAuthClient.loginWithSocial()`](/docs/frontend-sdk/api/nauth-client#loginwithsocial)
- Callback: if `exchangeToken` exists, call [`NAuthClient.exchangeSocialRedirect()`](/docs/frontend-sdk/api/nauth-client#exchangesocialredirect)
- Angular: use [`socialRedirectCallbackGuard`](/docs/frontend-sdk/angular/oauth-callback-guard)

**Native Mobile Apps:**

- Use [`@capgo/capacitor-social-login`](https://github.com/Cap-go/capacitor-social-login) plugin (recommended)
- Verify tokens with [`NAuthClient.verifyNativeSocial()`](/docs/frontend-sdk/api/nauth-client#verifynativesocial)

## Supported providers

| Provider | Web OAuth | Native token verify |
| -------- | --------- | ------------------- |
| Google   | Yes       | Yes                 |
| Apple    | Yes       | Yes                 |
| Facebook | Yes       | Yes                 |

## Requirements

- **Backend** must implement the redirect-first endpoints. See [Social Login (backend)](/docs/features/social-login).
- **Frontend** must configure redirect routes in [`NAuthClientConfig`](../api/nauth-client-config) and optionally override endpoints in [`NAuthEndpoints`](../api/types/nauth-endpoints).

## Frontend (web)

### Start login

```typescript
await client.loginWithSocial('google', { returnTo: '/auth/callback', appState: '12345' });
```

Options: [`SocialLoginOptions`](../api/types/social-login-options)

### Handle callback

- **cookies mode**: backend sets httpOnly cookies before redirecting; callback URL typically has `appState` only
- **json/hybrid** (and **cookies-with-challenge**): callback URL includes `exchangeToken`; frontend exchanges it

<Tabs groupId="framework">
<TabItem value="angular" label="Angular">

```typescript
// app.routes.ts
import { Routes } from '@angular/router';
import { socialRedirectCallbackGuard } from '@nauth-toolkit/client/angular';

export const routes: Routes = [
  {
    path: 'auth/callback',
    canActivate: [socialRedirectCallbackGuard],
    loadComponent: () => import('./auth-callback/auth-callback.component').then((m) => m.AuthCallbackComponent),
  },
];
```

</TabItem>
<TabItem value="vanilla" label="Vanilla JS/TS">

```typescript
const params = new URLSearchParams(window.location.search);
const exchangeToken = params.get('exchangeToken');

if (exchangeToken) {
  const response = await client.exchangeSocialRedirect(exchangeToken);
  // Route based on response.challengeName or success
}
```

</TabItem>
</Tabs>

## Frontend (Native Mobile)

For Capacitor and React Native apps, use native SDKs to get tokens and verify them with the backend.

:::tip Recommended Plugin
**[@capgo/capacitor-social-login](https://github.com/Cap-go/capacitor-social-login)** is the recommended plugin for native social authentication in Capacitor apps. It provides:

- Unified API for Google, Apple, and Facebook
- Works on both iOS and Android
- Native SDK integration (no web views)
- TypeScript support
- Active maintenance
  :::

### Installation

```bash
npm install @capgo/capacitor-social-login @nauth-toolkit/client
npx cap sync
```

### Initialize Plugin and SDK

**Important**: You must call `initialize()` before using any login methods.

```typescript
import { SocialLogin } from '@capgo/capacitor-social-login';
import { NAuthClient } from '@nauth-toolkit/client';

// Initialize plugin
await SocialLogin.initialize({
  google: {
    webClientId: 'YOUR_GOOGLE_WEB_CLIENT_ID.apps.googleusercontent.com',
    iOSClientId: 'YOUR_GOOGLE_IOS_CLIENT_ID.apps.googleusercontent.com',
    mode: 'online', // 'online' returns user data, 'offline' returns only serverAuthCode
  },
  facebook: {
    appId: 'YOUR_FACEBOOK_APP_ID',
    clientToken: 'YOUR_FACEBOOK_CLIENT_TOKEN', // Required for iOS, optional for Android
  },
  apple: {
    clientId: 'YOUR_APPLE_CLIENT_ID',
    redirectUrl: 'https://your-app.com/auth/apple/callback', // Android only
  },
});

// Initialize nauth-toolkit client
const client = new NAuthClient({
  baseUrl: 'https://api.example.com/auth',
  tokenDelivery: 'json', // Mobile apps use JSON mode
  onAuthStateChange: (user) => {
    // Handle auth state changes
    console.log('User:', user);
  },
  onSessionExpired: () => {
    // Handle session expiration
    console.log('Session expired');
  },
});

await client.initialize();
```

### Sign In with Google

```typescript
try {
  // Get native token from plugin
  const result = await SocialLogin.login({
    provider: 'google',
    options: { scopes: ['email', 'profile'] },
  });

  // Type assertion needed - plugin types don't fully match runtime
  const googleResult = result.result as {
    idToken?: string;
    accessToken?: { token?: string } | string;
  };

  if (!googleResult?.idToken) {
    throw new Error('No ID token received from Google');
  }

  // Extract access token - can be an object with token property or a string
  const accessToken =
    typeof googleResult.accessToken === 'string' ? googleResult.accessToken : googleResult.accessToken?.token;

  // Verify with backend using SDK
  const authResponse = await client.verifyNativeSocial({
    provider: 'google',
    idToken: googleResult.idToken,
    accessToken,
  });

  // Handle response
  if (authResponse.challengeName) {
    // Handle challenge (MFA, email verification, etc.)
    console.log('Challenge:', authResponse.challengeName);
  } else {
    // Login successful - tokens are automatically stored by SDK
    console.log('User:', authResponse.user);
  }
} catch (error) {
  console.error('Google sign-in error:', error);
  // Handle error
}
```

### Sign In with Facebook

```typescript
try {
  const result = await SocialLogin.login({
    provider: 'facebook',
    options: { permissions: ['email', 'public_profile'] },
  });

  const facebookResult = result.result as {
    accessToken?: { token?: string } | string;
  };

  const accessToken =
    typeof facebookResult.accessToken === 'string' ? facebookResult.accessToken : facebookResult.accessToken?.token;

  if (!accessToken) {
    throw new Error('No access token received from Facebook');
  }

  const authResponse = await client.verifyNativeSocial({
    provider: 'facebook',
    accessToken,
  });

  if (authResponse.challengeName) {
    // Handle challenge
  } else {
    // Login successful
    console.log('User:', authResponse.user);
  }
} catch (error) {
  console.error('Facebook sign-in error:', error);
}
```

### Sign In with Apple

```typescript
const result = await SocialLogin.login({
  provider: 'apple',
  options: { scopes: ['email', 'name'] },
});

const appleResult = result.result as {
  idToken?: string;
  authorizationCode?: string;
};

const authResponse = await client.verifyNativeSocial({
  provider: 'apple',
  idToken: appleResult.idToken!,
  authorizationCode: appleResult.authorizationCode,
});
```

### Platform Setup

**Android**: Requires MainActivity modification for Google Sign-In. The `@capgo/capacitor-social-login` plugin requires your `MainActivity.java` to implement `ModifiedMainActivityForSocialLoginPlugin` interface and handle Google login intents. See the [plugin documentation](https://capgo.app/docs/plugins/social-login/google/android/) for complete setup.

**iOS**: Requires URL schemes in Info.plist and AppDelegate.swift modifications. Configure URL schemes for Google and Facebook, and implement URL handling in AppDelegate. See the [plugin documentation](https://capgo.app/docs/plugins/social-login/) for complete setup.

## Related

- [Social Login (backend)](/docs/features/social-login)
- [`NAuthClient.loginWithSocial()`](/docs/frontend-sdk/api/nauth-client#loginwithsocial) - Web redirect-first
- [`NAuthClient.verifyNativeSocial()`](/docs/frontend-sdk/api/nauth-client#verifynativesocial) - Native mobile
- [`NAuthClient.exchangeSocialRedirect()`](/docs/frontend-sdk/api/nauth-client#exchangesocialredirect) - Web callback
- [`SocialLoginOptions`](../api/types/social-login-options)
- [`socialRedirectCallbackGuard`](/docs/frontend-sdk/angular/oauth-callback-guard)
- [Social Login (backend)](/docs/features/social-login) - Backend setup including native mobile verify endpoints
- [@capgo/capacitor-social-login](https://github.com/Cap-go/capacitor-social-login) - Plugin documentation
