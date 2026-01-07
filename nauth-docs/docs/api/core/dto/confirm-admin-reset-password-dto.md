---
title: ConfirmAdminResetPasswordDTO
description: DTOs for completing admin-initiated password reset with verification code or token. Accepts either short code from email/SMS or long token from link.
keywords: [admin, password, reset, confirm, dto, request, response, api, code, token]
image: /img/api-social-card.png
sidebar_position: 120
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# ConfirmAdminResetPasswordDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request/Response)

Data transfer objects for completing admin-initiated password reset. Accepts either short code from email/SMS (6-10 digits) or long token from link (64-char hex).

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
| `code`        | `string` | No       | Verification code from email/SMS. 6-10 characters. Trimmed. One of `code` or `token` required.   |
| `identifier`  | `string` | Yes      | User identifier. Email, username, phone, or sub/UUID. 1-255 chars. Trimmed, lowercased if email. |
| `newPassword` | `string` | Yes      | New password. 8-128 characters.                                                                  |
| `token`       | `string` | No       | Verification token from link. 64-char hex string. Trimmed. One of `code` or `token` required.    |

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
