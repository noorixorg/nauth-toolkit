---
title: Microsoft Provider
description: "Microsoft Entra ID provider: tenant pinning, xms_edov email trust, requiredRoles and requiredGroups access gate, MicrosoftSocialAuthService exports"
keywords: [social, oauth, microsoft, entra, azure-ad, office-365, sso, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Microsoft Provider

**Package:** `@nauth-toolkit/social-microsoft`
**Type:** Social Auth Provider

```bash npm2yarn
npm install @nauth-toolkit/social-microsoft
```

Serves both populations the Microsoft identity platform covers: personal Microsoft accounts and work or school accounts from an Entra ID (Microsoft 365) directory. Which one is admitted depends on `tenant`.

## Exports

| Export | Type | Entry |
|--------|------|-------|
| `MicrosoftSocialAuthService` | Class | Default |
| `MicrosoftOAuthClient` | Class | Default |
| `MicrosoftOAuthConfig` | Interface | Default |
| `TokenVerifierService` | Class | Default |
| `VerifiedMicrosoftTokenProfile` | Interface | Default |
| `VerifyMicrosoftTokenOptions` | Interface | Default |
| `MicrosoftSocialAuthModule` | NestJS Module | `/nestjs` |

Tenant helpers (`MSA_TENANT_ID`, `authorizeEndpoint`, `expectedIssuer`, `isPersonalAccountTenant`, `isTenantGuid`, `isValidTenant`, `jwksEndpoint`, `tokenEndpoint`) are also exported from the default entry.

## Configuration

Configure Microsoft under `config.social.microsoft` (in `@nauth-toolkit/core` config).

| Key | Type | Required | Description |
| --- | --- | --- | --- |
| `allowedTenants` | `string[]` | No | Extra directory ids permitted to sign in. Turns `common`/`organizations` into a closed allowlist. Ignored when `tenant` is a GUID. |
| `allowSignup` | `boolean` | No | Allow creating new users on first login |
| `autoLink` | `boolean` | No | Auto-link to existing users by verified email |
| `callbackUrl` | `string` | Yes (if enabled) | Backend callback URL (`/auth/social/microsoft/callback`) |
| `clientId` | `string \| string[]` | Yes (if enabled) | Application (client) ID from the app registration |
| `clientSecret` | `string` | Yes (if enabled) | Client secret from the app registration |
| `enabled` | `boolean` | No | Enable Microsoft OAuth |
| `oauthParams` | `Record<string, string>` | No | Additional OAuth parameters appended to the authorization URL. Act as defaults, overridable per request. |
| `requiredGroups` | `string[]` | No | Security group object ids. User needs at least one. Checked on every sign-in. |
| `requiredRoles` | `string[]` | No | App roles from the `roles` claim. User needs at least one. Checked on every sign-in. |
| `scopes` | `string[]` | No | Default: `['openid', 'email', 'profile']` |
| `tenant` | `string` | No | Directory selector. Default: `'common'`. |

### Tenant values

| Value | Who can sign in |
| --- | --- |
| `common` | Work/school accounts from **any** directory, plus personal accounts |
| `organizations` | Work/school accounts from any directory |
| `consumers` | Personal Microsoft accounts only |
| A directory GUID | That one organisation only |
| A verified domain | That one organisation only |

An invalid value is rejected at startup by the config schema. The app registration's *Supported account types* must match the value chosen.

:::warning
`common` means everyone, not just consumers — it admits work accounts from directories you have never heard of. Pin a GUID when the application serves one organisation, or set `allowedTenants`.
:::

## Access gate

`requiredRoles` and `requiredGroups` are evaluated on **every** authentication, not only at signup, so removing a user from a role or group takes effect at their next sign-in. A user who fails a check gets `SOCIAL_ACCESS_DENIED` (HTTP 403).

```typescript
social: {
  microsoft: {
    enabled: true,
    clientId: process.env.MS_CLIENT_ID,
    clientSecret: process.env.MS_CLIENT_SECRET,
    callbackUrl: 'https://api.myapp.com/auth/social/microsoft/callback',
    tenant: '9f4c2a10-1b3c-4d5e-8f70-2a1b3c4d5e6f',
    requiredRoles: ['nauth.access'],
  },
}
```

:::tip
Entra's own **Assignment required** toggle (Enterprise Applications → your app → Properties) is simpler and stronger: Microsoft refuses unassigned users at the identity provider and they never reach your callback. Use `requiredRoles` when you need finer in-token granularity on top of it.
:::

Prefer `requiredRoles` over `requiredGroups`. The `groups` claim carries object ids rather than names, and Entra omits it once a user belongs to more than roughly 200 groups, substituting a pointer to Graph. Sign-in is **denied** in that case rather than treated as "member of nothing" — configure the app registration to emit only groups assigned to the application, or use app roles.

## Errors

| Code | When | Details |
| ---- | ---- | ------- |
| `SOCIAL_ACCESS_DENIED` | Directory not permitted, or required role/group missing | `undefined` |
| `SOCIAL_CONFIG_MISSING` | Provider disabled, or clientId/clientSecret/callbackUrl absent | `undefined` |
| `SOCIAL_EMAIL_REQUIRED` | Token carries no email and no email-shaped `preferred_username` | `undefined` |
| `SOCIAL_TOKEN_INVALID` | Signature, audience or issuer check failed, or no ID token returned | `undefined` |

Throws [`NAuthException`](/docs/api/core/exceptions/nauth-exception) with the codes listed above.

## Usage

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { MicrosoftSocialAuthModule } from '@nauth-toolkit/social-microsoft/nestjs';

@Module({
  imports: [AuthModule.forRoot(config), MicrosoftSocialAuthModule],
})
export class AppModule {}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
const nauth = await NAuth.create({
  config,
  dataSource,
  adapter: new ExpressAdapter(),
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
const nauth = await NAuth.create({
  config,
  dataSource,
  adapter: new FastifyAdapter(),
});
```

</TabItem>
</Tabs>

## Profile Data

The redirect flow reads the verified ID token rather than a userinfo endpoint, because the tenant and access-gate claims only exist there.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | The `oid` claim — the user's immutable id within their directory |
| `email` | `string` | From the `email` claim, falling back to `preferred_username` when it is email-shaped |
| `firstName` | `string \| null` | `given_name`, or the first word of `name` |
| `lastName` | `string \| null` | `family_name`, or the remainder of `name` |
| `verified` | `boolean` | Whether the email may be trusted for auto-linking — see below |

:::warning
`id` is the `oid` claim, never `sub` or email. `sub` is pairwise per application and is not a durable identity across applications.
:::

### Email trust

`verified` gates email-based auto-linking in the core social base class, where a true value both links to an existing account by email and promotes that account's verified flag. Microsoft emits no `email_verified` claim, so this provider derives it:

| Account type | `verified` |
| --- | --- |
| Personal Microsoft account | `true` — Microsoft proves ownership before an address can become an account alias |
| Work/school with `xms_edov: true` | `true` — the tenant is confirmed as owning the email domain |
| Work/school without `xms_edov` | `false` — no auto-link |

`xms_edov` is an optional claim that must be switched on in the app registration's token configuration. Without it a work account will not merge into an existing local account with the same email, because a tenant administrator can set a user's email to a domain they do not own.

## Related

- [Microsoft Login Guide](/docs/guides/social/microsoft)
- [SocialAuthService](/docs/api/core/services/social-auth-service)
- [Social Auth](/docs/api/social/overview)
