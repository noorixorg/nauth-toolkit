---
title: GetUsersRequest
description: Request payload for querying users with filters, pagination, and sorting
keywords: [admin, users, query, request, api]
image: /img/api-social-card.png
---

# GetUsersRequest

**Package:** `@nauth-toolkit/client`
**Type:** Request

Request payload for querying users with filters, pagination, and sorting. Supports boolean filters, exact match filters, date filters with operators, and flexible sorting.

```typescript
import { GetUsersRequest } from '@nauth-toolkit/client';
```

## Properties

| Property         | Type                        | Required | Description                                                                 |
| ---------------- | --------------------------- | -------- | --------------------------------------------------------------------------- |
| `createdAt`      | [`DateFilter`](./date-filter) | No       | Filter by account creation date with operator support                        |
| `email`          | `string`                    | No       | Filter by email address (partial match)                                      |
| `hasSocialAuth`  | `boolean`                   | No       | Filter by social auth presence                                               |
| `isEmailVerified`| `boolean`                   | No       | Filter by email verification status                                          |
| `isLocked`       | `boolean`                   | No       | Filter by account lock status                                                 |
| `isPhoneVerified`| `boolean`                   | No       | Filter by phone verification status                                          |
| `limit`          | `number`                    | No       | Number of records per page. Default: `10`. Max: `100`.                      |
| `mfaEnabled`     | `boolean`                   | No       | Filter by MFA enabled status                                                 |
| `page`           | `number`                    | No       | Page number (1-indexed). Default: `1`.                                       |
| `phone`         | `string`                      | No       | Filter by phone number (partial match)                                      |
| `sortBy`         | `'createdAt' \| 'email' \| 'phone' \| 'updatedAt' \| 'username'` | No | Field to sort by. Default: `'createdAt'`. |
| `sortOrder`      | `'ASC' \| 'DESC'`           | No       | Sort order. Default: `'DESC'`.                                               |
| `updatedAt`      | [`DateFilter`](./date-filter) | No       | Filter by last update date with operator support                             |

## Example

```json
{
  "page": 1,
  "limit": 20,
  "isEmailVerified": true,
  "mfaEnabled": false,
  "sortBy": "createdAt",
  "sortOrder": "DESC"
}
```

**With date filter:**

```json
{
  "page": 1,
  "limit": 20,
  "isEmailVerified": true,
  "hasSocialAuth": true,
  "createdAt": {
    "operator": "gte",
    "value": "2024-01-01T00:00:00.000Z"
  },
  "sortBy": "email",
  "sortOrder": "ASC"
}
```

**With email filter:**

```json
{
  "page": 1,
  "limit": 50,
  "email": "@example.com",
  "isEmailVerified": true,
  "sortBy": "email",
  "sortOrder": "ASC"
}
```

## Related Types

- [`GetUsersResponse`](./get-users-response) - Paginated user list response
- [`DateFilter`](./date-filter) - Date filter with operator support
- [`AuthUser`](./auth-user) - User profile structure

## Used By

- [AdminOperations.getUsers()](../admin-operations#getusers) - Accepts [`GetUsersRequest`](./get-users-request)
