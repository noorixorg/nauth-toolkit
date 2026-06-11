---
title: Twilio
description: Twilio SMS provider for phone verification and MFA via Programmable Messaging API
keywords: [sms, twilio, phone, api, messaging]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Twilio Provider

**Package:** `@nauth-toolkit/sms-twilio`
**Type:** SMS Provider

Sends SMS via the Twilio Programmable Messaging API. Supports direct phone numbers and Messaging Services.

```bash npm2yarn
npm install @nauth-toolkit/sms-twilio
```

## Configuration

<Tabs groupId="twilio-mode">
<TabItem value="phone" label="Phone Number" default>

```typescript
import { TwilioSMSProvider } from '@nauth-toolkit/sms-twilio';

const smsProvider = new TwilioSMSProvider({
  accountSid: process.env.TWILIO_ACCOUNT_SID!,
  authToken: process.env.TWILIO_AUTH_TOKEN!,
  fromNumber: '+15551234567',
});
```

</TabItem>
<TabItem value="messaging-service" label="Messaging Service">

```typescript
import { TwilioSMSProvider } from '@nauth-toolkit/sms-twilio';

const smsProvider = new TwilioSMSProvider({
  accountSid: process.env.TWILIO_ACCOUNT_SID!,
  authToken: process.env.TWILIO_AUTH_TOKEN!,
  messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID!,
});
```

Use a Messaging Service for automatic sender selection, sticky sender, opt-out management, and advanced delivery features.

</TabItem>
</Tabs>

## TwilioSMSConfig

| Property              | Type     | Required | Description                                                                                      |
| --------------------- | -------- | -------- | ------------------------------------------------------------------------------------------------ |
| `accountSid`          | `string` | Yes      | Twilio Account SID (starts with `AC`)                                                            |
| `authToken`           | `string` | Yes      | Twilio Auth Token                                                                                |
| `fromNumber`          | `string` | No*      | Sender phone number in E.164 format. *Required if `messagingServiceSid` is not set.              |
| `messagingServiceSid` | `string` | No*      | Twilio Messaging Service SID (starts with `MG`). *Required if `fromNumber` is not set.           |

Provide either `fromNumber` or `messagingServiceSid`, not both.

## Usage

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript title="src/auth/auth.module.ts"
import { TwilioSMSProvider } from '@nauth-toolkit/sms-twilio';

AuthModule.forRoot({
  smsProvider: new TwilioSMSProvider({
    accountSid: process.env.TWILIO_ACCOUNT_SID!,
    authToken: process.env.TWILIO_AUTH_TOKEN!,
    fromNumber: process.env.TWILIO_FROM_NUMBER!,
  }),
});
```

</TabItem>
<TabItem value="express" label="Express">

```typescript title="src/config.ts"
import { TwilioSMSProvider } from '@nauth-toolkit/sms-twilio';

const nauth = await NAuth.create({
  config: {
    smsProvider: new TwilioSMSProvider({
      accountSid: process.env.TWILIO_ACCOUNT_SID!,
      authToken: process.env.TWILIO_AUTH_TOKEN!,
      fromNumber: process.env.TWILIO_FROM_NUMBER!,
    }),
  },
  // ...
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript title="src/config.ts"
import { TwilioSMSProvider } from '@nauth-toolkit/sms-twilio';

const nauth = await NAuth.create({
  config: {
    smsProvider: new TwilioSMSProvider({
      accountSid: process.env.TWILIO_ACCOUNT_SID!,
      authToken: process.env.TWILIO_AUTH_TOKEN!,
      fromNumber: process.env.TWILIO_FROM_NUMBER!,
    }),
  },
  adapter: new FastifyAdapter(),
  // ...
});
```

</TabItem>
</Tabs>

## Environment Variables

```bash title=".env"
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_FROM_NUMBER=+15551234567
# Or use a Messaging Service instead of fromNumber:
# TWILIO_MESSAGING_SERVICE_SID=MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Get your Account SID and Auth Token from the [Twilio Console](https://console.twilio.com) under "Account Info".

## Templates

Customize SMS message content with templates:

```typescript
AuthModule.forRoot({
  smsProvider: new TwilioSMSProvider({
    accountSid: process.env.TWILIO_ACCOUNT_SID!,
    authToken: process.env.TWILIO_AUTH_TOKEN!,
    fromNumber: process.env.TWILIO_FROM_NUMBER!,
  }),
  sms: {
    templates: {
      globalVariables: {
        appName: 'My App',
        supportPhone: '+1-800-123-4567',
      },
      customTemplates: {
        verification: {
          content: '{{appName}}: Your code is {{code}}. Expires in {{expiryMinutes}} min.',
        },
      },
    },
  },
});
```

See [SMS Templates](/docs/guides/sms-templates) for complete documentation.

## Related

- [SMS Overview](./overview)
- [SMS Templates Configuration](./templates)
- [Console SMS](./console) - Development provider
- [AWS SNS](./aws-sns) - AWS provider
