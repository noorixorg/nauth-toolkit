---
title: "Google OAuth"
description: "Set up Google Sign-In with web OAuth redirect and native mobile token verification"
sidebar_position: 1
keywords: [google, oauth, social login, google sign-in, workspace, hosted domain, native mobile]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Google OAuth

Add Google Sign-In to your app. By the end of this guide you will have these endpoints working:

| Endpoint | Method | Auth | Purpose |
| --- | --- | --- | --- |
| `/auth/social/google/redirect` | GET | Public | Start OAuth flow (redirects to Google) |
| `/auth/social/google/callback` | GET | Public | Google callback (exchanges code for tokens) |
| `/auth/social/exchange` | POST | Public | Exchange `exchangeToken` for tokens or challenge |
| `/auth/social/google/verify` | POST | Public | Verify native mobile ID token |

The redirect, callback, and exchange endpoints use the [shared social routes](/docs/guides/social/how-social-login-works#shared-routes) you set up in the How Social Login Works guide. This page adds the Google-specific configuration and the native mobile verify endpoint.

:::tip[Sample apps]
Google social login is fully implemented in the [nauth example apps](https://github.com/noorixorg/nauth-toolkit) — see the NestJS, Express, and Fastify examples for social routes, and the React/Angular examples for the login button and callback handling.
:::

## Prerequisites

- [Shared social routes](/docs/guides/social/how-social-login-works#shared-routes) are set up (redirect, callback, exchange)
- A [frontend callback page](/docs/guides/social/how-social-login-works#frontend-integration) handles the redirect back from the backend

## Step 1: Get Google Credentials

1. Open the [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create or select a project
3. Click **Create Credentials > OAuth client ID**
4. Application type: **Web application**
5. Add **Authorized redirect URIs**:
   - Development: `http://localhost:3000/auth/social/google/callback`
   - Production: `https://api.example.com/auth/social/google/callback`
6. Copy the **Client ID** and **Client Secret**

For native mobile apps, create additional OAuth client IDs:
- **iOS**: Application type "iOS", enter your bundle ID
- **Android**: Application type "Android", enter your package name and SHA-1 fingerprint

## Step 2: Install

```bash npm2yarn
npm install @nauth-toolkit/social-google
```

## Step 3: Configure

```typescript title="config/auth.config.ts"
social: {
  google: {
    enabled: true,
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl: `${process.env.API_BASE_URL}/auth/social/google/callback`,
    scopes: ['openid', 'email', 'profile'],
    autoLink: true,
    allowSignup: true,
  },
},
```

If your app runs on multiple platforms (web + iOS + Android), pass an array of client IDs. The token verifier accepts any of them:

```typescript title="config/auth.config.ts"
social: {
  google: {
    clientId: [
      process.env.GOOGLE_CLIENT_ID,           // Web
      process.env.GOOGLE_IOS_CLIENT_ID,       // iOS
      process.env.GOOGLE_ANDROID_CLIENT_ID,   // Android
    ],
    // ...rest of config
  },
},
```

## Step 4: Add the Verify Route

This endpoint verifies native Google ID tokens from Capacitor, React Native, or Flutter apps. Skip this step if you only need web OAuth.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS" default>

```typescript title="src/auth/social-redirect.controller.ts"
import { Inject, BadRequestException, Optional } from '@nestjs/common';
import { VerifyTokenDTO, AuthResponseDTO } from '@nauth-toolkit/nestjs';
import { GoogleSocialAuthService } from '@nauth-toolkit/social-google/nestjs';

// Add to your SocialRedirectController:
constructor(
  private readonly socialRedirect: SocialRedirectHandler,
  @Optional() @Inject(GoogleSocialAuthService)
  private readonly googleAuth?: GoogleSocialAuthService,
) {}

@Public()
@Post('google/verify')
async verifyGoogle(@Body() dto: VerifyTokenDTO): Promise<AuthResponseDTO> {
  if (!this.googleAuth) throw new BadRequestException('Google OAuth is not configured');
  return await this.googleAuth.verifyToken(dto);
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript title="src/routes/social.routes.ts"
// Add to your social router:
router.post('/google/verify', nauth.helpers.public(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!nauth.googleAuth) return res.status(400).json({ error: 'Google OAuth is not configured' });
    res.json(await nauth.googleAuth.verifyToken(req.body));
  } catch (err) { next(err); }
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript title="src/routes/social.routes.ts"
// Add to your social routes:
fastify.post('/auth/social/google/verify', { preHandler: [nauth.helpers.public()] },
  nauth.adapter.wrapRouteHandler(async (req, res) => {
    if (!nauth.googleAuth) { res.status(400).json({ error: 'Google OAuth is not configured' }); return; }
    res.json(await nauth.googleAuth.verifyToken(req.body as any));
  }) as any
);
```

</TabItem>
</Tabs>

## Step 5: Frontend

### Trigger the login

```typescript
// Using the frontend SDK:
await client.loginWithSocial('google', {
  returnTo: `${window.location.origin}/auth/callback`,
  oauthParams: { prompt: 'select_account' },
});
```

This navigates the browser to `GET /auth/social/google/redirect?returnTo=/auth/callback`. The backend redirects to Google's consent screen.

### Handle the callback

After the user authenticates with Google, the backend redirects to your `returnTo` URL. Your [callback page](/docs/guides/social/how-social-login-works#frontend-integration) handles the rest — exchanging the token if needed and navigating the user.

## Web Flow: Request and Response Reference

### 1. Start redirect

```
GET /auth/social/google/redirect?returnTo=/auth/callback&appState=invite-123
```

Backend responds with `302 Redirect` to Google's OAuth consent screen.

### 2. Google callback

Google redirects to:

```
GET /auth/social/google/callback?code=4/0AX4XfW...&state=csrf-token-here
```

The backend exchanges the code for a Google access token, fetches the user profile, creates or links the account, and redirects to your frontend:

- **Cookies mode (no challenge):** `https://app.example.com/auth/callback?appState=invite-123`
- **JSON/hybrid mode or challenge pending:** `https://app.example.com/auth/callback?exchangeToken=eyJ...&appState=invite-123`

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
    "email": "user@gmail.com",
    "firstName": "John",
    "lastName": "Doe",
    "isEmailVerified": true
  }
}
```

If MFA is configured, the exchange may return a challenge instead:

```json
{
  "challengeName": "MFA_REQUIRED",
  "session": "a21b654c-2746-4168-acee-c175083a65cd",
  "challengeParameters": {
    "availableMethods": ["totp"],
    "preferredMethod": "totp"
  }
}
```

Complete the challenge via `/auth/respond-challenge` as described in [How Social Login Works > Challenges](/docs/guides/social/how-social-login-works#challenges-after-social-login).

## Native Mobile: Request and Response Reference

For Capacitor/React Native apps using the Google Sign-In SDK:

**Request body** ([`VerifyTokenDTO`](/docs/api/core/dto/verify-token-dto)):

```json
{
  "provider": "google",
  "idToken": "eyJhbGciOiJSUzI1NiIs...",
  "accessToken": "ya29.a0AfH6SM..."
}
```

**Response** — same structure as web flow (tokens + user, or challenge if MFA is required).

The backend verifies the ID token's JWT signature against [Google's JWKS keys](https://www.googleapis.com/oauth2/v3/certs), validates the `aud` claim against your configured client IDs, and checks that the email is verified. 5-minute clock tolerance handles minor device/server time differences.

## OAuth Parameters

Customize Google's consent screen behavior via config defaults or per-request overrides:

| Parameter | Values | Effect |
| --- | --- | --- |
| `prompt` | `select_account`, `consent`, `none` | Force account chooser, re-consent, or silent auth |
| `hd` | Domain string (e.g., `company.com`) | Restrict to a Google Workspace domain |
| `login_hint` | Email address | Pre-fill the email field |
| `include_granted_scopes` | `true` | Enable incremental authorization |

Set defaults in config:

```typescript title="config/auth.config.ts"
social: {
  google: {
    // ...credentials...
    oauthParams: {
      prompt: 'select_account',
      hd: 'company.com',
    },
  },
},
```

Override per-request from the frontend:

```typescript
await client.loginWithSocial('google', {
  returnTo: '/dashboard',
  oauthParams: { prompt: 'consent', hd: 'company.com' },
});
```

:::note[Hosted domain filtering]
The `hd` parameter only filters the account chooser UI — it does not enforce domain restriction server-side. If you need strict enforcement, validate the user's email domain in a [post-signup hook](/docs/guides/lifecycle-hooks).
:::

## What's Next

- **[Apple OAuth](/docs/guides/social/apple)** — Required for iOS apps with third-party login
- **[Facebook OAuth](/docs/guides/social/facebook)** — Standard OAuth 2.0
- **[How Social Login Works](/docs/guides/social/how-social-login-works)** — Account linking, challenges, error codes
