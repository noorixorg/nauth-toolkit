---
title: ResetPasswordWithCodeResponse
description: Response payload for password reset with verification code
sidebar_position: 163
keywords: [password, reset, code, response, dto, api]
image: /img/api-social-card.png
---

# ResetPasswordWithCodeResponse

**Package:** `@nauth-toolkit/client`
**Type:** Response

Response payload for successful password reset with verification code.

```typescript
import { ResetPasswordWithCodeResponse } from '@nauth-toolkit/client';
```

## Properties

| Property  | Type      | Description                               |
| --------- | --------- | ----------------------------------------- |
| `success` | `boolean` | Always true on successful password reset. |

## Example

```json
{
  "success": true
}
```

## Used By

- [NAuthClient.resetPasswordWithCode()](../nauth-client#resetpasswordwithcode) - Returns [`ResetPasswordWithCodeResponse`](./reset-password-with-code-response)
