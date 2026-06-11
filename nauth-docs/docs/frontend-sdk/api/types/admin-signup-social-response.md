---
title: AdminSignupSocialResponse
description: Response payload for admin social user import containing user and social account info
keywords: [admin, social, import, response, api]
image: /img/api-social-card.png
---

# AdminSignupSocialResponse

**Package:** `@nauth-toolkit/client`
**Type:** Response

Response payload for admin social user import. Returns the created user object and social account information for confirmation.

```typescript
import { AdminSignupSocialResponse } from '@nauth-toolkit/client';
```

## Properties

| Property        | Type      | Description                                                      |
| --------------- | --------- | ---------------------------------------------------------------- |
| `socialAccount` | `object`  | Social account information                                       |
| `socialAccount.provider` | `string` | Social provider name (e.g., `'google'`, `'apple'`, `'facebook'`) |
| `socialAccount.providerEmail` | `string \| null` | Provider's email address (if available)                    |
| `socialAccount.providerId` | `string` | Provider's unique user identifier                               |
| `user`         | [`AuthUser`](./auth-user) | Created user object (same structure as [`AuthUser`](./auth-user)) |

## Example

```json
{
  "user": {
    "id": 125,
    "sub": "c43d876e-4968-6390-ce00-e397305c87ef",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "isEmailVerified": true,
    "isPhoneVerified": false,
    "isActive": true,
    "isLocked": false,
    "mfaEnabled": false,
    "hasPasswordHash": false,
    "socialProviders": ["google"],
    "createdAt": "2024-01-15T12:10:00.000Z",
    "updatedAt": "2024-01-15T12:10:00.000Z"
  },
  "socialAccount": {
    "provider": "google",
    "providerId": "google_12345",
    "providerEmail": "user@gmail.com"
  }
}
```

## Related Types

- [`AdminSignupSocialRequest`](./admin-signup-social-request) - Request payload for social user import
- [`AuthUser`](./auth-user) - Complete user profile structure

## Used By

- [AdminOperations.importSocialUser()](../admin-operations#importsocialuser) - Returns [`AdminSignupSocialResponse`](./admin-signup-social-response)
