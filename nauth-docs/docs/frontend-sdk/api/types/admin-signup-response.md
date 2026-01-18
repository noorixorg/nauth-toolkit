---
title: AdminSignupResponse
description: Response payload for admin user creation containing user and optional generated password
keywords: [admin, signup, user creation, response, api]
image: /img/api-social-card.png
---

# AdminSignupResponse

**Package:** `@nauth-toolkit/client`
**Type:** Response

Response payload for admin user creation. Returns the created user object and optionally the generated password (only if `generatePassword` was `true` in the request).

```typescript
import { AdminSignupResponse } from '@nauth-toolkit/client';
```

## Properties

| Property            | Type      | Description                                                                 |
| ------------------ | --------- | --------------------------------------------------------------------------- |
| `generatedPassword`| `string`  | Generated password (only present if `generatePassword` was `true`). Returned once and never stored in plain text. |
| `user`             | [`AuthUser`](./auth-user) | Created user object (same structure as [`AuthUser`](./auth-user))          |

## Example

**With generated password:**

```json
{
  "user": {
    "id": 123,
    "sub": "a21b654c-2746-4168-acee-c175083a65cd",
    "email": "newuser@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "isEmailVerified": true,
    "isPhoneVerified": false,
    "isActive": true,
    "isLocked": false,
    "mfaEnabled": false,
    "hasPasswordHash": true,
    "createdAt": "2024-01-15T12:00:00.000Z",
    "updatedAt": "2024-01-15T12:00:00.000Z"
  },
  "generatedPassword": "Xk9#mP2$vL7@qR4"
}
```

**Without generated password:**

```json
{
  "user": {
    "id": 124,
    "sub": "b32c765d-3857-5279-bdff-d286194b76de",
    "email": "anotheruser@example.com",
    "firstName": "Jane",
    "lastName": "Smith",
    "isEmailVerified": true,
    "isPhoneVerified": false,
    "isActive": true,
    "isLocked": false,
    "mfaEnabled": false,
    "hasPasswordHash": true,
    "createdAt": "2024-01-15T12:05:00.000Z",
    "updatedAt": "2024-01-15T12:05:00.000Z"
  }
}
```

## Related Types

- [`AdminSignupRequest`](./admin-signup-request) - Request payload for user creation
- [`AuthUser`](./auth-user) - Complete user profile structure

## Used By

- [AdminOperations.createUser()](../admin-operations#createuser) - Returns [`AdminSignupResponse`](./admin-signup-response)
