# @nauth-toolkit/mfa-passkey

Passkey and WebAuthn MFA provider for [nauth-toolkit](https://nauth.dev).

Adds FIDO2 passkey support — Face ID, Touch ID, Windows Hello, YubiKey, and other platform/roaming authenticators. Handles registration ceremonies, authentication assertions, and credential management.

**[Documentation](https://nauth.dev/docs/guides/mfa/how-mfa-works)** · **[GitHub](https://github.com/noorixorg/nauth)**

> Part of [nauth-toolkit](https://www.npmjs.com/package/@nauth-toolkit/core). Requires `@nauth-toolkit/core`.

---

## Install

```bash
npm install @nauth-toolkit/mfa-passkey
```

Enable in your auth config:

```typescript
import { MFAMethod } from '@nauth-toolkit/core';

const authConfig = {
  mfa: {
    enabled: true,
    allowedMethods: [MFAMethod.PASSKEY],
  },
};
```

**NestJS** — import the module and it auto-registers:

```typescript
import { PasskeyMFAModule } from '@nauth-toolkit/mfa-passkey/nestjs';

@Module({
  imports: [NAuthModule.forRoot(authConfig), PasskeyMFAModule],
})
export class AuthModule {}
```

---

## Related packages

| Package | Purpose |
| --- | --- |
| [`@nauth-toolkit/mfa-totp`](https://www.npmjs.com/package/@nauth-toolkit/mfa-totp) | TOTP authenticator apps |
| [`@nauth-toolkit/mfa-sms`](https://www.npmjs.com/package/@nauth-toolkit/mfa-sms) | SMS verification codes |
| [`@nauth-toolkit/mfa-email`](https://www.npmjs.com/package/@nauth-toolkit/mfa-email) | Email verification codes |

See the [full package list](https://www.npmjs.com/package/@nauth-toolkit/core#package-ecosystem) in the core README.

---

Free to use. See [license](https://nauth.dev/docs/license).
