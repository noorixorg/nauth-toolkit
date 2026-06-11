---
title: AdminResetPasswordResponse
description: Response payload for admin-initiated password reset with delivery information
keywords: [admin, password, reset, response, api]
image: /img/api-social-card.png
---

# AdminResetPasswordResponse

**Package:** `@nauth-toolkit/client`
**Type:** Response

Response payload for admin-initiated password reset request. Contains delivery information and optional session revocation count.

```typescript
import { AdminResetPasswordResponse } from '@nauth-toolkit/client';
```

## Properties

| Property          | Type                | Description                                                      |
| ----------------- | ------------------- | ---------------------------------------------------------------- |
| `deliveryMedium`  | `'email' \| 'sms'`  | Delivery medium used                                              |
| `destination`     | `string`            | Masked destination where code was sent (e.g., `"u***r@example.com"` or `"***-***-5678"`) |
| `expiresIn`       | `number`             | Code expiry in seconds                                            |
| `sessionsRevoked` | `number`            | Number of sessions revoked (if `revokeSessions` was `true`)      |
| `success`         | `boolean`            | Success indicator                                                |

## Example

```json
{
  "success": true,
  "destination": "u***r@example.com",
  "deliveryMedium": "email",
  "expiresIn": 3600,
  "sessionsRevoked": 3
}
```

**SMS delivery:**

```json
{
  "success": true,
  "destination": "***-***-5678",
  "deliveryMedium": "sms",
  "expiresIn": 3600,
  "sessionsRevoked": 0
}
```

## Related Types

- [`AdminResetPasswordRequest`](./admin-reset-password-request) - Request payload for password reset
- [`AuthUser`](./auth-user) - User profile structure

## Used By

- [AdminOperations.initiatePasswordReset()](../admin-operations#initiatepasswordreset) - Returns [`AdminResetPasswordResponse`](./admin-reset-password-response)
