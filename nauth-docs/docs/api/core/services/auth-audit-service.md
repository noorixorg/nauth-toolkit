---
title: AuthAuditService
description: Query authentication and security audit events for monitoring and investigation.
keywords: [service, audit, logging, security, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# AuthAuditService

**Package:** `@nauth-toolkit/core`
**Type:** Service

Query authentication and security audit events for monitoring and investigation.

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

Use this service to query the authentication audit trail (login attempts, MFA events, suspicious activity, and risk-assessment markers).
Audit **event recording is internal**.

## Methods

### getEventsByType()

Get events by type with pagination.

```typescript
async getEventsByType(dto: GetEventsByTypeDTO): Promise<GetEventsByTypeResponseDTO>
```

**Parameters**

- `dto` - [`GetEventsByTypeDTO`](../dto/get-events-by-type-dto)

**Errors**

None.

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
  startDate: new Date('2026-01-01'),
});
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
const result = await nauth.authAuditService.getEventsByType({
  eventType: AuthAuditEventType.SUSPICIOUS_ACTIVITY,
  page: 1,
  limit: 100,
  startDate: new Date('2026-01-01'),
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
const result = await nauth.authAuditService.getEventsByType({
  eventType: AuthAuditEventType.SUSPICIOUS_ACTIVITY,
  page: 1,
  limit: 100,
  startDate: new Date('2026-01-01'),
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

**Errors**

Throws [`NAuthException`](../exceptions/nauth-exception) with code:

| Code        | When           | Details     |
| ----------- | -------------- | ----------- |
| `NOT_FOUND` | User not found | `undefined` |

**Returns**

- [`GetRiskAssessmentHistoryResponseDTO`](../dto/get-risk-assessment-history-response-dto) - Array of risk assessment audit events

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
const result = await this.auditService.getRiskAssessmentHistory({
  sub: 'user-uuid',
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

**Errors**

Throws [`NAuthException`](../exceptions/nauth-exception) with code:

| Code        | When           | Details     |
| ----------- | -------------- | ----------- |
| `NOT_FOUND` | User not found | `undefined` |

**Returns**

- [`GetSuspiciousActivityResponseDTO`](../dto/get-suspicious-activity-response-dto) - Array of suspicious audit events

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
const result = await this.auditService.getSuspiciousActivity({
  sub: 'user-uuid',
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

Get paginated authentication history for a user (admin operation).

```typescript
async getUserAuthHistory(dto: AdminGetUserAuthHistoryDTO): Promise<GetUserAuthHistoryResponseDTO>
```

**Parameters**

- `dto` - [`AdminGetUserAuthHistoryDTO`](../dto/admin-get-user-auth-history-dto) - Admin DTO with required `sub` field

**Errors**

Throws [`NAuthException`](../exceptions/nauth-exception) with code:

| Code        | When           | Details     |
| ----------- | -------------- | ----------- |
| `NOT_FOUND` | User not found | `undefined` |

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
      sub: 'user-uuid', // Required: target user's sub
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
    sub: req.user.sub,
    page: 1,
    limit: 50,
  });
  res.json(result);
});
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
fastify.get(
  '/user/history',
  { preHandler: nauth.helpers.requireAuth() },
  nauth.adapter.wrapRouteHandler(async () => {
    const user = nauth.helpers.getCurrentUser();
    return nauth.authAuditService.getUserAuthHistory({
      sub: user.sub,
      page: 1,
      limit: 50,
    });
  }),
);
```

</TabItem>
</Tabs>

---

## Related APIs

- [AdminGetUserAuthHistoryDTO](../dto/admin-get-user-auth-history-dto) - Admin DTO for getUserAuthHistory
- [GetUserAuthHistoryDTO](../dto/get-user-auth-history-dto) - User self-service DTO (used by AuthService)
- [GetEventsByTypeDTO](../dto/get-events-by-type-dto)
- [GetSuspiciousActivityDTO](../dto/get-suspicious-activity-dto)
- [GetRiskAssessmentHistoryDTO](../dto/get-risk-assessment-history-dto)
- [AuthAuditEventType](../enums/auth-audit-event-type) - Complete list of event types
- [AuthAuditEventStatus](../enums/auth-audit-event-status) - Event status values
- [NAuthException](../exceptions/nauth-exception) - Error type thrown by services
