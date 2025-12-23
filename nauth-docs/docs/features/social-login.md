---
title: Social Login
description: Redirect-first web social login with Google, Apple, and Facebook
sidebar_position: 1
keywords: [social, oauth, google, apple, facebook, redirect]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Social Login

Redirect-first OAuth: provider redirects to your backend, backend completes auth, then redirects back to your frontend.

## What you implement (consumer)

### Backend

You own these routes:

| Endpoint | Purpose |
| --- | --- |
| `GET /auth/social/:provider/redirect` | Start flow |
| `GET /auth/social/:provider/callback` | Provider callback (Google/Facebook) |
| `POST /auth/social/:provider/callback` | Provider callback (Apple `form_post`) |
| `POST /auth/social/exchange` | Exchange `exchangeToken` → `AuthResponse` |

Your controller should delegate to `SocialRedirectHandler` (framework-neutral).

### Frontend

- Start: [`NAuthClient.loginWithSocial()`](/docs/frontend-sdk/api/nauth-client#loginwithsocial)
- Callback:
  - if URL contains `exchangeToken` → call [`NAuthClient.exchangeSocialRedirect()`](/docs/frontend-sdk/api/nauth-client#exchangesocialredirect)
  - otherwise (cookies success) → your app can continue normally (cookies already set)

## Token delivery behavior (cookies vs json vs hybrid)

| Mode | Backend sets cookies on callback? | Frontend receives `exchangeToken`? | Frontend must call `/auth/social/exchange`? |
| --- | --- | --- | --- |
| `cookies` | Yes (httpOnly) | Only when a **challenge** is returned | Only when `exchangeToken` exists |
| `json` | No | Yes | Yes |
| `hybrid` | Yes for web origins, no for native origins | Yes for json path | Yes for json path |

### Cookies mode (web)

- **Backend callback response**: `Set-Cookie` headers + `302` redirect to `returnTo?appState=...`
- **Frontend**: does not see tokens; browser stores them; API calls use `credentials: 'include'`
- **CSRF**: required for mutating requests (see [Token Delivery Modes](/docs/features/token-delivery))

### JSON mode (web/mobile)

- **Backend callback response**: `302` redirect to `returnTo?appState=...&exchangeToken=...`
- **Frontend**: calls `POST /auth/social/exchange` with `{ exchangeToken }` and receives `AuthResponse` (tokens or challenge)

### Hybrid mode (web + mobile)

- Uses `tokenDelivery.method = 'hybrid'` and `tokenDelivery.hybridPolicy` for origin classification (see [Configuration](/docs/concepts/configuration#token-delivery)).
- For social redirects, delivery is decided at **start** (browser request has `Origin`) and persisted server-side so the provider callback doesn’t have to guess.
- Recommended: keep web origins in `hybridPolicy.webOrigins` and native origins in `hybridPolicy.nativeOrigins`.

## Challenge behavior (important)

Social login can still return challenges (example: `MFA_REQUIRED`, `VERIFY_PHONE`).

- When a **challenge** is returned, the backend redirects with **`exchangeToken`** so the frontend can fetch the challenge payload via `/auth/social/exchange` (even in cookies mode).

## Backend configuration

Configure providers under `config.social.*` and set the frontend redirect base:

```typescript
export const authConfig = {
  tokenDelivery: { method: 'cookies' }, // or 'json' or 'hybrid'
  social: {
    redirect: {
      frontendBaseUrl: 'https://your-frontend.example.com',
      allowAbsoluteReturnTo: false,
      allowedReturnToOrigins: ['https://your-frontend.example.com'],
    },
    google: {
      enabled: true,
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackUrl: 'https://api.example.com/auth/social/google/callback',
      scopes: ['openid', 'email', 'profile'],
    },
  },
} as const;
```

If you use hybrid:

```typescript
tokenDelivery: {
  method: 'hybrid',
  hybridPolicy: {
    webOrigins: ['https://your-frontend.example.com'],
    nativeOrigins: ['capacitor://localhost', 'ionic://localhost'],
  },
},
```

## Redirect inputs (returnTo + appState)

| Input | Where | Notes |
| --- | --- | --- |
| `returnTo` | query param on `/auth/social/:provider/redirect` | By default must be a relative path (prevents open redirects) |
| `appState` | query param on `/auth/social/:provider/redirect` | Optional, non-secret string that is echoed back to frontend |

## Backend implementation

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { Module } from '@nestjs/common';
import { AuthModule } from '@nauth-toolkit/nestjs';
import { GoogleSocialAuthModule } from '@nauth-toolkit/social-google/nestjs';
import { SocialRedirectController } from './social-redirect.controller';
import { authConfig } from './auth.config';

@Module({
  imports: [GoogleSocialAuthModule, AuthModule.forRoot(authConfig)],
  controllers: [SocialRedirectController],
})
export class AppModule {}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { NAuth, ExpressAdapter } from '@nauth-toolkit/core';
const nauth = await NAuth.create({ config: authConfig, dataSource, adapter: new ExpressAdapter() });
// Implement /auth/social/* routes and delegate to SocialRedirectHandler
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { NAuth, FastifyAdapter } from '@nauth-toolkit/core';
const nauth = await NAuth.create({ config: authConfig, dataSource, adapter: new FastifyAdapter() });
// Implement /auth/social/* routes and delegate to SocialRedirectHandler
```

</TabItem>
</Tabs>

## Consumer request examples

### Start (browser → backend)

`GET /auth/social/google/redirect?returnTo=/auth/callback&appState=12345`

### Callback (provider → backend)

- Google/Facebook: `GET /auth/social/google/callback?code=...&state=...`
- Apple: `POST /auth/social/apple/callback` (form_post)

### Exchange (frontend → backend)

`POST /auth/social/exchange`

```json
{ "exchangeToken": "..." }
```

## Notes

- **Cluster-safe**: OAuth `state` and redirect context are stored via the transient `StorageAdapter` (Redis/DB), not in-memory.
- **Cookies on 302**: browsers accept `Set-Cookie` on the backend callback response before following the redirect.
- **`appState`**: optional, non-secret string. If you pass JSON, encode it: `encodeURIComponent(JSON.stringify(obj))`.

## Related

- [Social Authentication (Frontend SDK)](/docs/frontend-sdk/guides/social-auth)
- [Token Delivery Modes](/docs/features/token-delivery)
- [Social providers API](/docs/api/social/overview)


