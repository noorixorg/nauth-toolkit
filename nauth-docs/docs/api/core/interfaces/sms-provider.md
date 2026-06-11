---
title: SMSProvider
description: Interface for SMS providers used for phone verification, MFA, and password reset codes
keywords: [sms, provider, templates, interface, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# SMSProvider

**Package:** `@nauth-toolkit/core`
**Type:** Interface

Contract for sending SMS messages. Supports optional template integration via `setTemplateEngine()` and `setGlobalVariables()`.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { SMSProvider } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { SMSProvider } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { SMSProvider } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Methods

| Method | Returns | Description |
| --- | --- | --- |
| `sendOTP(phone, code, templateType?, variables?)` | `Promise<void>` | Send OTP code (optionally rendered via templates) |
| `sendVerificationCode?(phone, code)` | `Promise<void>` | Optional alias for `sendOTP()` |
| `setTemplateEngine?(engine)` | `void` | Optional hook for template rendering support |
| `setGlobalVariables?(variables)` | `void` | Optional hook to set global template variables |

## Template Parameters

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `templateType` | `string` | No | Template key (e.g., `verification`, `mfa`, `passwordReset`) |
| `variables` | `Record<string, unknown>` | No | Template variables (e.g., `expiryMinutes`, `appName`, `supportPhone`) |

## Related APIs

- [SMSTemplateEngine](./sms-template-engine) - Template engine contract
- [SMS Templates Configuration](/docs/api/sms/templates) - Configuration API
- [SMS Providers Overview](/docs/api/sms/overview) - Provider implementations


