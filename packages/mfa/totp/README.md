# @nauth-toolkit/mfa-totp

TOTP authenticator app MFA provider for [nauth-toolkit](https://nauth.dev).

Adds time-based one-time password (TOTP) support — works with Google Authenticator, Authy, 1Password, and any TOTP-compatible app. Handles secret generation, QR code provisioning URIs, and code verification.

**[Documentation](https://nauth.dev/docs/guides/mfa/how-mfa-works)** · **[GitHub](https://github.com/noorixorg/nauth)**

> Part of [nauth-toolkit](https://www.npmjs.com/package/@nauth-toolkit/core). Requires `@nauth-toolkit/core`.

---

## Install

```bash
npm install @nauth-toolkit/mfa-totp
```

Enable in your auth config:

```typescript
import { MFAMethod } from '@nauth-toolkit/core';

const authConfig = {
  mfa: {
    enabled: true,
    allowedMethods: [MFAMethod.TOTP],
  },
};
```

**NestJS** — import the module and it auto-registers:

```typescript
import { TOTPMFAModule } from '@nauth-toolkit/mfa-totp/nestjs';

@Module({
  imports: [NAuthModule.forRoot(authConfig), TOTPMFAModule],
})
export class AuthModule {}
```

---

## Related packages

| Package | Purpose |
| --- | --- |
| [`@nauth-toolkit/mfa-sms`](https://www.npmjs.com/package/@nauth-toolkit/mfa-sms) | SMS verification codes |
| [`@nauth-toolkit/mfa-email`](https://www.npmjs.com/package/@nauth-toolkit/mfa-email) | Email verification codes |
| [`@nauth-toolkit/mfa-passkey`](https://www.npmjs.com/package/@nauth-toolkit/mfa-passkey) | WebAuthn / passkeys |

See the [full package list](https://www.npmjs.com/package/@nauth-toolkit/core#package-ecosystem) in the core README.

---

Free to use. See [license](https://nauth.dev/docs/license).
