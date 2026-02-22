---
title: "Apple OAuth"
description: "Set up Sign in with Apple for web and iOS apps with automatic JWT client secret management"
sidebar_position: 2
keywords: [apple, oauth, social login, sign in with apple, ios, form_post, jwt, private relay]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Apple OAuth

Add Sign in with Apple to your app. By the end of this guide you will have these endpoints working:

| Endpoint | Method | Auth | Purpose |
| --- | --- | --- | --- |
| `/auth/social/apple/redirect` | GET | Public | Start OAuth flow (redirects to Apple) |
| `/auth/social/apple/callback` | POST | Public | Apple callback (`form_post` with authorization code) |
| `/auth/social/exchange` | POST | Public | Exchange `exchangeToken` for tokens or challenge |
| `/auth/social/apple/verify` | POST | Public | Verify native iOS identity token |

The redirect, callback, and exchange endpoints use the [shared social routes](/docs/guides/social/how-social-login-works#shared-routes). This page adds Apple-specific configuration and the native iOS verify endpoint.

:::tip Sample apps
Apple social login is fully implemented in the [nauth example apps](https://github.com/noorixorg/nauth) — see the NestJS, Express, and Fastify examples for social routes, and the React/Angular examples for the login button and callback handling.
:::

## Prerequisites

- [Shared social routes](/docs/guides/social/how-social-login-works#shared-routes) are set up (redirect, callback, exchange)
- A [frontend callback page](/docs/guides/social/how-social-login-works#frontend-integration) handles the redirect back from the backend
- Apple Developer account (paid membership required)

## Step 1: Get Apple Credentials

**Register an App ID** (if not already done):
1. Go to [Certificates, Identifiers & Profiles > Identifiers](https://developer.apple.com/account/resources/identifiers/list)
2. Create an App ID with the **Sign in with Apple** capability enabled

**Create a Service ID** (for web OAuth):
1. Go to **Identifiers > Service IDs** and register a new identifier (e.g., `com.yourapp.services`)
2. Enable **Sign in with Apple** and configure:
   - **Primary App ID**: Select your App ID from above
   - **Domains**: Your API domain (e.g., `api.example.com` or `localhost` for dev)
   - **Return URLs**: `https://api.example.com/auth/social/apple/callback`

**Create a private key**:
1. Go to **Keys** and create a new key
2. Enable **Sign in with Apple**
3. Download the `.p8` file (you can only download it once)
4. Note the **Key ID** shown after creation

**Note your credentials**:
- **Client ID** = Service ID identifier (e.g., `com.yourapp.services`)
- **Team ID** = Found in Membership details (e.g., `ABC123DEF4`)
- **Key ID** = Shown after key creation (e.g., `XYZ789ABC0`)
- **Private Key** = Contents of the `.p8` file

## Step 2: Install

```bash npm2yarn
npm install @nauth-toolkit/social-apple
```

## Step 3: Configure

```typescript title="config/auth.config.ts"
social: {
  apple: {
    enabled: true,
    clientId: 'com.yourapp.services',
    teamId: process.env.APPLE_TEAM_ID,
    keyId: process.env.APPLE_KEY_ID,
    privateKeyPem: process.env.APPLE_PRIVATE_KEY_PEM,
    callbackUrl: `${process.env.API_BASE_URL}/auth/social/apple/callback`,
    scopes: ['name', 'email'],
    autoLink: true,
    allowSignup: true,
  },
},
```

If your app has both a website and an iOS app, pass both identifiers:

```typescript title="config/auth.config.ts"
social: {
  apple: {
    clientId: [
      'com.yourapp.services',   // Service ID (web OAuth)
      'com.yourapp',            // App Bundle ID (native iOS)
    ],
    // ...rest of config
  },
},
```

The web flow uses the first client ID (Service ID). Native token verification accepts either.

:::note JWT client secret
Apple does not use a static client secret. nauth-toolkit auto-generates an ES256-signed JWT from your `teamId`, `keyId`, and `privateKeyPem`, stores it in the database, and refreshes it when less than 30 days until expiration (180-day lifetime). No manual JWT management needed.
:::

:::tip Private key format
The `privateKeyPem` field accepts both multi-line PEM format and single-line with `\n` escapes. Both are normalized automatically.
:::

## Step 4: Ensure Form Body Parsing

Apple sends callbacks as **HTTP POST** with `application/x-www-form-urlencoded` body (`form_post` response mode) instead of URL query parameters. Your backend must parse form-encoded bodies:

- **Express**: Built-in via `express.urlencoded({ extended: true })` middleware
- **Fastify**: Requires the `@fastify/formbody` plugin
- **NestJS**: Handled automatically

The shared social routes already include a POST callback handler for this — see the `callbackPost` route in [How Social Login Works](/docs/guides/social/how-social-login-works#web-oauth-routes).

## Step 5: Add the Verify Route (Optional — iOS Only)

For native iOS apps using Apple's `AuthenticationServices` framework. Skip this step if you only need web OAuth.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS" default>

```typescript title="src/auth/social-redirect.controller.ts"
import { Inject, BadRequestException, Optional } from '@nestjs/common';
import { VerifyTokenDTO, AuthResponseDTO } from '@nauth-toolkit/nestjs';
import { AppleSocialAuthService } from '@nauth-toolkit/social-apple/nestjs';

// Add to your SocialRedirectController:
constructor(
  private readonly socialRedirect: SocialRedirectHandler,
  @Optional() @Inject(AppleSocialAuthService)
  private readonly appleAuth?: AppleSocialAuthService,
) {}

@Public()
@Post('apple/verify')
async verifyApple(@Body() dto: VerifyTokenDTO): Promise<AuthResponseDTO> {
  if (!this.appleAuth) throw new BadRequestException('Apple OAuth is not configured');
  return await this.appleAuth.verifyToken(dto);
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript title="src/routes/social.routes.ts"
// Add to your social router:
router.post('/apple/verify', nauth.helpers.public(), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!nauth.appleAuth) return res.status(400).json({ error: 'Apple OAuth is not configured' });
    res.json(await nauth.appleAuth.verifyToken(req.body));
  } catch (err) { next(err); }
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript title="src/routes/social.routes.ts"
// Add to your social routes:
fastify.post('/auth/social/apple/verify', { preHandler: [nauth.helpers.public()] },
  nauth.adapter.wrapRouteHandler(async (req, res) => {
    if (!nauth.appleAuth) { res.status(400).json({ error: 'Apple OAuth is not configured' }); return; }
    res.json(await nauth.appleAuth.verifyToken(req.body as any));
  }) as any
);
```

</TabItem>
</Tabs>

## Step 6: Frontend

### Trigger the login

```typescript
await client.loginWithSocial('apple', {
  returnTo: `${window.location.origin}/auth/callback`,
});
```

This navigates to `GET /auth/social/apple/redirect?returnTo=/auth/callback`. The backend redirects to Apple's sign-in page.

### Handle the callback

After the user authenticates with Apple, the backend redirects to your `returnTo` URL. Your [callback page](/docs/guides/social/how-social-login-works#frontend-integration) handles the rest.

## Web Flow: Request and Response Reference

### 1. Start redirect

```
GET /auth/social/apple/redirect?returnTo=/auth/callback
```

Backend responds with `302 Redirect` to Apple's sign-in page.

### 2. Apple callback (form_post)

Apple sends a POST request to your callback URL:

```
POST /auth/social/apple/callback
Content-Type: application/x-www-form-urlencoded

code=abc123...&state=csrf-token&user={"name":{"firstName":"John","lastName":"Doe"},"email":"john@example.com"}
```

The `user` field is only included on the **first sign-in**. On subsequent sign-ins, Apple omits it entirely. nauth-toolkit stores the name on first sign-in and uses it for all future sessions.

The backend exchanges the code for an Apple access token + ID token, verifies the ID token against [Apple's JWKS keys](https://appleid.apple.com/auth/keys), creates or links the account, and redirects to your frontend.

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
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "isEmailVerified": true
  }
}
```

If MFA is configured, the exchange may return a challenge instead — complete it via `/auth/respond-challenge` as described in [How Social Login Works > Challenges](/docs/guides/social/how-social-login-works#challenges-after-social-login).

## Native iOS: Request and Response Reference

For native iOS apps using `AuthenticationServices`:

**Request body** ([`VerifyTokenDTO`](/docs/api/core/dto/verify-token-dto)):

```json
{
  "idToken": "eyJraWQiOiJXNldjT0tCIiwiYWxn..."
}
```

**Response** — same structure as web flow (tokens + user, or challenge if MFA is required).

The backend verifies the token's JWT signature against [Apple's JWKS keys](https://appleid.apple.com/auth/keys), validates the issuer (`https://appleid.apple.com`) and audience, and checks that the email is verified. 5-minute clock tolerance handles device/server time differences.

## Apple-Specific Behaviors

### Private Email Relay

Users can choose **Hide My Email** during sign-in, providing a relay address (e.g., `abc123@privaterelay.appleid.com`) instead of their real email. This relay:
- Forwards to the user's real email
- Is unique per app
- Works normally for verification codes, MFA, and all email operations

### No Profile Pictures

Apple does not provide profile picture URLs. The `picture` field is always `null` in the user profile.

### Re-triggering First Sign-In

If a user needs to re-provide their name (e.g., after account deletion), they must revoke your app's access in **Apple ID Settings > Sign in with Apple** before signing in again.

## What's Next

- **[Google OAuth](/docs/guides/social/google)** — Web OAuth + native mobile, Workspace domain restriction
- **[Facebook OAuth](/docs/guides/social/facebook)** — Standard OAuth 2.0
- **[How Social Login Works](/docs/guides/social/how-social-login-works)** — Account linking, challenges, error codes
