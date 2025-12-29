---
title: GetUserAuthHistoryResponseDTO
description: Response DTO for paginated user authentication history
sidebar_position: 35
keywords: [dto, response, audit, history, pagination, api]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# GetUserAuthHistoryResponseDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Response)

Response DTO containing paginated authentication history for a user.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { GetUserAuthHistoryResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { GetUserAuthHistoryResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { GetUserAuthHistoryResponseDTO } from '@nauth-toolkit/core';
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
| `totalPages` | `number`        | Yes      | Total number of pages (`Math.ceil(total / limit)`) |

## Example

```json
{
  "data": [
    {
      "id": 1,
      "userId": 123,
      "eventType": "LOGIN_SUCCESS",
      "eventStatus": "SUCCESS",
      "createdAt": "2025-01-15T10:30:00.000Z",
      "ipAddress": "192.168.1.1"
    }
  ],
  "total": 150,
  "page": 1,
  "limit": 50,
  "totalPages": 3
}
```

## Used By

- [AuthAuditService.getUserAuthHistory()](../services/auth-audit-service#getuserauthhistory)

