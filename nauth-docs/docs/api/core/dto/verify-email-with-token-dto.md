---
title: VerifyEmailWithTokenDTO
description: Request DTO for verifying email addresses using URL tokens from verification links. Token must be 64-character hexadecimal string.
keywords: [email, verification, dto, request, token, link, api]
image: /img/api-social-card.png
sidebar_position: 340
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# VerifyEmailWithTokenDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)

Request DTO for verifying email addresses using verification tokens from email links.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { VerifyEmailWithTokenDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { VerifyEmailWithTokenDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { VerifyEmailWithTokenDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property | Type     | Required | Description                                                                                    |
| -------- | -------- | -------- | ---------------------------------------------------------------------------------------------- |
| `token`  | `string` | Yes      | Verification token from email link. Exactly 64 hexadecimal characters (SHA-256 hash). Trimmed and lowercased. |

## Example

```json
{
  "token": "abc123def456789012345678901234567890123456789012345678901234567890"
}
```

## Used By

- [EmailVerificationService.verifyEmailWithToken()](../services/email-verification-service#verifyemailwithtoken)

