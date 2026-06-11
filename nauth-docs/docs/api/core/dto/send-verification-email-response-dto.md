---
title: SendVerificationEmailResponseDTO
description: Response DTO for send verification email operation. Returns internal verification token ID.
keywords: [email, verification, dto, response, token, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# SendVerificationEmailResponseDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Response)

Response DTO for send verification email operation.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { SendVerificationEmailResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { SendVerificationEmailResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { SendVerificationEmailResponseDTO } from '@nauth-toolkit/core';
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

- [EmailVerificationService.sendVerificationEmail()](../services/email-verification-service#sendverificationemail)

