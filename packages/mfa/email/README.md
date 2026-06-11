# @nauth-toolkit/mfa-email

Email one-time code MFA provider for [nauth-toolkit](https://nauth.dev).

Sends verification codes via email for multi-factor authentication. Requires an email provider (`@nauth-toolkit/email-nodemailer` or `@nauth-toolkit/email-console` for development).

**[Documentation](https://nauth.dev/docs/guides/mfa/how-mfa-works)** · **[GitHub](https://github.com/noorixorg/nauth-toolkit)**

> Part of [nauth-toolkit](https://www.npmjs.com/package/@nauth-toolkit/core). Requires `@nauth-toolkit/core` and an email provider.

---

## Install

```bash
npm install @nauth-toolkit/mfa-email @nauth-toolkit/email-console
```

Enable in your auth config:

```typescript
import { MFAMethod } from '@nauth-toolkit/core';

const authConfig = {
  mfa: {
    enabled: true,
    allowedMethods: [MFAMethod.EMAIL],
  },
};
```

**NestJS** — import the module and it auto-registers:

```typescript
import { EmailMFAModule } from '@nauth-toolkit/mfa-email/nestjs';

@Module({
  imports: [NAuthModule.forRoot(authConfig), EmailMFAModule],
})
export class AuthModule {}
```

---

## Related packages

| Package | Purpose |
| --- | --- |
| [`@nauth-toolkit/email-nodemailer`](https://www.npmjs.com/package/@nauth-toolkit/email-nodemailer) | Nodemailer — production email delivery |
| [`@nauth-toolkit/email-console`](https://www.npmjs.com/package/@nauth-toolkit/email-console) | Console logging — development use |
| [`@nauth-toolkit/mfa-totp`](https://www.npmjs.com/package/@nauth-toolkit/mfa-totp) | TOTP authenticator apps |
| [`@nauth-toolkit/mfa-sms`](https://www.npmjs.com/package/@nauth-toolkit/mfa-sms) | SMS verification codes |

See the [full package list](https://www.npmjs.com/package/@nauth-toolkit/core#package-ecosystem) in the core README.

---

MIT licensed. See [LICENSE](https://github.com/noorixorg/nauth-toolkit/blob/main/LICENSE).
