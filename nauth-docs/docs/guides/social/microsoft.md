---
title: "Microsoft Entra ID"
description: "Set up Microsoft sign-in: personal accounts, Microsoft 365 tenant SSO, tenant pinning, and app-role or group access gating"
sidebar_position: 4
keywords: [microsoft, entra, azure ad, office 365, microsoft 365, sso, oauth, social login, app roles, tenant]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Microsoft Entra ID

Add Microsoft sign-in to your app. A Microsoft 365 subscription includes Entra ID (formerly Azure AD) as its identity provider, so "sign in with Microsoft" and "SSO against our Microsoft 365 tenant" are the same OIDC flow against the same endpoints — one config value decides which population can sign in.

By the end of this guide you will have these endpoints working:

| Endpoint | Method | Auth | Purpose |
| --- | --- | --- | --- |
| `/auth/social/microsoft/redirect` | GET | Public | Start OAuth flow (redirects to Microsoft) |
| `/auth/social/microsoft/callback` | GET | Public | Microsoft callback (exchanges code for tokens) |
| `/auth/social/exchange` | POST | Public | Exchange `exchangeToken` for tokens or challenge |
| `/auth/social/microsoft/verify` | POST | Public | Verify native mobile ID token (MSAL) |

The redirect, callback, and exchange endpoints use the [shared social routes](/docs/guides/social/how-social-login-works#shared-routes) you set up in the How Social Login Works guide. This page adds the Microsoft-specific configuration.

## Prerequisites

- [Shared social routes](/docs/guides/social/how-social-login-works#shared-routes) are set up (redirect, callback, exchange)
- A [frontend callback page](/docs/guides/social/how-social-login-works#frontend-integration) handles the redirect back from the backend

## Step 1: Register the Application

1. Open the [Azure portal](https://portal.azure.com) and go to **Microsoft Entra ID > App registrations**
2. Click **New registration**
3. Under **Supported account types**, choose the population you intend to serve — this must match the `tenant` value you configure in Step 3:

   | Supported account types | Matching `tenant` |
   | --- | --- |
   | Accounts in this organizational directory only | Your directory GUID |
   | Accounts in any organizational directory | `organizations` |
   | Accounts in any organizational directory and personal Microsoft accounts | `common` |
   | Personal Microsoft accounts only | `consumers` |

4. Add a **Redirect URI** of type *Web*:
   - Development: `http://localhost:3000/auth/social/microsoft/callback`
   - Production: `https://api.example.com/auth/social/microsoft/callback`
5. Copy the **Application (client) ID** and, for a single-tenant app, the **Directory (tenant) ID**
6. Under **Certificates & secrets**, create a **New client secret** and copy its value

:::note[Admin consent]
Many organisations disable user self-consent, so an administrator has to grant consent for your app even with only the basic `openid`, `profile` and `email` scopes. No paid Entra tier is required — OIDC sign-in works on the free tier bundled with any Microsoft 365 subscription.
:::

### Enable the email-ownership claim

Under **Token configuration > Add optional claim**, add `xms_edov` to the **ID** token. This claim tells nauth-toolkit whether the tenant is verified as owning the user's email domain, which is what allows a work account to be auto-linked to an existing local account with the same email. Without it, work-account sign-ins create separate accounts. See [How Identity Is Resolved](#how-identity-is-resolved) below for why.

## Step 2: Install

```bash npm2yarn
npm install @nauth-toolkit/social-microsoft
```

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS" default>

```typescript title="src/app.module.ts"
import { MicrosoftSocialAuthModule } from '@nauth-toolkit/social-microsoft/nestjs';

@Module({
  imports: [AuthModule.forRoot(authConfig), MicrosoftSocialAuthModule],
})
export class AppModule {}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript title="src/main.ts"
// The provider is discovered from config — no extra registration needed.
const nauth = await NAuth.create({ config, dataSource, adapter: new ExpressAdapter() });
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript title="src/main.ts"
// The provider is discovered from config — no extra registration needed.
const nauth = await NAuth.create({ config, dataSource, adapter: new FastifyAdapter() });
```

</TabItem>
</Tabs>

## Step 3: Configure

### Public sign-in

Anyone with a Microsoft account, personal or work — the same experience as the Google or Facebook providers:

```typescript title="config/auth.config.ts"
social: {
  microsoft: {
    enabled: true,
    clientId: process.env.MS_CLIENT_ID,
    clientSecret: process.env.MS_CLIENT_SECRET,
    callbackUrl: `${process.env.API_BASE_URL}/auth/social/microsoft/callback`,
    tenant: 'common',
    scopes: ['openid', 'email', 'profile'],
    autoLink: true,
    allowSignup: true,
  },
},
```

### One organisation's Microsoft 365 tenant

Pin `tenant` to the directory GUID. Nobody outside that organisation can sign in, and staff are provisioned on first login:

```typescript title="config/auth.config.ts"
social: {
  microsoft: {
    enabled: true,
    clientId: process.env.MS_CLIENT_ID,
    clientSecret: process.env.MS_CLIENT_SECRET,
    callbackUrl: `${process.env.API_BASE_URL}/auth/social/microsoft/callback`,
    tenant: process.env.MS_TENANT_ID,
    autoLink: true,
    allowSignup: true,
  },
},
```

### Tenant values

| Value | Who can sign in |
| --- | --- |
| `common` | Work/school accounts from **any** directory, plus personal accounts |
| `organizations` | Work/school accounts from any directory |
| `consumers` | Personal Microsoft accounts only |
| A directory GUID or verified domain | That one organisation only |

:::warning
`common` means everyone, not just consumers — it admits work accounts from directories you have never heard of. If your app serves one organisation, pin its GUID. If it serves several, set `allowedTenants` to a closed list.
:::

## Step 4: Restrict Who Gets In

Authentication proves who someone is. Deciding whether that person may use your app is separate, and there are three places to do it.

### Entra assignment (recommended)

In the customer's tenant: **Enterprise applications > your app > Properties > Assignment required = Yes**, then assign users or groups under **Users and groups**. Microsoft refuses unassigned users at the identity provider — they never reach your callback, and you write no code. Joiners and leavers are then managed entirely in the Microsoft 365 admin portal.

### App roles

Define roles in the app registration manifest, let the customer's administrator assign users or groups to them, then require one:

```typescript title="config/auth.config.ts"
social: {
  microsoft: {
    // ...credentials and tenant...
    requiredRoles: ['nauth.access'],
  },
},
```

A user holding none of the listed roles is refused with `SOCIAL_ACCESS_DENIED` (HTTP 403). The check runs on **every** sign-in, so revoking a role locks the user out at their next login attempt.

### Security groups

Matched against group object ids, not names:

```typescript title="config/auth.config.ts"
social: {
  microsoft: {
    // ...credentials and tenant...
    requiredGroups: ['0a1b2c3d-4e5f-6071-8293-a4b5c6d7e8f9'],
  },
},
```

:::warning[Groups claim overage]
Entra omits the `groups` claim entirely once a user belongs to more than roughly 200 groups, replacing it with a pointer to Graph. nauth-toolkit **denies** sign-in in that case rather than reading it as "member of no groups" — otherwise the most heavily group-assigned users would bypass the gate. Configure **Token configuration > groups claim > Groups assigned to the application** to avoid it, or use `requiredRoles` instead.
:::

## Step 5: Frontend

### Trigger the login

```typescript
await client.loginWithSocial('microsoft', {
  returnTo: `${window.location.origin}/auth/callback`,
});
```

This navigates the browser to `GET /auth/social/microsoft/redirect?returnTo=/auth/callback`. The backend redirects to Microsoft.

With a pinned tenant, users already signed into Microsoft 365 in that browser usually pass straight through with no prompt at all, honouring the organisation's own MFA and Conditional Access policies.

### Handle the callback

After the user authenticates, the backend redirects to your `returnTo` URL. Your [callback page](/docs/guides/social/how-social-login-works#frontend-integration) handles the rest — exchanging the token if needed and navigating the user.

Show a helpful message when access is refused:

```typescript
import { NAuthErrorCode } from '@nauth-toolkit/client';

try {
  await client.exchangeSocialRedirect(exchangeToken);
} catch (err) {
  if ((err as { code?: string }).code === NAuthErrorCode.SOCIAL_ACCESS_DENIED) {
    // Authentication succeeded, but the account is not permitted to use this app
    showMessage('Your Microsoft account is not authorised for this application. Contact your IT administrator.');
  }
}
```

## Web Flow: Request and Response Reference

### 1. Start redirect

```
GET /auth/social/microsoft/redirect?returnTo=/auth/callback&appState=invite-123
```

Backend responds with `302 Redirect` to Microsoft's sign-in page.

### 2. Microsoft callback

Microsoft redirects to:

```
GET /auth/social/microsoft/callback?code=0.AXoA...&state=csrf-token-here
```

The backend exchanges the code for tokens, verifies the ID token, applies the access gate, creates or links the account, and redirects to your frontend:

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
    "email": "ada@contoso.com",
    "firstName": "Ada",
    "lastName": "Lovelace",
    "isEmailVerified": true
  }
}
```

If MFA is configured, the exchange may return a challenge instead. Complete it via `/auth/respond-challenge` as described in [How Social Login Works > Challenges](/docs/guides/social/how-social-login-works#challenges-after-social-login).

## Native Mobile: Request and Response Reference

For apps using MSAL:

**Request body** ([`VerifyTokenDTO`](/docs/api/core/dto/verify-token-dto)):

```json
{
  "provider": "microsoft",
  "idToken": "eyJhbGciOiJSUzI1NiIs..."
}
```

**Response** — same structure as the web flow. The access gate applies here too.

The backend verifies the ID token signature against Entra's JWKS keys, validates `aud` against your configured client IDs, and binds `iss` to the token's own `tid` claim. 5-minute clock tolerance handles minor device/server time differences.

## How Identity Is Resolved

Two details differ from the other social providers and are worth understanding before you go live.

### Accounts are joined on `oid`, not email

The linked social account records the `oid` claim — the user's immutable id within their directory. Email is not used as an identity, and neither is `sub`, which is pairwise per application and so differs between your apps.

### Email is only trusted when Microsoft proves ownership

Microsoft emits no `email_verified` claim, so nauth-toolkit derives the equivalent:

| Account type | Email trusted for auto-linking |
| --- | --- |
| Personal Microsoft account | Yes — Microsoft verifies ownership before an address can become an account alias |
| Work/school with `xms_edov: true` | Yes — the tenant is confirmed as owning the email domain |
| Work/school without `xms_edov` | No |

:::warning
This is why the `xms_edov` optional claim matters. For work accounts, a tenant administrator controls the `email` and `upn` values of users in their own directory, including domains they do not own. Auto-linking on an unproven email would let someone create a directory, set a user's email to `ceo@yourcustomer.com`, and be merged into that account — the [nOAuth](https://www.descope.com/blog/post/noauth) pattern. Without `xms_edov`, a matching email produces a separate account rather than a merge.
:::

## Limits

Revoking a user in Entra does not terminate their existing nauth-toolkit session or refresh token — access ends when those expire. If a customer expects "disable in Microsoft 365, locked out immediately", shorten `jwt.accessToken.expiresIn` accordingly.

## What's Next

- **[How Social Login Works](/docs/guides/social/how-social-login-works)** — Account linking, challenges, error codes
- **[Microsoft Provider API](/docs/api/social/microsoft)** — Full configuration and export reference
- **[Google OAuth](/docs/guides/social/google)** — Standard OAuth 2.0 with hosted-domain filtering
- **[Lifecycle Hooks](/docs/guides/lifecycle-hooks)** — Run your own checks at signup
