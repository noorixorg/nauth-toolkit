---
title: ConfirmForgotPasswordRequest
description: Request payload for confirming a password reset code and setting a new password
sidebar_position: 113
keywords: [password, reset, confirm, request, dto, api]
image: /img/api-social-card.png
---

# ConfirmForgotPasswordRequest

**Package:** `@nauth-toolkit/client`
**Type:** Request

Request payload for confirming a forgot-password reset code and setting a new password.

```typescript
import { ConfirmForgotPasswordRequest } from '@nauth-toolkit/client';
```

## Properties

| Property     | Type     | Required | Description                           |
| ------------ | -------- | -------- | ------------------------------------- |
| `identifier` | `string` | Yes      | Email, username, or phone identifier. |
| `code`       | `string` | Yes      | One-time reset code.                  |
| `newPassword`| `string` | Yes      | New password (must meet requirements).|

## Example

```json
{
  "identifier": "user@example.com",
  "code": "123456",
  "newPassword": "NewSecurePass123!"
}
```

## Used By

- [NAuthClient.confirmForgotPassword()](../nauth-client#confirmforgotpassword) - Accepts [`ConfirmForgotPasswordRequest`](./confirm-forgot-password-request)


