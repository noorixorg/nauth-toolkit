---
title: UserResponseDto
description: Sanitized user response DTO excluding sensitive fields. Used for all user retrieval operations with safe data exposure.
keywords: [user, response, dto, profile, api]
image: /img/api-social-card.png
sidebar_position: 24
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# UserResponseDto

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Response)

Sanitized user object for API responses. Excludes all sensitive and internal fields.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { UserResponseDto } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { UserResponseDto } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { UserResponseDto } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property            | Type                | Required | Description                                                      |
| ------------------ | ------------------- | -------- | ---------------------------------------------------------------- |
| `sub`               | `string`            | Yes      | User identifier (UUID v4).                                       |
| `email`              | `string`            | Yes      | Email address.                                                   |
| `username`           | `string \| null`     | No       | Username (optional).                                              |
| `firstName`          | `string \| null`     | No       | First name (optional).                                            |
| `lastName`           | `string \| null`     | No       | Last name (optional).                                             |
| `phone`              | `string \| null`     | No       | Phone number in E.164 format (optional).                         |
| `isEmailVerified`    | `boolean`           | Yes      | Email verification status.                                        |
| `isPhoneVerified`    | `boolean`           | Yes      | Phone verification status.                                        |
| `isActive`           | `boolean`           | Yes      | Account active status.                                            |
| `mfaEnabled`         | `boolean`           | Yes      | MFA enabled status.                                               |
| `socialProviders`    | `string[] \| null`   | No       | Linked social providers (optional).                              |
| `hasPasswordHash`    | `boolean`           | Yes      | Whether user has password set.                                   |
| `createdAt`          | `Date`              | Yes      | Account creation timestamp.                                       |
| `updatedAt`          | `Date`              | Yes      | Last account update timestamp.                                   |

## Example

```json
{
  "sub": "a21b654c-2746-4168-acee-c175083a65cd",
  "email": "user@example.com",
  "username": "johndoe",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+14155552671",
  "isEmailVerified": true,
  "isPhoneVerified": true,
  "isActive": true,
  "mfaEnabled": false,
  "socialProviders": ["google"],
  "hasPasswordHash": true,
  "createdAt": "2025-01-01T00:00:00.000Z",
  "updatedAt": "2025-01-15T12:00:00.000Z"
}
```

## Used By

- [AuthService.getUserById()](../services/auth-service#getuserbyid)
- [AuthService.getUserByEmail()](../services/auth-service#getuserbyemail)
- [AuthService.updateUserAttributes()](../services/auth-service#updateuserattributes)
