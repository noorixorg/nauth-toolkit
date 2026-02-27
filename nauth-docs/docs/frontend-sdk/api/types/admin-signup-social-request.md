---
title: AdminSignupSocialRequest
description: Request payload for admin social user import with provider linkage
keywords: [admin, social, import, request, api]
image: /img/api-social-card.png
---

# AdminSignupSocialRequest

**Package:** `@nauth-toolkit/client`
**Type:** Request

Request payload for admin social user import. Allows administrators to import existing social users from external platforms (e.g., Cognito, Auth0) with social account linkage.

```typescript
import { AdminSignupSocialRequest } from '@nauth-toolkit/client';
```

## Properties

| Property            | Type                        | Required | Description                                                                 |
| ------------------- | --------------------------- | -------- | --------------------------------------------------------------------------- |
| `email`             | `string`                    | Yes      | User email address. Must be valid email format.                             |
| `firstName`         | `string`                    | No       | User first name                                                              |
| `lastName`          | `string`                    | No       | User last name                                                               |
| `metadata`          | `Record<string, unknown>`   | No       | Custom metadata object (saved to user record)                              |
| `mustChangePassword`| `boolean`                   | No       | Force password change on first login. Default: `false`.                      |
| `password`          | `string`                    | No       | Optional password for hybrid social+password accounts                        |
| `phone`             | `string`                    | No       | Phone number in E.164 format (e.g., `+14155551234`)                         |
| `isPhoneVerified`  | `boolean`                   | No       | Bypass phone verification requirement. Default: `false`.                     |
| `provider`          | `'google' \| 'apple' \| 'facebook'` | Yes | Social provider name                                                      |
| `providerEmail`     | `string`                    | No       | Provider's email address                                                    |
| `providerId`        | `string`                    | Yes      | Provider's unique user identifier                                           |
| `socialMetadata`    | `Record<string, unknown>`   | No       | Raw OAuth profile data from provider                                        |
| `username`          | `string`                    | No       | Optional username                                                            |

## Example

**Social-only user:**

```json
{
  "email": "user@example.com",
  "provider": "google",
  "providerId": "google_12345",
  "providerEmail": "user@gmail.com",
  "firstName": "John",
  "lastName": "Doe",
  "socialMetadata": {
    "sub": "google_12345",
    "given_name": "John",
    "family_name": "Doe"
  }
}
```

**Hybrid user (social + password):**

```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "provider": "apple",
  "providerId": "apple_67890",
  "firstName": "Jane",
  "lastName": "Smith",
  "isPhoneVerified": true,
  "phone": "+14155551234"
}
```

## Related Types

- [`AdminSignupSocialResponse`](./admin-signup-social-response) - Response containing created user and social account info
- [`AuthUser`](./auth-user) - Complete user profile structure

## Used By

- [AdminOperations.importSocialUser()](../admin-operations#importsocialuser) - Accepts [`AdminSignupSocialRequest`](./admin-signup-social-request)
