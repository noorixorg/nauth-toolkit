---
title: VerifyEmailWithCodeDTO
description: Request DTO for verifying email addresses using 6-digit verification codes. Includes email and code validation.
keywords: [email, verification, dto, request, code, otp, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# VerifyEmailWithCodeDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)

Request DTO for verifying email addresses using 6-digit verification codes sent via email.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { VerifyEmailWithCodeDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { VerifyEmailWithCodeDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { VerifyEmailWithCodeDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property             | Type     | Required | Description                                                                                    |
| -------------------- | -------- | -------- | ---------------------------------------------------------------------------------------------- |
| `email`              | `string` | Yes      | User email address. Valid email format (RFC 5322). Max 255 characters. Trimmed and lowercased. |
| `code`               | `string` | Yes      | Verification code. Numeric string only. Max 6 characters. Whitespace removed.                  |
| `challengeSessionId` | `number` | No       | Challenge session ID to link this verification to. Ensures codes are only valid for the session they were created for. |

## Example

```json
{
  "email": "user@example.com",
  "code": "123456"
}
```

## Used By

- [EmailVerificationService.verifyEmailWithCode()](../services/email-verification-service#verifyemailwithcode)

