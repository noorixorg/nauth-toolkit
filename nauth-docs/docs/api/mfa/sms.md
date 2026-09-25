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

- [`@nauth-toolkit/sms-aws-sns`](/docs/api/sms/aws-sns) — AWS SNS / End User Messaging (`AWSSMSProvider`)
- [`@nauth-toolkit/sms-twilio`](/docs/api/sms/twilio) — Twilio Programmable Messaging (`TwilioSMSProvider`)
- [`@nauth-toolkit/sms-console`](/docs/api/sms/console) — Console logger for development (`ConsoleSMSProvider`)

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

1. Call `mfaService.setup({ methodName: 'sms', setupData: { phoneNumber: '+14155552671' } })`. `phoneNumber` is optional when the account already has a phone; a different number replaces it and resets its verification.
2. If the phone on file is already verified and no `phoneNumber` was sent, setup auto-completes (`{ deviceId, autoCompleted: true }`). Otherwise a code is sent (`{ maskedPhone }`).
3. User submits the code with `verifySetup({ code })`. The phone is marked verified and the SMS device is bound to the phone on file.
4. Calling `setup()` again without `phoneNumber` resends the code; with a new `phoneNumber` it changes the number.

During the `MFA_SETUP_REQUIRED` challenge the same provider runs behind [`MFAService.getSetupData()`](/docs/api/core/services/mfa-service#getsetupdata). See [SMS MFA guide](/docs/guides/mfa/sms).

## Related

- [MFAService](/docs/api/core/services/mfa-service)
- [SMS](/docs/api/sms/overview)
- [MFA](/docs/api/mfa/overview)
