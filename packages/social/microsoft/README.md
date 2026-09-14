# @nauth-toolkit/social-microsoft

Microsoft Entra ID (Azure AD) provider for [nauth-toolkit](https://nauth.dev).

Adds Microsoft sign-in for both populations the Microsoft identity platform serves: personal accounts (outlook.com, hotmail.com, live.com) and work or school accounts from a Microsoft 365 tenant. An Office 365 subscription includes Entra ID as its identity provider, so organisational SSO is the same OIDC flow against the same endpoints — which population is admitted depends on one config value.

**[Documentation](https://nauth.dev/docs/guides/social/microsoft)** · **[GitHub](https://github.com/noorixorg/nauth-toolkit)**

> Part of [nauth-toolkit](https://www.npmjs.com/package/@nauth-toolkit/core). Requires `@nauth-toolkit/core`.

---

## Install

```bash
npm install @nauth-toolkit/social-microsoft
```

Public sign-in, like any other social provider:

```typescript
const authConfig = {
  social: {
    microsoft: {
      enabled: true,
      clientId: process.env.MS_CLIENT_ID,
      clientSecret: process.env.MS_CLIENT_SECRET,
      callbackUrl: `${process.env.API_BASE_URL}/auth/social/microsoft/callback`,
      tenant: 'common',
    },
  },
};
```

One organisation's Microsoft 365 tenant, gated on an app role:

```typescript
microsoft: {
  enabled: true,
  clientId: process.env.MS_CLIENT_ID,
  clientSecret: process.env.MS_CLIENT_SECRET,
  callbackUrl: `${process.env.API_BASE_URL}/auth/social/microsoft/callback`,
  tenant: '9f4c2a10-1b3c-4d5e-8f70-2a1b3c4d5e6f',
  requiredRoles: ['nauth.access'],
}
```

**NestJS** — import the module and it auto-registers:

```typescript
import { MicrosoftSocialAuthModule } from '@nauth-toolkit/social-microsoft/nestjs';

@Module({
  imports: [NAuthModule.forRoot(authConfig), MicrosoftSocialAuthModule],
})
export class AuthModule {}
```

---

## Tenant values

| Value | Who can sign in |
| --- | --- |
| `common` | Work/school accounts from **any** directory, plus personal accounts |
| `organizations` | Work/school accounts from any directory |
| `consumers` | Personal Microsoft accounts only |
| A directory GUID or verified domain | That one organisation only |

The app registration's *Supported account types* must match this value.

---

## Restricting access

Prefer Entra's own **Assignment required** toggle (Enterprise Applications → your app → Properties). Microsoft then refuses unassigned users at the identity provider and they never reach your callback — no code, and the customer's administrator manages access in their own portal.

For finer, in-token control, `requiredRoles` matches app roles and `requiredGroups` matches security group object ids. Both are checked on **every** sign-in, so revoking access takes effect at the user's next login. Prefer roles: the `groups` claim carries GUIDs rather than names, and Entra omits it entirely once a user belongs to more than roughly 200 groups — sign-in is denied in that case rather than treated as "member of nothing".

---

## Related packages

| Package | Purpose |
| --- | --- |
| [`@nauth-toolkit/social-google`](https://www.npmjs.com/package/@nauth-toolkit/social-google) | Google Sign-In |
| [`@nauth-toolkit/social-apple`](https://www.npmjs.com/package/@nauth-toolkit/social-apple) | Sign in with Apple |
| [`@nauth-toolkit/social-facebook`](https://www.npmjs.com/package/@nauth-toolkit/social-facebook) | Facebook Login |

See the [full package list](https://www.npmjs.com/package/@nauth-toolkit/core#package-ecosystem) in the core README.

---

MIT licensed. See [LICENSE](https://github.com/noorixorg/nauth-toolkit/blob/main/LICENSE).
