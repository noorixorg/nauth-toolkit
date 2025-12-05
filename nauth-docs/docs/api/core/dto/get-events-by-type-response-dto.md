---
title: GetEventsByTypeResponseDTO
description: Response DTO for paginated audit events by type
sidebar_position: 101
keywords: [dto, response, audit, events, pagination, api]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# GetEventsByTypeResponseDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Response)

Response DTO containing paginated audit events filtered by event type.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { GetEventsByTypeResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { GetEventsByTypeResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { GetEventsByTypeResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property     | Type            | Required | Description                          |
| ------------ | --------------- | -------- | ------------------------------------ |
| `data`       | `IAuthAudit[]`  | Yes      | Array of audit records               |
| `total`      | `number`        | Yes      | Total number of records matching query |
| `page`       | `number`        | Yes      | Current page number                  |
| `limit`      | `number`        | Yes      | Number of records per page           |
| `totalPages` | `number`        | Yes      | Total number of pages                |

## Example

```json
{
  "data": [
    {
      "id": 1,
      "userId": 123,
      "eventType": "SUSPICIOUS_ACTIVITY",
      "eventStatus": "SUSPICIOUS",
      "createdAt": "2025-01-15T10:30:00.000Z"
    }
  ],
  "total": 25,
  "page": 1,
  "limit": 50,
  "totalPages": 1
}
```

## Used By

- [AuthAuditService.getEventsByType()](../services/auth-audit-service#geteventsbytype)

