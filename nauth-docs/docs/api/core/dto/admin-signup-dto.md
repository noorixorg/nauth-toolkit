---
title: AdminSignupDTO
description: Admin-only user creation DTOs for creating user accounts with override capabilities including bypassing verification and auto-generating passwords.
keywords: [admin, signup, create, user, dto, request, response, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# AdminSignupDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request/Response)

Data transfer objects for admin-initiated user account creation with override capabilities.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { AdminSignupDTO, AdminSignupResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { AdminSignupDTO, AdminSignupResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { AdminSignupDTO, AdminSignupResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## AdminSignupDTO (Request)

| Property             | Type                     | Required | Description                                                                                      |
| -------------------- | ------------------------ | -------- | ------------------------------------------------------------------------------------------------ |
| `email`              | `string`                 | Yes      | User email address. Valid email format (RFC 5322). Max 255 chars. Trimmed, lowercased.          |
| `password`           | `string`                 | No       | User password. Required unless `generatePassword` is true. 8-128 characters. Not trimmed.        |
| `username`           | `string`                 | No       | Optional username. 3-255 characters. Alphanumeric, underscores, and hyphens only. Trimmed, lowercased. |
| `firstName`          | `string`                 | No       | Optional first name. 1-100 characters. Letters, spaces, hyphens, and apostrophes only. Trimmed. |
| `lastName`           | `string`                 | No       | Optional last name. 1-100 characters. Letters, spaces, hyphens, and apostrophes only. Trimmed.  |
| `phone`              | `string`                 | No       | Optional phone number. E.164 format with + prefix. Max 20 chars. Example: +14155552671.          |
| `metadata`           | `Record<string, unknown>` | No       | Optional custom metadata fields.                                                                |
| `isEmailVerified`    | `boolean`                | No       | Bypass email verification requirement. Default: false.                                          |
| `isPhoneVerified`    | `boolean`                | No       | Bypass phone verification requirement. Default: false.                                          |
| `mustChangePassword` | `boolean`                | No       | Force password change on first login. Default: false.                                           |
| `generatePassword`   | `boolean`                | No       | Auto-generate secure password. Generated password returned in response. Default: false.         |

## AdminSignupResponseDTO (Response)

| Property           | Type              | Description                                                      |
| ------------------ | ----------------- | ---------------------------------------------------------------- |
| `user`             | `UserResponseDto` | Created user object (sanitized, excludes sensitive fields).      |
| `generatedPassword` | `string \| undefined` | Generated password (only present if `generatePassword` was true). |

## Example

**Request:**

```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "username": "johndoe",
  "firstName": "John",
  "lastName": "Doe",
  "isEmailVerified": true,
  "mustChangePassword": false
}
```

**Response:**

```json
{
  "user": {
    "sub": "a21b654c-2746-4168-acee-c175083a65cd",
    "email": "user@example.com",
    "username": "johndoe",
    "firstName": "John",
    "lastName": "Doe",
    "isEmailVerified": true,
    "isPhoneVerified": false
  },
  "generatedPassword": null
}
```

**Response (with generated password):**

```json
{
  "user": {
    "sub": "a21b654c-2746-4168-acee-c175083a65cd",
    "email": "user@example.com",
    "username": "johndoe",
    "firstName": "John",
    "lastName": "Doe",
    "isEmailVerified": true,
    "isPhoneVerified": false
  },
  "generatedPassword": "Xk9#mP2$qR7@vN4w"
}
```

## Used By

- [AuthService.adminSignup()](../services/auth-service#adminsignup)

