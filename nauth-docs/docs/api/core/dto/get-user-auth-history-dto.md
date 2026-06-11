---
title: GetUserAuthHistoryDTO
description: Request DTO for getting paginated user authentication history (user self-service) with filtering options
keywords: [dto, request, audit, history, authentication, api, user, self-service]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# GetUserAuthHistoryDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)
**Context:** User Self-Service

Request DTO for getting paginated authentication history for the current authenticated user with optional filtering by event types, status, and date ranges.

:::note User Self-Service
This DTO is for user self-service operations. The `sub` is automatically derived from the authenticated user's context. For admin operations, use [`AdminGetUserAuthHistoryDTO`](./admin-get-user-auth-history-dto) instead.
:::

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { GetUserAuthHistoryDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { GetUserAuthHistoryDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { GetUserAuthHistoryDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property      | Type                      | Required | Description                                                      |
| ------------- | ------------------------- | -------- | ----------------------------------------------------------------- |
| `page`        | `number`                  | No       | Page number (1-indexed). Default: 1                              |
| `limit`       | `number`                  | No       | Number of records per page. Default: 50. Max: 500.               |
| `startDate`   | `Date`                    | No       | Filter events from this date onwards                             |
| `endDate`     | `Date`                    | No       | Filter events up to this date                                    |
| `eventTypes`  | [`AuthAuditEventType[]`](../enums/auth-audit-event-type)    | No       | Filter by specific event types                                   |
| `eventStatus` | [`AuthAuditEventStatus[]`](../enums/auth-audit-event-status)  | No       | Filter by event status. Allowed: `SUCCESS`, `FAILURE`, `INFO`, `SUSPICIOUS`. |

:::note
The `sub` field is not included in this DTO. It is automatically derived from the authenticated user's context when using [`AuthService.getUserAuthHistory()`](../services/auth-service#getuserauthhistory).
:::

## Example

```json
{
  "page": 1,
  "limit": 50,
  "eventTypes": ["LOGIN_SUCCESS", "LOGIN_FAILED"],
  "startDate": "2025-01-01T00:00:00.000Z"
}
```

## Used By

- [AuthService.getUserAuthHistory()](../services/auth-service#getuserauthhistory) - User self-service method

## Related DTOs

- [AdminGetUserAuthHistoryDTO](./admin-get-user-auth-history-dto) - Admin version with `sub` field

## Related APIs

- [AuthAuditEventType](../enums/auth-audit-event-type) - Complete list of event types
- [AuthAuditEventStatus](../enums/auth-audit-event-status) - Event status values

