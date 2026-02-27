---
title: DateFilter
description: Date range filter with operator support for query parameters
keywords: [date, filter, query, api]
image: /img/api-social-card.png
---

# DateFilter

**Package:** `@nauth-toolkit/client`
**Type:** Request

Date filter with operator support for query parameters. Supports comparison operators for date-based filtering in user queries.

```typescript
import { DateFilter } from '@nauth-toolkit/client';
```

## Properties

| Property   | Type                        | Required | Description                                                      |
| ---------- | --------------------------- | -------- | ---------------------------------------------------------------- |
| `operator` | `'eq' \| 'gt' \| 'gte' \| 'lt' \| 'lte'` | Yes | Comparison operator: `eq` (equal), `gt` (greater than), `gte` (greater than or equal), `lt` (less than), `lte` (less than or equal) |
| `value`    | `Date \| string`            | Yes      | Date value to compare against (ISO 8601 string or Date object)  |

## Example

```json
{
  "operator": "gte",
  "value": "2024-01-01T00:00:00.000Z"
}
```

**In query context:**

```json
{
  "createdAt": {
    "operator": "gte",
    "value": "2024-01-01T00:00:00.000Z"
  },
  "updatedAt": {
    "operator": "lt",
    "value": "2024-12-31T23:59:59.999Z"
  }
}
```

## Related Types

- [`GetUsersRequest`](./get-users-request) - Uses [`DateFilter`](./date-filter) for date-based filtering

## Used By

- [`GetUsersRequest`](./get-users-request) - Uses [`DateFilter`](./date-filter) in `createdAt` and `updatedAt` properties
