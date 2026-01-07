---
title: AuthAuditEventStatus
description: Type representing audit event status values
sidebar_position: 20
keywords: [audit, status, event, security, api]
image: /img/api-social-card.png
---

# AuthAuditEventStatus

**Package:** `@nauth-toolkit/client`
**Type:** String Literal Union

Type representing the status of an audit event.

```typescript
import { AuthAuditEventStatus } from '@nauth-toolkit/client';

type AuthAuditEventStatus = 'SUCCESS' | 'FAILURE' | 'INFO' | 'SUSPICIOUS';
```

## Values

| Value        | Description                      | Use Case                                                   |
| ------------ | -------------------------------- | ---------------------------------------------------------- |
| `SUCCESS`    | Operation completed successfully | Login success, MFA verified, password changed              |
| `FAILURE`    | Operation failed                 | Failed login, invalid MFA code, verification expired       |
| `INFO`       | Informational event              | Token refresh, session created, settings updated           |
| `SUSPICIOUS` | Suspicious activity detected     | Multiple failed attempts, unusual location, risky behavior |

## Examples

**Filtering by Status:**

```typescript
// Get all failed events
const failures = await client.getAuditHistory({
  eventStatus: 'FAILURE',
  page: 1,
  limit: 50,
});

// Get all suspicious activity
const suspicious = await client.getAuditHistory({
  eventStatus: 'SUSPICIOUS',
  page: 1,
  limit: 100,
});
```

**Status Badge Component:**

```typescript
function getStatusBadgeClass(status: AuthAuditEventStatus): string {
  const classes: Record<AuthAuditEventStatus, string> = {
    SUCCESS: 'badge-success',
    FAILURE: 'badge-danger',
    INFO: 'badge-info',
    SUSPICIOUS: 'badge-warning',
  };

  return classes[status];
}

function getStatusIcon(status: AuthAuditEventStatus): string {
  const icons: Record<AuthAuditEventStatus, string> = {
    SUCCESS: 'fa-light fa-circle-check',
    FAILURE: 'fa-light fa-circle-xmark',
    INFO: 'fa-light fa-circle-info',
    SUSPICIOUS: 'fa-light fa-triangle-exclamation',
  };

  return icons[status];
}
```

**Angular Template:**

```html
<span [class]="'status-badge ' + getStatusClass(event.eventStatus)"> {{ event.eventStatus }} </span>
```

**TypeScript Type Guard:**

```typescript
function isSuspiciousEvent(event: AuthAuditEvent): boolean {
  return (
    event.eventStatus === 'SUSPICIOUS' || (event.eventStatus === 'FAILURE' && event.riskFactor && event.riskFactor > 70)
  );
}

// Alert on suspicious events
const history = await client.getAuditHistory({ page: 1, limit: 20 });
const suspiciousEvents = history.data.filter(isSuspiciousEvent);

if (suspiciousEvents.length > 0) {
  console.warn(`Found ${suspiciousEvents.length} suspicious events!`);
  suspiciousEvents.forEach((event) => {
    console.log(`${event.eventType} from ${event.ipAddress}`);
  });
}
```

## Related Types

- [`AuthAuditEvent`](./auth-audit-event) - Individual audit event with [`AuthAuditEventStatus`](./auth-audit-event-status) property
- [`AuthAuditEventType`](./auth-audit-event-type) - Event type enum
- [`AuditHistoryResponse`](./audit-history-response) - Paginated audit history

## Used By

- [AuthAuditEvent](./auth-audit-event) - `eventStatus` property uses [`AuthAuditEventStatus`](./auth-audit-event-status) type
- [NAuthClient.getAuditHistory()](../nauth-client#getaudithistory) - Filter parameter accepts [`AuthAuditEventStatus`](./auth-audit-event-status) values
