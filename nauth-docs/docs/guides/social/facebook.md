---
title: "Facebook OAuth"
description: "Set up Facebook Login with OAuth 2.0 and native mobile token verification"
sidebar_position: 3
keywords: [facebook, oauth, social login, facebook login, graph api, limited login]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Facebook OAuth

Add Facebook Login to your app. By the end of this guide you will have these endpoints working:

| Endpoint | Method | Auth | Purpose |
| --- | --- | --- | --- |
| `/auth/social/facebook/redirect` | GET | Public | Start OAuth flow (redirects to Facebook) |
| `/auth/social/facebook/callback` | GET | Public | Facebook callback (exchanges code for tokens) |
| `/auth/social/exchange` | POST | Public | Exchange `exchangeToken` for tokens or challenge |
| `/auth/social/facebook/verify` | POST | Public | Verify native mobile token |

The redirect, callback, and exchange endpoints use the [shared social routes](/docs/guides/social/how-social-login-works#shared-routes). This page adds Facebook-specific configuration and the native mobile verify endpoint.

:::tip Sample apps
Facebook social login is fully implemented in the [nauth example apps](https://github.com/noorixorg/nauth-toolkit) — see the NestJS, Express, and Fastify examples for social routes, and the React/Angular examples for the login button and callback handling.
:::

## Prerequisites

- [Shared social routes](/docs/guides/social/how-social-login-works#shared-routes) are set up (redirect, callback, exchange)
- A [frontend callback page](/docs/guides/social/how-social-login-works#frontend-integration) handles the redirect back from the backend

## Step 1: Get Facebook Credentials

1. Go to the [Meta Developer Dashboard](https://developers.facebook.com/apps/) and create a new app (or select an existing one)
2. Add the **Facebook Login** product
3. Under **Facebook Login > Settings**, add your callback URL to **Valid OAuth Redirect URIs**:
   - Development: `http://localhost:3000/auth/social/facebook/callback`
   - Production: `https://api.example.com/auth/social/facebook/callback`
4. Under **App Settings > Basic**, copy the **App ID** and **App Secret**

:::note App review
During development, only test users and app administrators can log in. For production, submit your app for [App Review](https://developers.facebook.com/docs/app-review/) to allow all Facebook users.
:::

## Step 2: Install

```bash npm2yarn
npm install @nauth-toolkit/social-facebook
```

## Step 3: Configure

```typescript title="config/auth.config.ts"
social: {
  facebook: {
    enabled: true,
    clientId: process.env.FACEBOOK_CLIENT_ID,
    clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
    callbackUrl: `${process.env.API_BASE_URL}/auth/social/facebook/callback`,
    scopes: ['email', 'public_profile'],
    autoLink: true,
    allowSignup: true,
  },
},
```

## Step 4: Add the Verify Route (Optional — Native Mobile)

For native mobile apps using the Facebook SDK. Skip this step if you only need web OAuth.

Facebook supports two native authentication flows:
- **Classic Login** — returns an opaque access token (verified via Graph API)
- **Limited Login** (iOS) — returns a JWT ID token (verified via Facebook OIDC JWKS)

The backend auto-detects the token type and uses the correct verification method.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS" default>

```typescript title="src/auth/social-redirect.controller.ts"
import { Inject, BadRequestException, Optional } from '@nestjs/common';
import { VerifyTokenDTO, AuthResponseDTO } from '@nauth-toolkit/nestjs';
import { FacebookSocialAuthService } from '@nauth-toolkit/social-facebook/nestjs';

// Add to your SocialRedirectController:
constructor(
  private readonly socialRedirect: SocialRedirectHandler,
  @Optional() @Inject(FacebookSocialAuthService)
  private readonly facebookAuth?: FacebookSocialAuthService,
) {}

@Public()
@Post('facebook/verify')
async verifyFacebook(@Body() dto: VerifyTokenDTO): Promise<AuthResponseDTO> {
  if (!this.facebookAuth) throw new BadRequestException('Facebook OAuth is not configured');
  return await this.facebookAuth.verifyToken(dto);
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript title="src/routes/social.routes.ts"
// Add to your social router:
router.post('/facebook/verify', nauth.helpers.public(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!nauth.facebookAuth) return res.status(400).json({ error: 'Facebook OAuth is not configured' });
    res.json(await nauth.facebookAuth.verifyToken(req.body));
  } catch (err) { next(err); }
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript title="src/routes/social.routes.ts"
// Add to your social routes:
fastify.post('/auth/social/facebook/verify', { preHandler: [nauth.helpers.public()] },
  nauth.adapter.wrapRouteHandler(async (req, res) => {
    if (!nauth.facebookAuth) { res.status(400).json({ error: 'Facebook OAuth is not configured' }); return; }
    res.json(await nauth.facebookAuth.verifyToken(req.body as any));
  }) as any
);
```

</TabItem>
</Tabs>

## Step 5: Frontend

### Trigger the login

```typescript
await client.loginWithSocial('facebook', {
  returnTo: `${window.location.origin}/auth/callback`,
});
```

This navigates to `GET /auth/social/facebook/redirect?returnTo=/auth/callback`. The backend redirects to Facebook's login dialog.

### Handle the callback

After the user authenticates with Facebook, the backend redirects to your `returnTo` URL. Your [callback page](/docs/guides/social/how-social-login-works#frontend-integration) handles the rest.

## Web Flow: Request and Response Reference

### 1. Start redirect

```
GET /auth/social/facebook/redirect?returnTo=/auth/callback
```

Backend responds with `302 Redirect` to Facebook's login dialog.

### 2. Facebook callback

Facebook redirects to:

```
GET /auth/social/facebook/callback?code=AQB7e2...&state=csrf-token-here
```

The backend exchanges the code for a Facebook access token, fetches the user profile from the Graph API (`v24.0`), creates or links the account, and redirects to your frontend.

**Fields fetched from Graph API:** `id`, `email`, `first_name`, `last_name`, `picture`

### 3. Exchange (JSON/hybrid mode)

**Request body** ([`SocialExchangeDTO`](/docs/api/core/dto/social-exchange-dto)):

```json
{
  "exchangeToken": "eyJhbGciOiJIUzI1NiJ9..."
}
```

**Response** — tokens + user:

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiJ9...",
  "accessTokenExpiresAt": 1700000000,
  "refreshTokenExpiresAt": 1700600000,
  "user": {
    "sub": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "isEmailVerified": true
  }
}
```

If MFA is configured, the exchange may return a challenge instead — complete it via `/auth/respond-challenge` as described in [How Social Login Works > Challenges](/docs/guides/social/how-social-login-works#challenges-after-social-login).

## Native Mobile: Request and Response Reference

### Classic Login (Access Token)

Standard Facebook SDK login returns an opaque access token. The backend verifies it via the Graph API `debug_token` endpoint, then fetches the user profile.

**Request body** ([`VerifyTokenDTO`](/docs/api/core/dto/verify-token-dto)):

```json
{
  "provider": "facebook",
  "accessToken": "EAAGm0PX4ZCps..."
}
```

### Limited Login (iOS JWT)

Facebook's [Limited Login](https://developers.facebook.com/docs/facebook-login/limited-login/) for iOS returns a JWT ID token. The backend verifies the JWT signature against [Facebook's OIDC JWKS keys](https://www.facebook.com/.well-known/oauth/openid/jwks/).

**Request body:**

```json
{
  "provider": "facebook",
  "idToken": "eyJhbGciOiJSUzI1NiIs..."
}
```

The backend auto-detects whether the token is a JWT (three-part base64 structure) or an opaque access token and routes to the correct verification flow.

**Response** — same structure as web flow (tokens + user, or challenge if MFA is required).

## OAuth Parameters

Customize Facebook's login dialog behavior:

| Parameter | Values | Effect |
| --- | --- | --- |
| `auth_type` | `rerequest`, `reauthenticate` | Re-ask for declined permissions, or force re-authentication |
| `display` | `page`, `popup`, `touch` | Control the login dialog display mode |

```typescript title="config/auth.config.ts"
social: {
  facebook: {
    // ...credentials...
    oauthParams: {
      auth_type: 'rerequest',    // Re-ask if user previously declined email permission
      display: 'popup',
    },
  },
},
```

## Facebook-Specific Behaviors

### Email is Required

nauth-toolkit requires an email from Facebook. If the user has not verified their email with Facebook or declines the `email` permission, authentication fails with `SOCIAL_EMAIL_REQUIRED`. All emails returned by Facebook are treated as verified.

### No Refresh Tokens from Facebook

Facebook does not provide refresh tokens in the OAuth flow. This does not affect your app — nauth-toolkit issues its own access and refresh tokens after authentication.

## What's Next

- **[Google OAuth](/docs/guides/social/google)** — Web OAuth + native mobile, Workspace domain restriction
- **[Apple OAuth](/docs/guides/social/apple)** — Required for iOS apps, JWT client secret, form_post callback
- **[How Social Login Works](/docs/guides/social/how-social-login-works)** — Account linking, challenges, error codes
