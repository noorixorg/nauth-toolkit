---
title: ConfirmForgotPasswordResponse
description: Response payload for confirming a password reset and setting a new password
sidebar_position: 140
keywords: [password, reset, confirm, response, dto, api]
image: /img/api-social-card.png
---

# ConfirmForgotPasswordResponse

**Package:** `@nauth-toolkit/client`
**Type:** Response

Response payload for confirming a forgot-password reset.

```typescript
import { ConfirmForgotPasswordResponse } from '@nauth-toolkit/client';
```

## Properties

| Property            | Type      | Required | Description                             |
| ------------------- | --------- | -------- | --------------------------------------- |
| `success`           | `boolean` | Yes      | Whether the reset completed successfully. |
| `mustChangePassword`| `boolean` | Yes      | Always `false` for this flow.             |

## Example

```json
{
  "success": true,
  "mustChangePassword": false
}
```

## Used By

- [NAuthClient.confirmForgotPassword()](../nauth-client#confirmforgotpassword) - Returns [`ConfirmForgotPasswordResponse`](./confirm-forgot-password-response)


