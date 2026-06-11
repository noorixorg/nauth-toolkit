# @nauth-toolkit/mfa-sms

SMS one-time code MFA provider for [nauth-toolkit](https://nauth.dev).

Sends verification codes via SMS for multi-factor authentication. Requires an SMS provider (`@nauth-toolkit/sms-aws-sns` or `@nauth-toolkit/sms-console` for development).

**[Documentation](https://nauth.dev/docs/guides/mfa/how-mfa-works)** · **[GitHub](https://github.com/noorixorg/nauth-toolkit)**

> Part of [nauth-toolkit](https://www.npmjs.com/package/@nauth-toolkit/core). Requires `@nauth-toolkit/core` and an SMS provider.

---

## Install

```bash
npm install @nauth-toolkit/mfa-sms @nauth-toolkit/sms-console
```

Enable in your auth config:

```typescript
import { MFAMethod } from '@nauth-toolkit/core';

const authConfig = {
  mfa: {
    enabled: true,
    allowedMethods: [MFAMethod.SMS],
  },
};
```

**NestJS** — import the module and it auto-registers:

```typescript
import { SMSMFAModule } from '@nauth-toolkit/mfa-sms/nestjs';

@Module({
  imports: [NAuthModule.forRoot(authConfig), SMSMFAModule],
})
export class AuthModule {}
```

---

## Related packages

| Package | Purpose |
| --- | --- |
| [`@nauth-toolkit/sms-aws-sns`](https://www.npmjs.com/package/@nauth-toolkit/sms-aws-sns) | AWS SNS — production SMS delivery |
| [`@nauth-toolkit/sms-console`](https://www.npmjs.com/package/@nauth-toolkit/sms-console) | Console logging — development use |
| [`@nauth-toolkit/mfa-totp`](https://www.npmjs.com/package/@nauth-toolkit/mfa-totp) | TOTP authenticator apps |
| [`@nauth-toolkit/mfa-email`](https://www.npmjs.com/package/@nauth-toolkit/mfa-email) | Email verification codes |

See the [full package list](https://www.npmjs.com/package/@nauth-toolkit/core#package-ecosystem) in the core README.

---

MIT licensed. See [LICENSE](https://github.com/noorixorg/nauth-toolkit/blob/main/LICENSE).
