---
title: AdminSignupRequest
description: Request payload for admin user creation with verification bypass and password generation
keywords: [admin, signup, user creation, request, api]
image: /img/api-social-card.png
---

# AdminSignupRequest

**Package:** `@nauth-toolkit/client`
**Type:** Request

Request payload for admin user creation. Allows administrators to create user accounts with override capabilities including bypassing verification requirements, forcing password changes, and auto-generating secure passwords.

```typescript
import { AdminSignupRequest } from '@nauth-toolkit/client';
```

## Properties

| Property            | Type                        | Required | Description                                                                 |
| ------------------- | --------------------------- | -------- | --------------------------------------------------------------------------- |
| `email`             | `string`                    | Yes      | User email address. Must be valid email format.                             |
| `firstName`         | `string`                    | No       | User first name                                                              |
| `generatePassword`  | `boolean`                   | No       | Auto-generate secure password. Default: `false`. Required if `password` omitted. |
| `isEmailVerified`   | `boolean`                   | No       | Bypass email verification requirement. Default: `false`.                     |
| `isPhoneVerified`   | `boolean`                   | No       | Bypass phone verification requirement. Default: `false`.                     |
| `lastName`          | `string`                    | No       | User last name                                                               |
| `metadata`          | `Record<string, unknown>`   | No       | Custom metadata object (saved to user record)                              |
| `mustChangePassword`| `boolean`                   | No       | Force password change on first login. Default: `false`.                      |
| `password`          | `string`                    | No       | User password. Required unless `generatePassword` is `true`. Must meet backend password requirements. |
| `phone`             | `string`                    | No       | Phone number in E.164 format (e.g., `+14155551234`)                         |
| `username`          | `string`                    | No       | Optional username                                                            |

## Example

```json
{
  "email": "newuser@example.com",
  "password": "SecurePass123!",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+14155551234",
  "isEmailVerified": true,
  "isPhoneVerified": false,
  "mustChangePassword": false,
  "metadata": {
    "source": "admin",
    "department": "Engineering"
  }
}
```

**With auto-generated password:**

```json
{
  "email": "newuser@example.com",
  "generatePassword": true,
  "isEmailVerified": true,
  "mustChangePassword": true,
  "firstName": "Jane",
  "lastName": "Smith"
}
```

## Related Types

- [`AdminSignupResponse`](./admin-signup-response) - Response containing created user and optional generated password
- [`AuthUser`](./auth-user) - Complete user profile structure

## Used By

- [AdminOperations.createUser()](../admin-operations#createuser) - Accepts [`AdminSignupRequest`](./admin-signup-request)
