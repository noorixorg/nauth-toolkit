---
title: AdminResetPasswordRequest
description: Request payload for admin-initiated password reset with delivery options
keywords: [admin, password, reset, request, api]
image: /img/api-social-card.png
---

# AdminResetPasswordRequest

**Package:** `@nauth-toolkit/client`
**Type:** Request

Request payload for admin-initiated password reset workflow. Allows resetting a user's password by sub (UUID) with configurable delivery method and session revocation.

```typescript
import { AdminResetPasswordRequest } from '@nauth-toolkit/client';
```

## Properties

| Property          | Type                        | Required | Description                                                                 |
| ----------------- | --------------------------- | -------- | --------------------------------------------------------------------------- |
| `baseUrl`         | `string`                    | No       | Base URL for building reset link. Allows consumer apps to build custom reset UI. |
| `codeExpiresIn`   | `number`                    | No       | Code expiry in seconds. Default: `3600` (1 hour). Min: `300` (5 minutes), Max: `86400` (24 hours). |
| `deliveryMethod`  | `'email' \| 'sms'`          | No       | Delivery method for reset code. Default: `'email'`.                         |
| `reason`          | `string`                    | No       | Reason for admin-initiated reset (for audit trail). Max: 500 characters.     |
| `revokeSessions`  | `boolean`                   | No       | Revoke all active sessions immediately (before sending email). Default: `false`. |
| `sub`             | `string`                    | Yes      | User sub (UUID v4)                                                           |

## Example

**With link for custom UI:**

```json
{
  "sub": "a21b654c-2746-4168-acee-c175083a65cd",
  "baseUrl": "https://myapp.com/reset-password",
  "deliveryMethod": "email",
  "revokeSessions": true,
  "codeExpiresIn": 3600,
  "reason": "User requested password reset via support"
}
```

**Code only (no link):**

```json
{
  "sub": "a21b654c-2746-4168-acee-c175083a65cd",
  "deliveryMethod": "email"
}
```

## Related Types

- [`AdminResetPasswordResponse`](./admin-reset-password-response) - Response containing delivery information
- [`AuthUser`](./auth-user) - User profile structure

## Used By

- [AdminOperations.initiatePasswordReset()](../admin-operations#initiatepasswordreset) - Accepts [`AdminResetPasswordRequest`](./admin-reset-password-request)
