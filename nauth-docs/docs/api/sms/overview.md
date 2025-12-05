---
title: SMS Providers
description: SMS providers for phone verification and MFA
keywords: [sms, providers, aws, sns, phone, api]
image: /img/api-social-card.png
sidebar_position: 0
---

# SMS Providers

SMS providers for sending verification codes and MFA challenges.

## Available Providers

| Provider | Package | Description |
|----------|---------|-------------|
| [AWS SNS](./aws-sns) | `@nauth-toolkit/sms-aws-sns` | Production SMS via AWS SNS |
| [Console](./console) | `@nauth-toolkit/sms-console` | Development (logs to console) |

## Provider Interface

All SMS providers implement `SMSProvider`:

```typescript
interface SMSProvider {
  sendOTP(phone: string, code: string): Promise<void>;
  sendVerificationCode(phone: string, code: string): Promise<void>;
}
```

## Related

- [PhoneVerificationService](/docs/api/core/services/phone-verification-service)
- [MFA SMS](/docs/api/mfa/sms)
