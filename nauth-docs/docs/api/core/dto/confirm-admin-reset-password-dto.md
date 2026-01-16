---
title: ConfirmAdminResetPasswordDTO
description: DTOs for completing admin-initiated password reset with a verification code (links, when present, also carry code).
keywords: [admin, password, reset, confirm, dto, request, response, api, code]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# ConfirmAdminResetPasswordDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request/Response)

Data transfer objects for completing admin-initiated password reset using a verification code (6-10 digits). Links are optional and, when present, include the same `code` as a query parameter to keep consumer apps code-only.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { ConfirmAdminResetPasswordDTO, ConfirmAdminResetPasswordResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { ConfirmAdminResetPasswordDTO, ConfirmAdminResetPasswordResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { ConfirmAdminResetPasswordDTO, ConfirmAdminResetPasswordResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## ConfirmAdminResetPasswordDTO (Request)

| Property      | Type     | Required | Description                                                                                      |
| ------------- | -------- | -------- | ------------------------------------------------------------------------------------------------ |
| `code`        | `string` | Yes      | Verification code from email/SMS. 6-10 characters. Trimmed.                                      |
| `identifier`  | `string` | Yes      | User identifier. Email, username, phone, or sub/UUID. 1-255 chars. Trimmed, lowercased if email. |
| `newPassword` | `string` | Yes      | New password. 8-128 characters.                                                                  |

## ConfirmAdminResetPasswordResponseDTO (Response)

| Property  | Type      | Description             |
| --------- | --------- | ----------------------- |
| `success` | `boolean` | Always true on success. |

## Example

```json
{
  "identifier": "user@example.com",
  "code": "123456",
  "newPassword": "NewSecurePass123!"
}
```

## Used By

- [AuthService.confirmAdminResetPassword()](../services/auth-service#confirmadminresetpassword)
