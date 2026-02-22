---
title: ConfirmForgotPasswordDTO
description: DTOs for completing a password reset with a 6-digit verification code.
keywords: [password, reset, confirm, dto, request, response, api, code]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# ConfirmForgotPasswordDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request/Response)

Data transfer objects for completing a password reset using a 6-digit numeric verification code delivered via email or SMS.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { ConfirmForgotPasswordDTO, ConfirmForgotPasswordResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { ConfirmForgotPasswordDTO, ConfirmForgotPasswordResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { ConfirmForgotPasswordDTO, ConfirmForgotPasswordResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## ConfirmForgotPasswordDTO (Request)

| Property      | Type     | Required | Description                                                                             |
| ------------- | -------- | -------- | --------------------------------------------------------------------------------------- |
| `identifier`  | `string` | Yes      | User identifier (email, username, or phone). Max 255 characters. Trimmed. Lowercased if email. |
| `code`        | `string` | Yes      | Verification code. Exactly 6 digits. Numeric characters only.                           |
| `newPassword` | `string` | Yes      | New password. 8-128 characters. Not trimmed.                                            |

## ConfirmForgotPasswordResponseDTO (Response)

| Property              | Type      | Description                                        |
| --------------------- | --------- | -------------------------------------------------- |
| `success`             | `boolean` | Always `true` on success.                          |
| `mustChangePassword`  | `boolean` | Whether the user must change their password again on next sign-in. Typically `false` for forgot-password flows. |

## Example

```json
{
  "identifier": "user@example.com",
  "code": "123456",
  "newPassword": "NewSecurePass123!"
}
```

## Used By

- [AuthService.confirmForgotPassword()](../services/auth-service#confirmforgotpassword)
