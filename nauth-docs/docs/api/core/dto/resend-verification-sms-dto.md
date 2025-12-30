---
title: ResendVerificationSMSDTO
description: Request DTO for resending verification SMS. Supports identification by user sub (UUID) or phone number with E.164 format.
keywords: [phone, verification, sms, dto, request, resend, api]
image: /img/api-social-card.png
sidebar_position: 350
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# ResendVerificationSMSDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)

Request DTO for resending verification SMS. Supports identification by user sub or phone number.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { ResendVerificationSMSDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { ResendVerificationSMSDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { ResendVerificationSMSDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property | Type     | Required | Description                                                                                    |
| -------- | -------- | -------- | ---------------------------------------------------------------------------------------------- |
| `sub`    | `string` | No       | User identifier (UUID v4). Required if phone not provided. Trimmed and lowercased.             |
| `phone`  | `string` | No       | User phone number (E.164 format). Required if sub not provided. Max 20 chars. Whitespace removed. |

:::info
Either `sub` or `phone` must be provided (not both).
:::

## Example

```json
{
  "sub": "a21b654c-2746-4168-acee-c175083a65cd"
}
```

Or by phone:

```json
{
  "phone": "+1234567890"
}
```

## Used By

- [PhoneVerificationService.resendVerificationSMS()](../services/phone-verification-service#resendverificationsms)

