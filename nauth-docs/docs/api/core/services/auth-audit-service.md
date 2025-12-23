---
title: AuthAuditService
description: Authentication audit logging and querying service
keywords: [service, audit, logging, security, api]
image: /img/api-social-card.png
sidebar_position: 1
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# AuthAuditService

**Package:** `@nauth-toolkit/core`
**Type:** Service

Logs and queries authentication events for security monitoring.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { AuthAuditService } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { AuthAuditService } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { AuthAuditService } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Overview

Query authentication audit events for security monitoring. Event recording is handled internally by the framework.

:::note
Only query methods are available. Event recording is internal.
:::

## Methods

### getEventsByType()

Get events by type with pagination.

```typescript
async getEventsByType(dto: GetEventsByTypeDTO): Promise<GetEventsByTypeResponseDTO>
```

**Parameters**

- `dto` - [`GetEventsByTypeDTO`](../dto/get-events-by-type-dto)

**Returns**

- [`GetEventsByTypeResponseDTO`](../dto/get-events-by-type-response-dto) - Paginated audit events

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
const result = await this.auditService.getEventsByType({
  eventType: AuthAuditEventType.SUSPICIOUS_ACTIVITY,
  page: 1,
  limit: 100,
});
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
const result = await nauth.authAuditService.getEventsByType({
  eventType: AuthAuditEventType.SUSPICIOUS_ACTIVITY,
  page: 1,
  limit: 100,
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
const result = await nauth.authAuditService.getEventsByType({
  eventType: AuthAuditEventType.SUSPICIOUS_ACTIVITY,
  page: 1,
  limit: 100,
});
```

</TabItem>
</Tabs>

---

### getRiskAssessmentHistory()

Get risk assessment history for adaptive MFA analysis.

```typescript
async getRiskAssessmentHistory(dto: GetRiskAssessmentHistoryDTO): Promise<GetRiskAssessmentHistoryResponseDTO>
```

**Parameters**

- `dto` - [`GetRiskAssessmentHistoryDTO`](../dto/get-risk-assessment-history-dto)

**Returns**

- [`GetRiskAssessmentHistoryResponseDTO`](../dto/get-risk-assessment-history-response-dto) - Array of risk assessment audit events

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
const result = await this.auditService.getRiskAssessmentHistory({
  userSub: 'user-uuid',
  limit: 50,
});
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
const result = await nauth.authAuditService.getRiskAssessmentHistory({
  userSub: 'user-uuid',
  limit: 50,
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
const result = await nauth.authAuditService.getRiskAssessmentHistory({
  userSub: 'user-uuid',
  limit: 50,
});
```

</TabItem>
</Tabs>

---

### getSuspiciousActivity()

Get suspicious activity events.

```typescript
async getSuspiciousActivity(dto: GetSuspiciousActivityDTO): Promise<GetSuspiciousActivityResponseDTO>
```

**Parameters**

- `dto` - [`GetSuspiciousActivityDTO`](../dto/get-suspicious-activity-dto)

**Returns**

- [`GetSuspiciousActivityResponseDTO`](../dto/get-suspicious-activity-response-dto) - Array of suspicious audit events

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
// All suspicious activity
const result = await this.auditService.getSuspiciousActivity({});

// For specific user
const result = await this.auditService.getSuspiciousActivity({
  userSub: 'user-uuid',
  limit: 50,
});
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
const result = await nauth.authAuditService.getSuspiciousActivity({
  userSub: 'user-uuid',
  limit: 50,
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
const result = await nauth.authAuditService.getSuspiciousActivity({
  userSub: 'user-uuid',
  limit: 50,
});
```

</TabItem>
</Tabs>

---

### getUserAuthHistory()

Get paginated authentication history for a user.

```typescript
async getUserAuthHistory(dto: GetUserAuthHistoryDTO): Promise<GetUserAuthHistoryResponseDTO>
```

**Parameters**

- `dto` - [`GetUserAuthHistoryDTO`](../dto/get-user-auth-history-dto)

**Errors**

| Code        | When           | Details               |
| ----------- | -------------- | --------------------- |
| `NOT_FOUND` | User not found | `{ userId?: string }` |

**Returns**

- [`GetUserAuthHistoryResponseDTO`](../dto/get-user-auth-history-response-dto) - Paginated audit events

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@Injectable()
export class MyService {
  constructor(private auditService: AuthAuditService) {}

  async example() {
    const result = await this.auditService.getUserAuthHistory({
      userSub: 'user-uuid',
      page: 1,
      limit: 50,
      eventTypes: [AuthAuditEventType.LOGIN_SUCCESS],
    });
    // result.data - IAuthAudit[]
    // result.total - number
    // result.page - number
    // result.limit - number
    // result.totalPages - number
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
app.get('/user/history', async (req, res) => {
  const result = await nauth.authAuditService.getUserAuthHistory({
    userSub: req.user.sub,
    page: 1,
    limit: 50,
  });
  res.json(result);
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.get('/user/history', { preHandler: nauth.helpers.requireAuth() },
  nauth.adapter.wrapRouteHandler(async () => {
    const user = nauth.helpers.getCurrentUser();
    return nauth.authAuditService.getUserAuthHistory({
      userSub: user.sub,
      page: 1,
      limit: 50,
    });
  }));
```

</TabItem>
</Tabs>

---


## Related

- [GetUserAuthHistoryDTO](../dto/get-user-auth-history-dto)
- [GetEventsByTypeDTO](../dto/get-events-by-type-dto)
- [GetSuspiciousActivityDTO](../dto/get-suspicious-activity-dto)
- [GetRiskAssessmentHistoryDTO](../dto/get-risk-assessment-history-dto)
- [AuthAuditEventType](../enums/auth-audit-event-type) - Complete list of event types
- [AuthAuditEventStatus](../enums/auth-audit-event-status) - Event status values
