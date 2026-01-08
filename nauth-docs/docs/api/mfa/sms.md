---
title: SMS MFA Provider
description: SMS-based MFA provider
keywords: [mfa, sms, verification, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# SMS MFA Provider

**Package:** `@nauth-toolkit/mfa-sms`
**Type:** MFA Provider

```bash npm2yarn
npm install @nauth-toolkit/mfa-sms
```

## Exports

| Export | Type | Entry |
|--------|------|-------|
| `SMSMFAProviderService` | Service | Default |
| `SMSMFAModule` | NestJS Module | `/nestjs` |

## Requirements

Requires an SMS provider configured:

- `@nauth-toolkit/sms-twilio`
- `@nauth-toolkit/sms-vonage`

## Usage

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { SMSMFAModule } from '@nauth-toolkit/mfa-sms/nestjs';
import { TwilioSMSProvider } from '@nauth-toolkit/sms-twilio';

@Module({
  imports: [
    AuthModule.forRoot({
      mfa: {
        enabled: true,
        allowedMethods: [MFAMethod.SMS],
      },
      smsProvider: new TwilioSMSProvider({ ... }),
    }),
    SMSMFAModule,
  ],
})
export class AppModule {}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { TwilioSMSProvider } from '@nauth-toolkit/sms-twilio';

const nauth = await NAuth.create({
  config: {
    mfa: {
      enabled: true,
      allowedMethods: [MFAMethod.SMS],
    },
    smsProvider: new TwilioSMSProvider({
      accountSid: process.env.TWILIO_ACCOUNT_SID!,
      authToken: process.env.TWILIO_AUTH_TOKEN!,
      from: process.env.TWILIO_PHONE_NUMBER!,
    }),
  },
  dataSource,
  adapter: new ExpressAdapter(),
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { TwilioSMSProvider } from '@nauth-toolkit/sms-twilio';

const nauth = await NAuth.create({
  config: {
    mfa: {
      enabled: true,
      allowedMethods: [MFAMethod.SMS],
    },
    smsProvider: new TwilioSMSProvider({
      accountSid: process.env.TWILIO_ACCOUNT_SID!,
      authToken: process.env.TWILIO_AUTH_TOKEN!,
      from: process.env.TWILIO_PHONE_NUMBER!,
    }),
  },
  dataSource,
  adapter: new FastifyAdapter(),
});
```

</TabItem>
</Tabs>

## Setup Flow

1. User must have verified phone number
2. Call `mfaService.setupDevice(userId, 'sms')`
3. Code sent to phone
4. User submits code to verify

## Related

- [MFAService](/docs/api/core/services/mfa-service)
- [SMS](/docs/api/sms/overview)
- [MFA](/docs/api/mfa/overview)
