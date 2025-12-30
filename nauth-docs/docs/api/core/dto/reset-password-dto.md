---
title: ResetPasswordDTO
description: Password reset DTOs for requesting and performing password reset. Includes identifier validation and token-based reset flow.
keywords: [reset, password, dto, authentication, request, token, api]
image: /img/api-social-card.png
sidebar_position: 250
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# ResetPasswordDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)

Data transfer objects for password reset flow: request reset token and reset password with token.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { ResetPasswordRequestDTO, ResetPasswordDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { ResetPasswordRequestDTO, ResetPasswordDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { ResetPasswordRequestDTO, ResetPasswordDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## ResetPasswordRequestDTO

Request password reset token via email or phone.

| Property     | Type     | Required | Description                                                      |
| ------------ | -------- | -------- | ---------------------------------------------------------------- |
| `identifier` | `string` | Yes      | Email or phone number. 1-255 characters. Trimmed, lowercased if email. |

## ResetPasswordDTO

Reset password with valid reset token.

| Property      | Type     | Required | Description                                                      |
| ------------- | -------- | -------- | ---------------------------------------------------------------- |
| `token`       | `string` | Yes      | Reset token from email. 1-255 characters. Trimmed.               |
| `newPassword` | `string` | Yes      | New password. 8-128 characters. Not trimmed.                    |

## Example

**Request Reset:**

```json
{
  "identifier": "user@example.com"
}
```

**Reset Password:**

```json
{
  "token": "reset-token-from-email",
  "newPassword": "NewSecurePass123!"
}
```

## Used By

- [AuthService.requestPasswordReset()](../services/auth-service) - Uses ResetPasswordRequestDTO
- [AuthService.resetPassword()](../services/auth-service) - Uses ResetPasswordDTO
