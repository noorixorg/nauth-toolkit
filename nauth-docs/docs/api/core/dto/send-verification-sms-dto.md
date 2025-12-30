---
title: SendVerificationSMSDTO
description: Request DTO for sending SMS verification codes. Includes user identifier and optional skip flag for MFA contexts.
keywords: [phone, verification, sms, dto, request, send, code, api]
image: /img/api-social-card.png
sidebar_position: 370
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# SendVerificationSMSDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)

Request DTO for sending verification SMS with codes.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { SendVerificationSMSDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { SendVerificationSMSDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { SendVerificationSMSDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property                    | Type      | Required | Description                                                                                    |
| --------------------------- | --------- | -------- | ---------------------------------------------------------------------------------------------- |
| `sub`                       | `string`  | Yes      | User identifier (UUID v4). Trimmed and lowercased.                                             |
| `skipAlreadyVerifiedCheck` | `boolean` | No       | Skip "already verified" check. Used for MFA contexts where codes needed even if phone verified. |

## Example

```json
{
  "sub": "a21b654c-2746-4168-acee-c175083a65cd",
  "skipAlreadyVerifiedCheck": false
}
```

## Used By

- [PhoneVerificationService.sendVerificationSMS()](../services/phone-verification-service#sendverificationsms)

