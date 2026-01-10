---
title: ForgotPasswordRequest
description: Request payload for starting account recovery with a password reset code
sidebar_position: 150
keywords: [password, reset, forgot, request, dto, api]
image: /img/api-social-card.png
---

# ForgotPasswordRequest

**Package:** `@nauth-toolkit/client`
**Type:** Request

Request payload for starting account recovery (forgot password). Triggers a password reset code to be sent if possible.

```typescript
import { ForgotPasswordRequest } from '@nauth-toolkit/client';
```

## Properties

| Property     | Type     | Required | Description                           |
| ------------ | -------- | -------- | ------------------------------------- |
| `identifier` | `string` | Yes      | Email, username, or phone identifier. |

## Example

```json
{
  "identifier": "user@example.com"
}
```

## Used By

- [NAuthClient.forgotPassword()](../nauth-client#forgotpassword) - Accepts [`ForgotPasswordRequest`](./forgot-password-request)


