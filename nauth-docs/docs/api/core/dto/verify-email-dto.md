---
title: VerifyEmailDTO
description: Email verification DTOs for verifying with code or token, and resending verification emails. Includes strict validation for security.
keywords: [verify, email, dto, verification, code, token, api]
image: /img/api-social-card.png
sidebar_position: 960
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# VerifyEmailDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)

Data transfer objects for email verification: verify with code, verify with token, and resend verification email.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { VerifyEmailWithCodeDTO, VerifyEmailWithTokenDTO, ResendVerificationEmailDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { VerifyEmailWithCodeDTO, VerifyEmailWithTokenDTO, ResendVerificationEmailDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { VerifyEmailWithCodeDTO, VerifyEmailWithTokenDTO, ResendVerificationEmailDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## VerifyEmailWithCodeDTO

Verify email with 6-digit code.

| Property | Type     | Required | Description                                                      |
| -------- | -------- | -------- | ---------------------------------------------------------------- |
| `email`  | `string` | Yes      | Email address. Valid email format. Max 255 characters. Trimmed and lowercased. |
| `code`   | `string` | Yes      | Verification code. Exactly 6 digits. Whitespace removed.         |

## VerifyEmailWithTokenDTO

Verify email with URL token.

| Property | Type     | Required | Description                                                      |
| -------- | -------- | -------- | ---------------------------------------------------------------- |
| `token`  | `string` | Yes      | Verification token. Exactly 64 hexadecimal characters. Trimmed and lowercased. |

## ResendVerificationEmailDTO

Resend verification email.

| Property | Type     | Required | Description                                                      |
| -------- | -------- | -------- | ---------------------------------------------------------------- |
| `email`  | `string` | Yes      | Email address. Valid email format. Max 255 characters. Trimmed and lowercased. |

## Example

**Verify with Code:**

```json
{
  "email": "user@example.com",
  "code": "123456"
}
```

**Verify with Token:**

```json
{
  "token": "a1b2c3d4e5f6..."
}
```

**Resend Email:**

```json
{
  "email": "user@example.com"
}
```

## Used By

- [EmailVerificationService](../services/email-verification-service) - Uses these DTOs
