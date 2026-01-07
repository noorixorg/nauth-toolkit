---
title: ResetPasswordWithCodeRequest
description: Request payload for resetting password with verification code or token (works for both admin-initiated and user-initiated resets)
sidebar_position: 162
keywords: [password, reset, code, token, request, dto, api]
image: /img/api-social-card.png
---

# ResetPasswordWithCodeRequest

**Package:** `@nauth-toolkit/client`
**Type:** Request

Request payload for resetting password with code or token. Generic method that works for both admin-initiated (adminResetPassword) and user-initiated (forgotPassword) password resets.

```typescript
import { ResetPasswordWithCodeRequest } from '@nauth-toolkit/client';
```

## Properties

| Property      | Type     | Required | Description                                                                        |
| ------------- | -------- | -------- | ---------------------------------------------------------------------------------- |
| `code`        | `string` | No       | Verification code from email/SMS (6-10 digits). One of `code` or `token` required. |
| `identifier`  | `string` | Yes      | User identifier (email, username, phone)                                           |
| `newPassword` | `string` | Yes      | New password (min 8 characters)                                                    |
| `token`       | `string` | No       | Verification token from link (64-char hex). One of `code` or `token` required.     |

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
