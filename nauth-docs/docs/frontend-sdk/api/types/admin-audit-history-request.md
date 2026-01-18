---
title: AdminAuditHistoryRequest
description: Request payload for querying admin audit history with filters and pagination
keywords: [admin, audit, history, request, api]
image: /img/api-social-card.png
---

# AdminAuditHistoryRequest

**Package:** `@nauth-toolkit/client`
**Type:** Request

Request payload for getting user authentication history (admin-only). Supports filtering by event type and status with pagination.

```typescript
import { AdminAuditHistoryRequest } from '@nauth-toolkit/client';
```

## Properties

| Property     | Type     | Required | Description                                                      |
| ------------ | -------- | -------- | ---------------------------------------------------------------- |
| `eventStatus`| `string` | No       | Filter by event status                                            |
| `eventType`  | `string` | No       | Filter by event type                                              |
| `limit`      | `number` | No       | Number of records per page                                        |
| `page`       | `number` | No       | Page number (1-indexed)                                          |
| `sub`        | `string` | Yes      | User's unique identifier (UUID v4). Required for admin operations. |

## Example

```json
{
  "sub": "a21b654c-2746-4168-acee-c175083a65cd",
  "page": 1,
  "limit": 50,
  "eventType": "LOGIN_SUCCESS",
  "eventStatus": "SUCCESS"
}
```

**Filter by failed logins:**

```json
{
  "sub": "a21b654c-2746-4168-acee-c175083a65cd",
  "page": 1,
  "limit": 20,
  "eventType": "LOGIN_FAILED"
}
```

## Related Types

- [`AuditHistoryResponse`](./audit-history-response) - Paginated audit events response
- [`AuthAuditEvent`](./auth-audit-event) - Individual audit event structure
- [`AuthAuditEventType`](./auth-audit-event-type) - Event type enum
- [`AuthAuditEventStatus`](./auth-audit-event-status) - Event status type

## Used By

- [AdminOperations.getAuditHistory()](../admin-operations#getaudithistory) - Accepts [`AdminAuditHistoryRequest`](./admin-audit-history-request)
