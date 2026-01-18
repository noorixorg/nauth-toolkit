---
title: GetUsersResponse
description: Response payload containing paginated user list with metadata
keywords: [admin, users, response, pagination, api]
image: /img/api-social-card.png
---

# GetUsersResponse

**Package:** `@nauth-toolkit/client`
**Type:** Response

Response payload containing paginated user list. Uses [`AuthUser`](./auth-user) type - admin endpoints return the same sanitized user object as user endpoints.

```typescript
import { GetUsersResponse } from '@nauth-toolkit/client';
```

## Properties

| Property         | Type      | Description                                                      |
| ---------------- | --------- | ---------------------------------------------------------------- |
| `pagination`     | `object`  | Pagination metadata                                              |
| `pagination.limit` | `number` | Number of records per page                                       |
| `pagination.page` | `number` | Current page number (1-indexed)                                 |
| `pagination.total` | `number` | Total number of records matching the query                      |
| `pagination.totalPages` | `number` | Total number of pages                                           |
| `users`          | [`AuthUser`](./auth-user)[] | Array of sanitized user objects (same structure as [`AuthUser`](./auth-user)) |

## Example

```json
{
  "users": [
    {
      "id": 123,
      "sub": "a21b654c-2746-4168-acee-c175083a65cd",
      "email": "user1@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "isEmailVerified": true,
      "isPhoneVerified": false,
      "isActive": true,
      "isLocked": false,
      "mfaEnabled": false,
      "hasPasswordHash": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-15T12:00:00.000Z"
    },
    {
      "id": 124,
      "sub": "b32c765d-3857-5279-bdff-d286194b76de",
      "email": "user2@example.com",
      "firstName": "Jane",
      "lastName": "Smith",
      "isEmailVerified": true,
      "isPhoneVerified": true,
      "isActive": true,
      "isLocked": false,
      "mfaEnabled": true,
      "hasPasswordHash": true,
      "createdAt": "2024-01-02T00:00:00.000Z",
      "updatedAt": "2024-01-16T12:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3
  }
}
```

## Related Types

- [`GetUsersRequest`](./get-users-request) - Request payload with filters and pagination
- [`AuthUser`](./auth-user) - User profile structure

## Used By

- [AdminOperations.getUsers()](../admin-operations#getusers) - Returns [`GetUsersResponse`](./get-users-response)
