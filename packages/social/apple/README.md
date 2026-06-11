# @nauth-toolkit/social-apple

Apple Sign In provider for [nauth-toolkit](https://nauth.dev).

Adds Sign in with Apple with support for web redirect flows and native iOS token verification. Handles authorization code exchange, identity token validation, and user profile retrieval. Automatically links Apple accounts to existing users by email.

**[Documentation](https://nauth.dev/docs/guides/social/how-social-login-works)** · **[GitHub](https://github.com/noorixorg/nauth-toolkit)**

> Part of [nauth-toolkit](https://www.npmjs.com/package/@nauth-toolkit/core). Requires `@nauth-toolkit/core`.

---

## Install

```bash
npm install @nauth-toolkit/social-apple
```

Enable in your auth config:

```typescript
const authConfig = {
  social: {
    apple: {
      enabled: true,
      clientId: process.env.APPLE_CLIENT_ID,
      teamId: process.env.APPLE_TEAM_ID,
      keyId: process.env.APPLE_KEY_ID,
      privateKey: process.env.APPLE_PRIVATE_KEY,
    },
  },
};
```

**NestJS** — import the module and it auto-registers:

```typescript
import { AppleSocialAuthModule } from '@nauth-toolkit/social-apple/nestjs';

@Module({
  imports: [NAuthModule.forRoot(authConfig), AppleSocialAuthModule],
})
export class AuthModule {}
```

---

## Related packages

| Package | Purpose |
| --- | --- |
| [`@nauth-toolkit/social-google`](https://www.npmjs.com/package/@nauth-toolkit/social-google) | Google OAuth 2.0 |
| [`@nauth-toolkit/social-facebook`](https://www.npmjs.com/package/@nauth-toolkit/social-facebook) | Facebook Login |

See the [full package list](https://www.npmjs.com/package/@nauth-toolkit/core#package-ecosystem) in the core README.

---

MIT licensed. See [LICENSE](https://github.com/noorixorg/nauth-toolkit/blob/main/LICENSE).
