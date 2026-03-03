# @nauth-toolkit/sms-console

Console SMS provider for [nauth-toolkit](https://nauth.dev).

Logs SMS content to the console instead of sending it. Use during development and testing to see verification codes and MFA one-time passwords without configuring a real SMS gateway.

**[Documentation](https://nauth.dev)** · **[GitHub](https://github.com/noorixorg/nauth)**

> Part of [nauth-toolkit](https://www.npmjs.com/package/@nauth-toolkit/core). Requires `@nauth-toolkit/core`.

---

## Install

```bash
npm install @nauth-toolkit/sms-console
```

Configure in your auth config:

```typescript
import { ConsoleSMSProvider } from '@nauth-toolkit/sms-console';

const authConfig = {
  smsProvider: new ConsoleSMSProvider(),
};
```

---

## For production

| Package | Purpose |
| --- | --- |
| [`@nauth-toolkit/sms-aws-sns`](https://www.npmjs.com/package/@nauth-toolkit/sms-aws-sns) | AWS SNS |

See the [full package list](https://www.npmjs.com/package/@nauth-toolkit/core#package-ecosystem) in the core README.

---

Free to use. See [license](https://nauth.dev/docs/license).
