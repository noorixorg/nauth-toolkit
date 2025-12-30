---
title: GetUserAuthHistoryDTO
description: Request DTO for getting paginated user authentication history with filtering options
sidebar_position: 880
keywords: [dto, request, audit, history, authentication, api]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# GetUserAuthHistoryDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)

Request DTO for getting paginated authentication history for a user with optional filtering by event types, status, and date ranges.

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
| `userSub`     | `string`                  | Yes      | External user identifier (UUID v4). Trimmed and lowercased.       |
| `page`        | `number`                  | No       | Page number (1-indexed). Default: 1                              |
| `limit`       | `number`                  | No       | Number of records per page. Default: 50. Max: 500.               |
| `startDate`   | `Date`                    | No       | Filter events from this date onwards                             |
| `endDate`     | `Date`                    | No       | Filter events up to this date                                    |
| `eventTypes`  | [`AuthAuditEventType[]`](../enums/auth-audit-event-type)    | No       | Filter by specific event types                                   |
| `eventStatus` | [`AuthAuditEventStatus[]`](../enums/auth-audit-event-status)  | No       | Filter by event status. Allowed: `SUCCESS`, `FAILURE`, `INFO`, `SUSPICIOUS`. |

## Example

```json
{
  "userSub": "550e8400-e29b-41d4-a716-446655440000",
  "page": 1,
  "limit": 50,
  "eventTypes": ["LOGIN_SUCCESS", "LOGIN_FAILED"],
  "startDate": "2025-01-01T00:00:00.000Z"
}
```

## Used By

- [AuthAuditService.getUserAuthHistory()](../services/auth-audit-service#getuserauthhistory)

## Related APIs

- [AuthAuditEventType](../enums/auth-audit-event-type) - Complete list of event types
- [AuthAuditEventStatus](../enums/auth-audit-event-status) - Event status values

