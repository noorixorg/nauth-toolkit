---
title: EnableUserResponse
description: Response payload for enabling a user account with updated user
keywords: [admin, enable, user, response, api]
image: /img/api-social-card.png
---

# EnableUserResponse

**Package:** `@nauth-toolkit/client`
**Type:** Response

Response payload for enabling a user account. Returns enable confirmation with updated user.

```typescript
import { EnableUserResponse } from '@nauth-toolkit/client';
```

## Properties

| Property | Type      | Description                                                      |
| -------- | --------- | ---------------------------------------------------------------- |
| `success`| `boolean` | Success indicator                                                |
| `user`   | [`AuthUser`](./auth-user) | Updated user object (same structure as [`AuthUser`](./auth-user)) |

## Example

```json
{
  "success": true,
  "user": {
    "id": 123,
    "sub": "a21b654c-2746-4168-acee-c175083a65cd",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "isEmailVerified": true,
    "isPhoneVerified": false,
    "isActive": true,
    "isLocked": false,
    "mfaEnabled": false,
    "hasPasswordHash": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-15T12:00:00.000Z"
  }
}
```

## Related Types

- [`AuthUser`](./auth-user) - User profile structure
- [`DisableUserResponse`](./disable-user-response) - Response for disabling a user

## Used By

- [AdminOperations.enableUser()](../admin-operations#enableuser) - Returns [`EnableUserResponse`](./enable-user-response)
