---
title: AuthUserSummary
description: Minimal user info returned in authentication responses
keywords: [user, summary, authentication, response, api]
image: /img/api-social-card.png
---

# AuthUserSummary

**Package:** `@nauth-toolkit/client`
**Type:** Response

Minimal user information returned in authentication responses. Contains essential user data without full profile details.

```typescript
import { AuthUserSummary } from '@nauth-toolkit/client';
```

## Properties

| Property          | Type               | Description                         |
| ----------------- | ------------------ | ----------------------------------- |
| `sub`             | `string`           | User subject identifier (public ID) |
| `email`           | `string`           | User email address                  |
| `firstName`       | `string \| null`   | User first name                     |
| `lastName`        | `string \| null`   | User last name                      |
| `phone`           | `string \| null`   | Phone number in E.164 format        |
| `isEmailVerified` | `boolean`          | Whether email is verified           |
| `isPhoneVerified` | `boolean`          | Whether phone is verified           |
| `socialProviders` | `string[] \| null` | Linked social auth providers        |
| `hasPasswordHash` | `boolean`          | Whether user has a password set     |

## Example

```json
{
  "sub": "user_abc123",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+14155551234",
  "isEmailVerified": true,
  "isPhoneVerified": true,
  "socialProviders": ["google"],
  "hasPasswordHash": true
}
```

## Related Types

- [`AuthUser`](./auth-user) - Complete user profile with all fields
- [`AuthResponse`](./auth-response) - Contains [`AuthUserSummary`](./auth-user-summary) in `user` property

## Used By

- [AuthResponse](./auth-response) - `user` property on successful authentication
- [NAuthClient.login()](../nauth-client#login) - Returns [`AuthResponse`](./auth-response) with [`AuthUserSummary`](./auth-user-summary)
- [NAuthClient.signup()](../nauth-client#signup) - Returns [`AuthResponse`](./auth-response) with [`AuthUserSummary`](./auth-user-summary)
- [NAuthClient.respondToChallenge()](../nauth-client#respondtochallenge) - Returns [`AuthResponse`](./auth-response) with [`AuthUserSummary`](./auth-user-summary)
