---
title: GetUsersResponseDTO
description: Paginated user listing response with metadata
keywords: [dto, admin, list, users, response, pagination]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# GetUsersResponseDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Response)

Response DTO for paginated user listing with pagination metadata.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { GetUsersResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { GetUsersResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { GetUsersResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property                | Type                               | Description                                        |
| ----------------------- | ---------------------------------- | -------------------------------------------------- |
| `users`                 | [`UserResponseDto[]`](./user-response-dto) | Array of sanitized user objects                    |
| `pagination`            | `object`                           | Pagination metadata                                |
| `pagination.page`       | `number`                           | Current page number (1-indexed)                    |
| `pagination.limit`      | `number`                           | Records per page                                   |
| `pagination.total`      | `number`                           | Total number of matching records                   |
| `pagination.totalPages` | `number`                           | Total number of pages                              |

## Example

```json
{
  "users": [
    {
      "sub": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "username": "johndoe",
      "isEmailVerified": true,
      "isPhoneVerified": false,
      "isActive": true,
      "mfaEnabled": false,
      "hasSocialAuth": true,
      "socialProviders": ["google", "apple"],
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-15T12:30:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

## Used By

- [AuthService.getUsers()](../services/auth-service#getusers)

