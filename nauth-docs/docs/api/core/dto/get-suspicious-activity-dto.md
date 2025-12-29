---
title: GetSuspiciousActivityDTO
description: Request DTO for getting suspicious authentication activity events with optional user filtering
sidebar_position: 31
keywords: [dto, request, audit, suspicious, security, api]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# GetSuspiciousActivityDTO

**Package:** `@nauth-toolkit/core`
**Type:** DTO (Request)

Request DTO for getting suspicious authentication activity events. Returns events with SUSPICIOUS status or SUSPICIOUS_ACTIVITY event type.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { GetSuspiciousActivityDTO } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { GetSuspiciousActivityDTO } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { GetSuspiciousActivityDTO } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

| Property | Type     | Required | Description                                                      |
| -------- | -------- | -------- | ----------------------------------------------------------------- |
| `userSub` | `string` | No       | Optional user identifier (UUID v4). Trimmed and lowercased. If not provided, returns suspicious activity for all users |
| `limit`  | `number` | No       | Maximum number of records to return. Default: 100. Max: 500       |

## Example

```json
{
  "userSub": "550e8400-e29b-41d4-a716-446655440000",
  "limit": 50
}
```

## Used By

- [AuthAuditService.getSuspiciousActivity()](../services/auth-audit-service#getsuspiciousactivity)

