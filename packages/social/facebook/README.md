# @nauth-toolkit/social-facebook

Facebook Login provider for [nauth-toolkit](https://nauth.dev).

Adds Facebook Login with web redirect flows. Handles OAuth authorization, access token exchange, and user profile retrieval. Automatically links Facebook accounts to existing users by email.

**[Documentation](https://nauth.dev/docs/guides/social/how-social-login-works)** · **[GitHub](https://github.com/noorixorg/nauth-toolkit)**

> Part of [nauth-toolkit](https://www.npmjs.com/package/@nauth-toolkit/core). Requires `@nauth-toolkit/core`.

---

## Install

```bash
npm install @nauth-toolkit/social-facebook
```

Enable in your auth config:

```typescript
const authConfig = {
  social: {
    facebook: {
      enabled: true,
      appId: process.env.FACEBOOK_APP_ID,
      appSecret: process.env.FACEBOOK_APP_SECRET,
    },
  },
};
```

**NestJS** — import the module and it auto-registers:

```typescript
import { FacebookSocialAuthModule } from '@nauth-toolkit/social-facebook/nestjs';

@Module({
  imports: [NAuthModule.forRoot(authConfig), FacebookSocialAuthModule],
})
export class AuthModule {}
```

---

## Related packages

| Package | Purpose |
| --- | --- |
| [`@nauth-toolkit/social-google`](https://www.npmjs.com/package/@nauth-toolkit/social-google) | Google OAuth 2.0 |
| [`@nauth-toolkit/social-apple`](https://www.npmjs.com/package/@nauth-toolkit/social-apple) | Sign in with Apple |

See the [full package list](https://www.npmjs.com/package/@nauth-toolkit/core#package-ecosystem) in the core README.

---

MIT licensed. See [LICENSE](https://github.com/noorixorg/nauth-toolkit/blob/main/LICENSE).
