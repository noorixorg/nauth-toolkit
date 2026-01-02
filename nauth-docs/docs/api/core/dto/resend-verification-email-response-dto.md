---
title: ResendVerificationEmailResponseDTO
description: Response DTO for resend verification email operation. Returns internal verification token ID.
keywords: [email, verification, dto, response, token, api]
image: /img/api-social-card.png
sidebar_position: 670
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# ResendVerificationEmailResponseDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Response)

Response DTO for resend verification email operation.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { ResendVerificationEmailResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { ResendVerificationEmailResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { ResendVerificationEmailResponseDTO } from '@nauth-toolkit/core';
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

- [EmailVerificationService.resendVerificationEmail()](../services/email-verification-service#resendverificationemail)

