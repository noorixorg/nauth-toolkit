---
title: GetEventsByTypeDTO
description: Request DTO for getting paginated audit events filtered by event type with optional date range filtering
sidebar_position: 18
keywords: [dto, request, audit, events, filtering, api]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# GetEventsByTypeDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)

Request DTO for getting paginated audit events filtered by a specific event type with optional date range filtering.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { GetEventsByTypeDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { GetEventsByTypeDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { GetEventsByTypeDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property    | Type     | Required | Description                                 |
| ----------- | -------- | -------- | -------------------------------------------- |
| `eventType` | [`AuthAuditEventType`](../enums/auth-audit-event-type) | Yes | Event type to filter by (e.g., LOGIN_SUCCESS, SUSPICIOUS_ACTIVITY) |
| `page`      | `number` | No       | Page number (1-indexed). Default: 1          |
| `limit`     | `number` | No       | Number of records per page. Default: 50       |
| `startDate` | `Date`   | No       | Filter events from this date onwards         |
| `endDate`   | `Date`   | No       | Filter events up to this date                |

## Example

```json
{
  "eventType": "SUSPICIOUS_ACTIVITY",
  "page": 1,
  "limit": 100,
  "startDate": "2025-01-01T00:00:00.000Z"
}
```

## Used By

- [AuthAuditService.getEventsByType()](../services/auth-audit-service#geteventsbytype)

## Related

- [AuthAuditEventType](../enums/auth-audit-event-type) - Complete list of event types
