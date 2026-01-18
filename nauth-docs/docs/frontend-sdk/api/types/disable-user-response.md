---
title: DisableUserResponse
description: Response payload for disabling a user account with revoked session count
keywords: [admin, disable, user, response, api]
image: /img/api-social-card.png
---

# DisableUserResponse

**Package:** `@nauth-toolkit/client`
**Type:** Response

Response payload for disabling a user account. Returns disable confirmation with updated user and revoked session count.

```typescript
import { DisableUserResponse } from '@nauth-toolkit/client';
```

## Properties

| Property          | Type      | Description                                                      |
| ----------------- | --------- | ---------------------------------------------------------------- |
| `revokedSessions` | `number`  | Number of sessions revoked                                       |
| `success`         | `boolean` | Success indicator                                                |
| `user`            | [`AuthUser`](./auth-user) | Updated user object (same structure as [`AuthUser`](./auth-user)) |

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
    "isActive": false,
    "isLocked": true,
    "mfaEnabled": false,
    "hasPasswordHash": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-15T12:00:00.000Z"
  },
  "revokedSessions": 5
}
```

## Related Types

- [`AuthUser`](./auth-user) - User profile structure
- [`EnableUserResponse`](./enable-user-response) - Response for enabling a user

## Used By

- [AdminOperations.disableUser()](../admin-operations#disableuser) - Returns [`DisableUserResponse`](./disable-user-response)
