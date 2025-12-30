---
title: EnableUserResponseDTO
description: Administrative account unlocking response
sidebar_position: 190
keywords: [dto, admin, enable, unlock, user, response]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# EnableUserResponseDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Response)

Response DTO for administrative account unlocking with updated user status.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { EnableUserResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { EnableUserResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { EnableUserResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property | Type                              | Description                                    |
| -------- | --------------------------------- | ---------------------------------------------- |
| `success` | `boolean`                         | Unlock success flag (always `true` if returned) |
| `user`    | [`UserResponseDto`](./user-response-dto) | Sanitized user object with updated lock status |

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
    "isLocked": false,
    "mfaEnabled": false,
    "hasSocialAuth": false,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-15T12:30:00.000Z"
  }
}
```

## Used By

- [AuthService.enableUser()](../services/auth-service#enableuser)

