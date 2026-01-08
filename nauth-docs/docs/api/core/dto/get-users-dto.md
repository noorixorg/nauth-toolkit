---
title: GetUsersDTO
description: Paginated user listing request with advanced filtering and sorting
keywords: [dto, admin, list, users, pagination, filter]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# GetUsersDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)

Input DTO for paginated user listing with advanced filtering and sorting.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { GetUsersDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { GetUsersDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { GetUsersDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property           | Type                                         | Required | Description with validation inline                                                                       |
| ------------------ | -------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------- |
| `page`             | `number`                                     | No       | Page number (1-indexed). Default: 1. Min: 1.                                                             |
| `limit`            | `number`                                     | No       | Records per page. Default: 10. Min: 1, Max: 100.                                                         |
| `email`            | `string`                                     | No       | Filter by email address (partial match). Example: "john" matches "john@example.com", "johnny@test.com". |
| `phone`            | `string`                                     | No       | Filter by phone number (partial match). Example: "+1" matches "+14155552671", "+12025551234".             |
| `isEmailVerified`  | `boolean`                                    | No       | Filter by email verification status.                                                                     |
| `isPhoneVerified`  | `boolean`                                    | No       | Filter by phone verification status.                                                                     |
| `hasSocialAuth`    | `boolean`                                    | No       | Filter by social auth presence.                                                                          |
| `isLocked`         | `boolean`                                    | No       | Filter by account lock status.                                                                           |
| `mfaEnabled`       | `boolean`                                    | No       | Filter by MFA enabled status.                                                                            |
| `createdAt`        | `DateFilterDTO`                              | No       | Filter by creation date with operator (`gt`, `gte`, `lt`, `lte`, `eq`).                                 |
| `updatedAt`        | `DateFilterDTO`                              | No       | Filter by update date with operator (`gt`, `gte`, `lt`, `lte`, `eq`).                                   |
| `sortBy`           | `'email' \| 'createdAt' \| 'updatedAt' \| 'username' \| 'phone'` | No       | Field to sort by. Default: `createdAt`.                                                                  |
| `sortOrder`        | `'ASC' \| 'DESC'`                            | No       | Sort order. Default: `DESC`.                                                                             |

## DateFilterDTO

| Property   | Type                                        | Required | Description                                                                     |
| ---------- | ------------------------------------------- | -------- | ------------------------------------------------------------------------------- |
| `operator` | `'gt' \| 'gte' \| 'lt' \| 'lte' \| 'eq'`    | Yes      | Comparison operator for date filtering.                                         |
| `value`    | `Date`                                      | Yes      | Date value to compare against.                                                  |

## Example

```json
{
  "page": 1,
  "limit": 20,
  "email": "john",
  "isEmailVerified": true,
  "hasSocialAuth": true,
  "createdAt": {
    "operator": "gte",
    "value": "2024-01-01T00:00:00.000Z"
  },
  "sortBy": "createdAt",
  "sortOrder": "DESC"
}
```

## Used By

- [AuthService.getUsers()](../services/auth-service#getusers)

