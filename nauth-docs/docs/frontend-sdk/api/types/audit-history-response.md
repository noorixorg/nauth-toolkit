---
title: AuditHistoryResponse
description: Paginated response containing authentication and security audit events
sidebar_position: 1
keywords: [audit, history, events, security, pagination, api]
image: /img/api-social-card.png
---

# AuditHistoryResponse

**Package:** `@nauth-toolkit/client`
**Type:** Interface

Paginated response containing authentication and security audit events.

```typescript
import { AuditHistoryResponse } from '@nauth-toolkit/client';
```

## Properties

| Property     | Type               | Required | Description                            |
| ------------ | ------------------ | -------- | -------------------------------------- |
| `data`       | `AuthAuditEvent[]` | Yes      | Array of audit event records           |
| `total`      | `number`           | Yes      | Total number of records matching query |
| `page`       | `number`           | Yes      | Current page number (1-indexed)        |
| `limit`      | `number`           | Yes      | Number of records per page             |
| `totalPages` | `number`           | Yes      | Total number of pages                  |

## Example

**Fetching Audit History:**

```typescript
const history = await client.getAuditHistory({
  page: 1,
  limit: 20,
  eventType: 'LOGIN_SUCCESS',
});

console.log(`Page ${history.page} of ${history.totalPages}`);
console.log(`Showing ${history.data.length} of ${history.total} events`);

history.data.forEach((event) => {
  console.log(`${event.eventType} - ${event.eventStatus}`);
  console.log(`IP: ${event.ipAddress}, Location: ${event.ipCity}, ${event.ipCountry}`);
  console.log(`Device: ${event.deviceType} - ${event.browser}`);
});
```

**Angular with Pagination:**

```typescript
this.authService
  .getClient()
  .getAuditHistory({
    page: this.currentPage,
    limit: 20,
  })
  .then((response) => {
    this.events = response.data;
    this.totalPages = response.totalPages;
    this.totalRecords = response.total;
  });
```

**Filtering by Event Type:**

```typescript
// Get all failed login attempts
const failedLogins = await client.getAuditHistory({
  eventType: 'LOGIN_FAILED',
  page: 1,
  limit: 50,
});

// Get suspicious activity
const suspicious = await client.getAuditHistory({
  eventStatus: 'SUSPICIOUS',
  page: 1,
  limit: 100,
});
```

## Related APIs

- [NAuthClient.getAuditHistory()](../nauth-client#getaudithistory) - Retrieve audit history
- [AuthAuditEvent](./auth-audit-event) - Individual audit event structure
- [AuthAuditEventType](./auth-audit-event-type) - Event type enum
- [AuthAuditEventStatus](./auth-audit-event-status) - Event status type
