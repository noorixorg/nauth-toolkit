---
title: ResendVerificationSMSResponseDTO
description: Response DTO for resend verification SMS operation. Returns internal verification token ID.
keywords: [phone, verification, sms, dto, response, token, api]
image: /img/api-social-card.png
sidebar_position: 360
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# ResendVerificationSMSResponseDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Response)

Response DTO for resend verification SMS operation.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { ResendVerificationSMSResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { ResendVerificationSMSResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { ResendVerificationSMSResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property  | Type     | Required | Description                          |
| --------- | -------- | -------- | ------------------------------------ |
| `tokenId` | `number` | Yes      | Verification token ID (internal use) |

## Example

```json
{
  "tokenId": 12345
}
```

## Used By

- [PhoneVerificationService.resendVerificationSMS()](../services/phone-verification-service#resendverificationsms)

