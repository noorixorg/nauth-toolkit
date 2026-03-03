# @nauth-toolkit/sms-aws-sns

AWS SNS SMS provider for [nauth-toolkit](https://nauth.dev).

Sends SMS verification codes and MFA one-time passwords through Amazon SNS. Plug in your AWS credentials and nauth-toolkit handles message formatting and delivery.

**[Documentation](https://nauth.dev)** · **[GitHub](https://github.com/noorixorg/nauth)**

> Part of [nauth-toolkit](https://www.npmjs.com/package/@nauth-toolkit/core). Requires `@nauth-toolkit/core`.

---

## Install

```bash
npm install @nauth-toolkit/sms-aws-sns
```

Configure in your auth config:

```typescript
import { AWSSNSProvider } from '@nauth-toolkit/sms-aws-sns';

const authConfig = {
  smsProvider: new AWSSNSProvider({
    region: process.env.AWS_REGION,
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }),
};
```

---

## Also available

| Package | Purpose |
| --- | --- |
| [`@nauth-toolkit/sms-console`](https://www.npmjs.com/package/@nauth-toolkit/sms-console) | Log SMS to console — development use |

See the [full package list](https://www.npmjs.com/package/@nauth-toolkit/core#package-ecosystem) in the core README.

---

Free to use. See [license](https://nauth.dev/docs/license).
