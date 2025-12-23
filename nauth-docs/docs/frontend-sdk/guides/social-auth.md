---
title: Social Authentication
description: Redirect-first web social login with Google, Apple, and Facebook
sidebar_position: 3
keywords: [social, oauth, google, apple, facebook, login]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Social Authentication

Redirect-first social login for web apps.

- Start: [`NAuthClient.loginWithSocial()`](/docs/frontend-sdk/api/nauth-client#loginwithsocial)
- Callback: if `exchangeToken` exists, call [`NAuthClient.exchangeSocialRedirect()`](/docs/frontend-sdk/api/nauth-client#exchangesocialredirect)
- Angular: use [`socialRedirectCallbackGuard`](/docs/frontend-sdk/angular/oauth-callback-guard)

## Supported providers

| Provider | Web OAuth | Native token verify |
| --- | --- | --- |
| Google | Yes | Yes |
| Apple | Yes | Yes |
| Facebook | Yes | Yes |

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

## Related

- [Social Login (backend)](/docs/features/social-login)
- [`NAuthClient.loginWithSocial()`](/docs/frontend-sdk/api/nauth-client#loginwithsocial)
- [`NAuthClient.exchangeSocialRedirect()`](/docs/frontend-sdk/api/nauth-client#exchangesocialredirect)
- [`SocialLoginOptions`](../api/types/social-login-options)
- [`socialRedirectCallbackGuard`](/docs/frontend-sdk/angular/oauth-callback-guard)


