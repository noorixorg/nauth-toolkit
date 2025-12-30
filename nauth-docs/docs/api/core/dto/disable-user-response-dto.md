---
title: DisableUserResponseDTO
description: Administrative account locking response with session count
sidebar_position: 8
keywords: [dto, admin, disable, lock, user, response]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# DisableUserResponseDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Response)

Response DTO for administrative account locking with revoked session count.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { DisableUserResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { DisableUserResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { DisableUserResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property          | Type                              | Description                                        |
| ----------------- | --------------------------------- | -------------------------------------------------- |
| `success`         | `boolean`                         | Lock success flag (always `true` if returned)     |
| `user`            | [`UserResponseDto`](./user-response-dto) | Sanitized user object with updated lock status     |
| `revokedSessions` | `number`                          | Number of sessions revoked (forced logout)         |

## Example

```json
{
  "success": true,
  "user": {
    "sub": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "username": "johndoe",
    "isEmailVerified": true,
    "isPhoneVerified": false,
    "isActive": true,
    "mfaEnabled": false,
    "hasSocialAuth": false,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-15T12:30:00.000Z"
  },
  "revokedSessions": 3
}
```

## Used By

- [AuthService.disableUser()](../services/auth-service#disableuser)

