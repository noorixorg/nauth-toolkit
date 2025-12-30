---
title: SendVerificationSMSResponseDTO
description: Response DTO for send verification SMS operation. Returns internal verification token ID.
keywords: [phone, verification, sms, dto, response, token, api]
image: /img/api-social-card.png
sidebar_position: 380
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# SendVerificationSMSResponseDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Response)

Response DTO for send verification SMS operation.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { SendVerificationSMSResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { SendVerificationSMSResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { SendVerificationSMSResponseDTO } from '@nauth-toolkit/core';
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

- [PhoneVerificationService.sendVerificationSMS()](../services/phone-verification-service#sendverificationsms)

