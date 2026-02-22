---
title: AdminUpdateUserAttributesDTO
description: Admin-only DTO for updating a target user's profile information.
keywords: [admin, user, update, attributes, profile, dto, request, response, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# AdminUpdateUserAttributesDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request/Response)

Data transfer objects for admin-initiated user profile updates. Extends `UserUpdateDTO` with required `sub` field.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { AdminUpdateUserAttributesDTO, UserResponseDto } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { AdminUpdateUserAttributesDTO, UserResponseDto } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { AdminUpdateUserAttributesDTO, UserResponseDto } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## AdminUpdateUserAttributesDTO (Request)

| Property             | Type      | Required | Description                                                                                      |
| --------------------- | --------- | -------- | ------------------------------------------------------------------------------------------------ |
| `sub`                 | `string`  | Yes      | User sub (UUID v4). Trimmed, lowercased for consistency.                                        |
| `username`            | `string`  | No       | Username. 3-255 characters. Alphanumeric, underscores, and hyphens only.                        |
| `firstName`           | `string`  | No       | First name. 1-100 characters. Trimmed.                                                           |
| `lastName`            | `string`  | No       | Last name. 1-100 characters. Trimmed.                                                            |
| `email`               | `string`  | No       | Email address. Valid email format.                                                               |
| `phone`               | `string`  | No       | Phone number. E.164 format.                                                                      |
| `metadata`            | `object`  | No       | Custom metadata. Merged with existing metadata. Set key to `null` to delete.                     |
| `preferredMfaMethod`  | `string`  | No       | Preferred MFA method. One of: `totp`, `sms`, `email`, `passkey`.                                 |
| `retainVerification`  | `boolean` | No       | Whether to retain email/phone verification status when updating email/phone. Default: false.      |

## UserResponseDto (Response)

Returns the updated user object. See [UserResponseDto](./user-response-dto) for full structure.

## Example

```json
{
  "sub": "a21b654c-2746-4168-acee-c175083a65cd",
  "username": "newusername",
  "firstName": "John",
  "lastName": "Doe",
  "metadata": {
    "department": "Engineering",
    "role": "Senior Developer"
  }
}
```

## Used By

- [AdminAuthService.updateUserAttributes()](../services/admin-auth-service#updateuserattributes)
