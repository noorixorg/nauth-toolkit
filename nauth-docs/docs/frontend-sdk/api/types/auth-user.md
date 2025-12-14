---
title: AuthUser
description: Complete user profile with authentication and MFA status
sidebar_position: 70
keywords: [user, profile, authentication, mfa, api]
image: /img/api-social-card.png
---

# AuthUser

**Package:** `@nauth-toolkit/client`
**Type:** Response

Complete user profile returned from profile endpoints. Includes authentication status, MFA configuration, and account metadata.

```typescript
import { AuthUser } from '@nauth-toolkit/client';
```

## Properties

| Property             | Type             | Description                                                      |
| -------------------- | ---------------- | ---------------------------------------------------------------- |
| `id`                 | `number`         | Internal user ID                                                 |
| `sub`                | `string`         | User subject identifier (public ID)                              |
| `email`              | `string`         | User email address                                               |
| `firstName`          | `string \| null` | User first name                                                  |
| `lastName`           | `string \| null` | User last name                                                   |
| `phone`              | `string \| null` | Phone number in E.164 format (e.g., `+14155551234`)              |
| `isEmailVerified`    | `boolean`        | Whether email is verified                                        |
| `isPhoneVerified`    | `boolean`        | Whether phone is verified                                        |
| `mfaEnabled`         | `boolean`        | Whether MFA is enabled                                           |
| `preferredMfaMethod` | `string \| null` | Preferred MFA method (`'sms'`, `'email'`, `'totp'`, `'passkey'`) |
| `socialProviders`    | `string[]`       | Linked social auth providers (e.g., `['google', 'apple']`)       |
| `hasPasswordHash`    | `boolean`        | Whether user has a password set                                  |
| `isActive`           | `boolean`        | Whether account is active                                        |
| `createdAt`          | `Date`           | Account creation timestamp                                       |
| `updatedAt`          | `Date`           | Last update timestamp                                            |

## Example

```json
{
  "id": 123,
  "sub": "user_abc123",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+14155551234",
  "isEmailVerified": true,
  "isPhoneVerified": true,
  "mfaEnabled": true,
  "preferredMfaMethod": "totp",
  "socialProviders": ["google"],
  "hasPasswordHash": true,
  "isActive": true,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-15T12:30:00.000Z"
}
```

## Related Types

- [`AuthUserSummary`](./auth-user-summary) - Minimal user info in [`AuthResponse`](./auth-response)
- [`UpdateProfileRequest`](./update-profile-request) - Profile update payload
- [`AuthResponse`](./auth-response) - Authentication response containing user

## Used By

- [NAuthClient.getProfile()](../nauth-client#getprofile) - Returns [`AuthUser`](./auth-user)
- [NAuthClient.updateProfile()](../nauth-client#updateprofile) - Accepts [`UpdateProfileRequest`](./update-profile-request), returns [`AuthUser`](./auth-user)
- [NAuthClient.getCurrentUser()](../nauth-client#getcurrentuser) - Returns [`AuthUser`](./auth-user) or `null`
- [Angular AuthService.getProfile()](../../angular/auth-service#getprofile) - Observable wrapper
- [Angular AuthService.updateProfile()](../../angular/auth-service#updateprofile) - Observable wrapper
- [Angular AuthService.getCurrentUser()](../../angular/auth-service#sync-accessors) - Sync accessor
