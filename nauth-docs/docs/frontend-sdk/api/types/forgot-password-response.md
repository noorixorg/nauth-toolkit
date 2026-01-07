---
title: ForgotPasswordResponse
description: Response payload for starting account recovery (forgot password)
sidebar_position: 160
keywords: [password, reset, forgot, response, dto, api]
image: /img/api-social-card.png
---

# ForgotPasswordResponse

**Package:** `@nauth-toolkit/client`
**Type:** Response

Response payload for a forgot-password request. Designed to be non-enumerating.

```typescript
import { ForgotPasswordResponse } from '@nauth-toolkit/client';
```

## Properties

| Property         | Type               | Required | Description                                                                 |
| ---------------- | ------------------ | -------- | --------------------------------------------------------------------------- |
| `success`        | `boolean`          | Yes      | Always `true` when request accepted (even if account does not exist).       |
| `destination`    | `string \| undefined` | No    | Masked destination (for example `j***@example.com` or `+1***1234`).         |
| `deliveryMedium` | `'email' \| 'sms' \| undefined` | No | Delivery medium when known.                                                 |
| `expiresIn`      | `number \| undefined` | No    | Code expiry in seconds when known.                                          |

## Example

```json
{
  "success": true,
  "destination": "j***@example.com",
  "deliveryMedium": "email",
  "expiresIn": 900
}
```

## Used By

- [NAuthClient.forgotPassword()](../nauth-client#forgotpassword) - Returns [`ForgotPasswordResponse`](./forgot-password-response)


