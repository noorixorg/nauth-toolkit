---
title: VerifyEmailResponseDTO
description: Response DTO for email verification operations. Returns success message confirming email verification.
keywords: [email, verification, dto, response, success, api]
image: /img/api-social-card.png
sidebar_position: 970
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# VerifyEmailResponseDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Response)

Response DTO for email verification operations (code-based and token-based).

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { VerifyEmailResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { VerifyEmailResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { VerifyEmailResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property  | Type     | Required | Description              |
| --------- | -------- | -------- | ------------------------ |
| `message` | `string` | Yes      | Success message          |

## Example

```json
{
  "message": "Email verified successfully. Please log in to continue."
}
```

## Used By

- [EmailVerificationService.verifyEmailWithCode()](../services/email-verification-service#verifyemailwithcode)
- [EmailVerificationService.verifyEmailWithToken()](../services/email-verification-service#verifyemailwithtoken)

