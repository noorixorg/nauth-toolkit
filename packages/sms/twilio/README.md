# @nauth-toolkit/sms-twilio

Twilio SMS provider for [nauth-toolkit](https://nauth.dev).

Sends verification codes and MFA one-time passwords via the Twilio Programmable Messaging API. Supports a direct sender number or a Twilio Messaging Service.

**[Documentation](https://nauth.dev)** · **[GitHub](https://github.com/noorixorg/nauth-toolkit)**

> Part of [nauth-toolkit](https://www.npmjs.com/package/@nauth-toolkit/core). Requires `@nauth-toolkit/core`.

---

## Install

```bash
npm install @nauth-toolkit/sms-twilio
```

Configure in your auth config with a sender number:

```typescript
import { TwilioSMSProvider } from '@nauth-toolkit/sms-twilio';

const authConfig = {
  smsProvider: new TwilioSMSProvider({
    accountSid: process.env.TWILIO_ACCOUNT_SID!,
    authToken: process.env.TWILIO_AUTH_TOKEN!,
    fromNumber: '+15551234567',
  }),
};
```

Or with a Twilio Messaging Service (provide either `fromNumber` or `messagingServiceSid`, not both):

```typescript
const authConfig = {
  smsProvider: new TwilioSMSProvider({
    accountSid: process.env.TWILIO_ACCOUNT_SID!,
    authToken: process.env.TWILIO_AUTH_TOKEN!,
    messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID!,
  }),
};
```

---

## Other SMS providers

| Package | Purpose |
| --- | --- |
| [`@nauth-toolkit/sms-aws-sns`](https://www.npmjs.com/package/@nauth-toolkit/sms-aws-sns) | AWS SNS |
| [`@nauth-toolkit/sms-console`](https://www.npmjs.com/package/@nauth-toolkit/sms-console) | Console logging for development |

See the [full package list](https://www.npmjs.com/package/@nauth-toolkit/core#package-ecosystem) in the core README.

---

MIT licensed. See [LICENSE](https://github.com/noorixorg/nauth-toolkit/blob/main/LICENSE).
