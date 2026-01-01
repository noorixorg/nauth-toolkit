---
title: AuthResponseUser
description: User information interface for authentication responses. Minimal user object with essential fields only.
keywords: [interface, user, auth, response, api]
image: /img/api-social-card.png
sidebar_position: 6
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# AuthResponseUser

**Package:** `@nauth-toolkit/core`
**Type:** Interface

User information interface returned in authentication responses. Contains only essential fields needed for client applications, excluding sensitive and internal data.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { AuthResponseUser } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { AuthResponseUser } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { AuthResponseUser } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property          | Type             | Required | Description                                                                     |
| ----------------- | ---------------- | -------- | ------------------------------------------------------------------------------- |
| `sub`             | `string`         | Yes      | User identifier (UUID v4). External identifier safe to expose.                  |
| `email`           | `string`         | Yes      | User's email address.                                                           |
| `firstName`       | `string \| null` | No       | User's first name.                                                              |
| `lastName`        | `string \| null` | No       | User's last name.                                                               |
| `phone`           | `string`         | No       | Phone number in E.164 format.                                                   |
| `isEmailVerified` | `boolean`        | Yes      | Email verification status.                                                      |
| `isPhoneVerified` | `boolean`        | No       | Phone verification status.                                                      |
| `socialProviders` | `string[]`       | No       | Array of linked social providers (e.g., `['google', 'apple']`).                 |
| `hasPasswordHash` | `boolean`        | No       | Whether user has a password set. Used to determine authentication capabilities. |

## Used By

- [AuthResponseDTO](../dto/auth-response-dto#user) - User property type
- [toAuthResponseUser()](../dto/auth-response-dto#toauthresponseuser) - Conversion utility function

## Related APIs

- [IUser](./user) - Full user entity interface
- [UserResponseDto](../dto/user-response-dto) - Complete user response DTO
