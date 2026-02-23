---
title: ConfirmAdminResetPasswordDTO
description: DTOs for completing an admin-initiated password reset with a verification code.
keywords: [admin, password, reset, confirm, dto, request, response, api, code]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# ConfirmAdminResetPasswordDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request/Response)

Data transfer objects for completing an admin-initiated password reset using a verification code delivered via email or SMS.

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

| Property      | Type     | Required | Description                                                                             |
| ------------- | -------- | -------- | --------------------------------------------------------------------------------------- |
| `identifier`  | `string` | Yes      | User identifier (email, username, or phone). 1-255 characters. Trimmed. Lowercased if email. |
| `code`        | `string` | Yes      | Verification code. 6-10 characters. Trimmed.                                            |
| `newPassword` | `string` | Yes      | New password. 8-128 characters. Not trimmed.                                            |

## ConfirmAdminResetPasswordResponseDTO (Response)

| Property  | Type      | Description                       |
| --------- | --------- | --------------------------------- |
| `success` | `boolean` | Always `true` on successful reset. |

## Example

```json
{
  "identifier": "user@example.com",
  "code": "123456",
  "newPassword": "NewSecurePass123!"
}
```

## Used By

- [AdminAuthService.confirmResetPassword()](../services/admin-auth-service#confirmresetpassword)
