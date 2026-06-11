---
title: ChangePasswordRequest
description: Request payload for changing user password
keywords: [password, change, request, dto, api]
image: /img/api-social-card.png
---

# ChangePasswordRequest

**Package:** `@nauth-toolkit/client`
**Type:** Request

Request payload for changing user password. Requires current password for verification.

```typescript
import { ChangePasswordRequest } from '@nauth-toolkit/client';
```

## Properties

| Property      | Type     | Required | Description                           |
| ------------- | -------- | -------- | ------------------------------------- |
| `oldPassword` | `string` | Yes      | Current password for verification     |
| `newPassword` | `string` | Yes      | New password (must meet requirements) |

## Example

```json
{
  "oldPassword": "oldPassword123",
  "newPassword": "newSecurePassword456!"
}
```

## Used By

- [NAuthClient.changePassword()](../nauth-client#changepassword) - Accepts [`ChangePasswordRequest`](./change-password-request)

## Related Types

- [`ForgotPasswordRequest`](./forgot-password-request) - Start account recovery
- [`ConfirmForgotPasswordRequest`](./confirm-forgot-password-request) - Confirm account recovery
- [`AuthUser`](./auth-user) - User profile
- [`UpdateProfileRequest`](./update-profile-request) - Profile update request
