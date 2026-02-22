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

Requires an SMS provider configured. Available SMS provider packages:

- [`@nauth-toolkit/sms-aws-sns`](/docs/api/sms/overview) — AWS SNS / End User Messaging (`AWSSMSProvider`)
- [`@nauth-toolkit/sms-console`](/docs/api/sms/overview) — Console logger for development (`ConsoleSMSProvider`)

## Usage

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { SMSMFAModule } from '@nauth-toolkit/mfa-sms/nestjs';
import { AWSSMSProvider } from '@nauth-toolkit/sms-aws-sns';

@Module({
  imports: [
    AuthModule.forRoot({
      mfa: {
        enabled: true,
        allowedMethods: [MFAMethod.SMS],
      },
      smsProvider: new AWSSMSProvider({
        region: process.env.AWS_REGION!,
        originationNumber: process.env.AWS_ORIGINATION_NUMBER!,
      }),
    }),
    SMSMFAModule,
  ],
})
export class AppModule {}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { AWSSMSProvider } from '@nauth-toolkit/sms-aws-sns';

const nauth = await NAuth.create({
  config: {
    mfa: {
      enabled: true,
      allowedMethods: [MFAMethod.SMS],
    },
    smsProvider: new AWSSMSProvider({
      region: process.env.AWS_REGION!,
      originationNumber: process.env.AWS_ORIGINATION_NUMBER!,
    }),
  },
  dataSource,
  adapter: new ExpressAdapter(),
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { AWSSMSProvider } from '@nauth-toolkit/sms-aws-sns';

const nauth = await NAuth.create({
  config: {
    mfa: {
      enabled: true,
      allowedMethods: [MFAMethod.SMS],
    },
    smsProvider: new AWSSMSProvider({
      region: process.env.AWS_REGION!,
      originationNumber: process.env.AWS_ORIGINATION_NUMBER!,
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
2. Call `mfaService.setup({ methodName: 'sms', setupData: { phoneNumber: '+1234567890' } })`
3. Code sent to phone
4. User submits code to verify

## Related

- [MFAService](/docs/api/core/services/mfa-service)
- [SMS](/docs/api/sms/overview)
- [MFA](/docs/api/mfa/overview)
