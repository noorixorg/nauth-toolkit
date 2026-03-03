# @nauth-toolkit/social-google

Google OAuth provider for [nauth-toolkit](https://nauth.dev).

Adds Google sign-in with support for web redirect flows and native mobile token verification. Handles OAuth 2.0 authorization, token exchange, and user profile retrieval. Automatically links Google accounts to existing users by email.

**[Documentation](https://nauth.dev/docs/guides/social/how-social-login-works)** · **[GitHub](https://github.com/noorixorg/nauth)**

> Part of [nauth-toolkit](https://www.npmjs.com/package/@nauth-toolkit/core). Requires `@nauth-toolkit/core`.

---

## Install

```bash
npm install @nauth-toolkit/social-google
```

Enable in your auth config:

```typescript
const authConfig = {
  social: {
    google: {
      enabled: true,
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
  },
};
```

**NestJS** — import the module and it auto-registers:

```typescript
import { GoogleSocialAuthModule } from '@nauth-toolkit/social-google/nestjs';

@Module({
  imports: [NAuthModule.forRoot(authConfig), GoogleSocialAuthModule],
})
export class AuthModule {}
```

---

## Related packages

| Package | Purpose |
| --- | --- |
| [`@nauth-toolkit/social-apple`](https://www.npmjs.com/package/@nauth-toolkit/social-apple) | Sign in with Apple |
| [`@nauth-toolkit/social-facebook`](https://www.npmjs.com/package/@nauth-toolkit/social-facebook) | Facebook Login |

See the [full package list](https://www.npmjs.com/package/@nauth-toolkit/core#package-ecosystem) in the core README.

---

Free to use. See [license](https://nauth.dev/docs/license).
