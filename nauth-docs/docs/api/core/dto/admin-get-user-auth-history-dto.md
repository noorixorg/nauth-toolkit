---
title: AdminGetUserAuthHistoryDTO
description: Request DTO for getting paginated user authentication history (admin-only) with filtering options
keywords: [dto, request, audit, history, authentication, api, admin]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# AdminGetUserAuthHistoryDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)
**Context:** Admin Only

Request DTO for getting paginated authentication history for any user (admin operation) with optional filtering by event types, status, and date ranges.

:::warning[Admin Only]
This DTO requires the `sub` field to specify the target user. It extends [`GetUserAuthHistoryDTO`](./get-user-auth-history-dto) and adds the `sub` field. For user self-service operations, use [`GetUserAuthHistoryDTO`](./get-user-auth-history-dto) instead.
:::

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { AdminGetUserAuthHistoryDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { AdminGetUserAuthHistoryDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { AdminGetUserAuthHistoryDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

This DTO extends [`GetUserAuthHistoryDTO`](./get-user-auth-history-dto) and adds the following required field:

| Property      | Type                      | Required | Description                                                      |
| ------------- | ------------------------- | -------- | ----------------------------------------------------------------- |
| `sub`         | `string`                  | Yes      | User's unique identifier (UUID v4). Trimmed and lowercased.       |
| `page`        | `number`                  | No       | Page number (1-indexed). Default: 1                              |
| `limit`       | `number`                  | No       | Number of records per page. Default: 50. Max: 500.               |
| `startDate`   | `Date`                    | No       | Filter events from this date onwards                             |
| `endDate`     | `Date`                    | No       | Filter events up to this date                                    |
| `eventTypes`  | [`AuthAuditEventType[]`](../enums/auth-audit-event-type)    | No       | Filter by specific event types                                   |
| `eventStatus` | [`AuthAuditEventStatus[]`](../enums/auth-audit-event-status)  | No       | Filter by event status. Allowed: `SUCCESS`, `FAILURE`, `INFO`, `SUSPICIOUS`. |

## Example

```json
{
  "sub": "550e8400-e29b-41d4-a716-446655440000",
  "page": 1,
  "limit": 50,
  "eventTypes": ["LOGIN_SUCCESS", "LOGIN_FAILED"],
  "startDate": "2025-01-01T00:00:00.000Z"
}
```

## Used By

- [AdminAuthService](../services/admin-auth-service) - Admin operation

## Related DTOs

- [GetUserAuthHistoryDTO](./get-user-auth-history-dto) - User self-service version (no `sub` field)
- [GetUserAuthHistoryResponseDTO](./get-user-auth-history-response-dto) - Response DTO

## Related APIs

- [AuthAuditEventType](../enums/auth-audit-event-type) - Complete list of event types
- [AuthAuditEventStatus](../enums/auth-audit-event-status) - Event status values
