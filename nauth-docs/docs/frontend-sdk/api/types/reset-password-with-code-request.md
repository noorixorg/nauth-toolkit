---
title: ResetPasswordWithCodeRequest
description: Request payload for resetting password with verification code (works for both admin-initiated and user-initiated resets)
keywords: [password, reset, code, request, dto, api]
image: /img/api-social-card.png
---

# ResetPasswordWithCodeRequest

**Package:** `@nauth-toolkit/client`
**Type:** Request

Request payload for resetting password with a verification code. Generic method that works for both admin-initiated (adminResetPassword) and user-initiated (forgotPassword) password resets.

```typescript
import { ResetPasswordWithCodeRequest } from '@nauth-toolkit/client';
```

## Properties

| Property      | Type     | Required | Description                                                                        |
| ------------- | -------- | -------- | ---------------------------------------------------------------------------------- |
| `code`        | `string` | Yes      | Verification code from email/SMS (6-10 digits).                                    |
| `identifier`  | `string` | Yes      | User identifier (email, username, phone)                                           |
| `newPassword` | `string` | Yes      | New password (min 8 characters)                                                    |

## Example

```json
{
  "identifier": "user@example.com",
  "code": "123456",
  "newPassword": "NewPass123!"
}
```

## Used By

- [NAuthClient.resetPasswordWithCode()](../nauth-client#resetpasswordwithcode) - Internal request payload
