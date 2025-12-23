---
title: GetSuspiciousActivityResponseDTO
description: Response DTO for suspicious activity audit events
sidebar_position: 32
keywords: [dto, response, audit, suspicious, security, api]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# GetSuspiciousActivityResponseDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Response)

Response DTO containing suspicious activity audit events.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { GetSuspiciousActivityResponseDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { GetSuspiciousActivityResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { GetSuspiciousActivityResponseDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property | Type           | Required | Description                    |
| -------- | -------------- | -------- | ------------------------------ |
| `data`   | `IAuthAudit[]` | Yes      | Array of suspicious audit events |

## Example

```json
{
  "data": [
    {
      "id": 1,
      "userId": 123,
      "eventType": "SUSPICIOUS_ACTIVITY",
      "eventStatus": "SUSPICIOUS",
      "createdAt": "2025-01-15T10:30:00.000Z",
      "ipAddress": "192.168.1.1",
      "reason": "Multiple failed login attempts"
    }
  ]
}
```

## Used By

- [AuthAuditService.getSuspiciousActivity()](../services/auth-audit-service#getsuspiciousactivity)

