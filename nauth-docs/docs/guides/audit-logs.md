---
title: 'Audit Logs'
description: 'Configure audit logging, query user history, and display login activity in your frontend'
sidebar_position: 11
keywords: [audit, logs, security, history, login activity, monitoring, admin]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Audit Logs

Query and display authentication audit history in your app. Audit logging is enabled by default --- this guide shows how to configure it, query events from the backend, and display login activity in your frontend.

:::tip Sample apps
The code in this guide is taken directly from the example apps. If you get stuck, clone and run them:

- [`Github Samples & Community`](https://github.com/noorixorg/nauth)
:::

## Prerequisites

- A working auth setup ([Quick Start](/docs/quick-start/nestjs))
- Audit logging enabled (default --- no configuration needed)

## Step 1: Configure

Audit logging is enabled by default. No configuration is required for most setups:

```typescript title="config/auth.config.ts"
{
  auditLogs: {
    enabled: true,        // default
  },
}
```

For high-throughput environments, enable fire-and-forget mode to avoid awaiting audit writes on the request path:

```typescript title="config/auth.config.ts"
{
  auditLogs: {
    enabled: true,
    fireAndForget: true,  // Don't await audit writes
  },
}
```

| Option | Type | Default | Description |
|---|---|---|---|
| `enabled` | `boolean` | `true` | Enable/disable audit logging |
| `fireAndForget` | `boolean` | `false` | Don't await audit writes on request path |

:::warning Disabling Audit Logs
Disabling audit logs reduces security observability. Keep audit logging enabled in production systems.
:::

## Step 2: Query Audit History (Backend)

Inject `AuthAuditService` to query audit records from your backend code:

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript title="src/audit/audit.controller.ts"
import { Controller, Get, Query } from '@nestjs/common';
import { AuthAuditService } from '@nauth-toolkit/nestjs';
import { AuthAuditEventType } from '@nauth-toolkit/core';

@Controller('admin/audit')
export class AuditController {
  constructor(private readonly auditService: AuthAuditService) {}

  @Get('user-history')
  async getUserHistory(
    @Query('sub') sub: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    return this.auditService.getUserAuthHistory({
      sub,
      page,
      limit,
    });
  }

  @Get('suspicious')
  async getSuspicious() {
    return this.auditService.getSuspiciousActivity({
      limit: 100,
    });
  }

  @Get('by-type')
  async getByType(
    @Query('eventType') eventType: AuthAuditEventType,
    @Query('page') page = 1,
  ) {
    return this.auditService.getEventsByType({
      eventType,
      page,
      limit: 50,
    });
  }
}
```

</TabItem>
<TabItem value="express" label="Express / Fastify">

```typescript title="src/routes/audit.ts"
import { AuthAuditService, AuthAuditEventType } from '@nauth-toolkit/core';

// auditService is available from NAuth.create() result
export function registerAuditRoutes(
  app: Express,
  auditService: AuthAuditService,
) {
  app.get('/admin/audit/user-history', async (req, res) => {
    const { sub, page = 1, limit = 50 } = req.query;
    const result = await auditService.getUserAuthHistory({
      sub: sub as string,
      page: Number(page),
      limit: Number(limit),
    });
    res.json(result);
  });

  app.get('/admin/audit/suspicious', async (req, res) => {
    const result = await auditService.getSuspiciousActivity({
      limit: 100,
    });
    res.json(result);
  });
}
```

</TabItem>
</Tabs>

### Query Methods

| Method | Purpose | Parameters |
|---|---|---|
| `getUserAuthHistory()` | Full history for one user | `sub`, `page`, `limit`, `eventTypes[]`, `eventStatus[]`, `startDate`, `endDate` |
| `getEventsByType()` | All events of a specific type | `eventType`, `page`, `limit`, `startDate`, `endDate` |
| `getSuspiciousActivity()` | Suspicious/risky events | `sub?` (optional), `limit` |
| `getRiskAssessmentHistory()` | Adaptive MFA risk events | `sub`, `limit` |

### Filtering Examples

```typescript
// Login failures in the last 24 hours
const failures = await auditService.getUserAuthHistory({
  sub: 'user-uuid',
  eventTypes: [AuthAuditEventType.LOGIN_FAILED, AuthAuditEventType.LOGIN_BLOCKED],
  eventStatus: ['FAILURE'],
  startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
  page: 1,
  limit: 50,
});

// All suspicious activity across all users
const suspicious = await auditService.getSuspiciousActivity({
  limit: 100,
});

// All social logins this month
const socialLogins = await auditService.getEventsByType({
  eventType: AuthAuditEventType.SOCIAL_LOGIN,
  startDate: new Date('2025-02-01'),
  page: 1,
  limit: 100,
});
```

### Response Format

All query methods return paginated responses:

```json
{
  "data": [
    {
      "id": 1042,
      "userId": 15,
      "eventType": "LOGIN_SUCCESS",
      "eventStatus": "SUCCESS",
      "ipAddress": "203.0.113.42",
      "ipCountry": "US",
      "ipCity": "San Francisco",
      "platform": "macOS",
      "browser": "Chrome",
      "deviceName": "Chrome on MacBook",
      "deviceType": "desktop",
      "authMethod": "password",
      "performedBy": "550e8400-e29b-41d4-a716-446655440000",
      "metadata": null,
      "createdAt": "2025-02-22T14:30:00.000Z"
    },
    {
      "id": 1041,
      "userId": 15,
      "eventType": "MFA_VERIFICATION_SUCCESS",
      "eventStatus": "SUCCESS",
      "ipAddress": "203.0.113.42",
      "ipCountry": "US",
      "ipCity": "San Francisco",
      "platform": "macOS",
      "browser": "Chrome",
      "authMethod": "totp",
      "metadata": {
        "deviceType": "totp",
        "deviceName": "Authenticator App"
      },
      "createdAt": "2025-02-22T14:29:55.000Z"
    },
    {
      "id": 1038,
      "userId": 15,
      "eventType": "LOGIN_FAILED",
      "eventStatus": "FAILURE",
      "ipAddress": "198.51.100.23",
      "ipCountry": "DE",
      "ipCity": "Berlin",
      "platform": "Windows",
      "browser": "Firefox",
      "deviceType": "desktop",
      "authMethod": "password",
      "reason": "Invalid credentials",
      "metadata": null,
      "createdAt": "2025-02-22T10:15:00.000Z"
    }
  ],
  "total": 247,
  "page": 1,
  "limit": 50,
  "totalPages": 5
}
```

## Step 3: Display Audit History (Frontend)

### Current User's History

Use the client SDK to fetch the authenticated user's own audit history:

<Tabs groupId="frontend">
<TabItem value="angular" label="Angular">

```typescript title="src/app/security/audit-history.component.ts"
import { Component, OnInit } from '@angular/core';
import { AuthService } from '@nauth-toolkit/client-angular';
import { AuditHistoryResponse, AuthAuditEvent } from '@nauth-toolkit/client';

@Component({
  selector: 'app-audit-history',
  template: `
    <h2>Login Activity</h2>
    <table>
      <thead>
        <tr>
          <th>Event</th>
          <th>Status</th>
          <th>Location</th>
          <th>Device</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody>
        @for (event of events; track event.id) {
          <tr [class.suspicious]="event.eventStatus === 'SUSPICIOUS'">
            <td>{{ formatEventType(event.eventType) }}</td>
            <td>{{ event.eventStatus }}</td>
            <td>{{ event.ipCity }}, {{ event.ipCountry }}</td>
            <td>{{ event.deviceName || event.browser }}</td>
            <td>{{ event.createdAt | date:'medium' }}</td>
          </tr>
        }
      </tbody>
    </table>
  `,
})
export class AuditHistoryComponent implements OnInit {
  events: AuthAuditEvent[] = [];

  constructor(private auth: AuthService) {}

  async ngOnInit() {
    const response = await this.auth.getAuditHistory({
      page: 1,
      limit: 20,
    });
    this.events = response.data;
  }

  formatEventType(type: string): string {
    return type.replace(/_/g, ' ').toLowerCase()
      .replace(/^\w/, c => c.toUpperCase());
  }
}
```

</TabItem>
<TabItem value="react" label="React / JS">

```typescript title="src/components/AuditHistory.tsx"
import { useEffect, useState } from 'react';
import { NAuthClient, AuthAuditEvent } from '@nauth-toolkit/client';

export function AuditHistory({ client }: { client: NAuthClient }) {
  const [events, setEvents] = useState<AuthAuditEvent[]>([]);

  useEffect(() => {
    client.getAuditHistory({ page: 1, limit: 20 })
      .then(res => setEvents(res.data));
  }, [client]);

  return (
    <table>
      <thead>
        <tr>
          <th>Event</th>
          <th>Status</th>
          <th>Location</th>
          <th>Device</th>
          <th>Date</th>
        </tr>
      </thead>
      <tbody>
        {events.map(event => (
          <tr key={event.id}>
            <td>{event.eventType.replace(/_/g, ' ')}</td>
            <td>{event.eventStatus}</td>
            <td>{event.ipCity}, {event.ipCountry}</td>
            <td>{event.deviceName || event.browser}</td>
            <td>{new Date(event.createdAt).toLocaleString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

</TabItem>
</Tabs>

### Admin: Any User's History

Use the admin operations client to query any user's audit history:

<Tabs groupId="frontend">
<TabItem value="angular" label="Angular">

```typescript
const history = await this.auth.admin?.getAuditHistory({
  sub: 'user-uuid',
  page: 1,
  limit: 50,
  eventType: 'LOGIN_FAILED',
});
```

</TabItem>
<TabItem value="react" label="React / JS">

```typescript
const history = await client.admin.getAuditHistory({
  sub: 'user-uuid',
  page: 1,
  limit: 50,
  eventType: 'LOGIN_FAILED',
});
```

</TabItem>
</Tabs>

## Troubleshooting

**No audit records being created:**
1. Verify `auditLogs.enabled` is not set to `false`
2. Check server logs for audit recording errors
3. Verify the database migration has run (audit table exists)

**Missing geolocation data:**
1. Configure [Geolocation](/docs/guides/geolocation) --- `ipCountry`, `ipCity`, and coordinates require MaxMind
2. Without geolocation, only `ipAddress` is captured

**Audit endpoint returns 404:**
1. Verify audit logging is enabled in your config
2. Check that your backend exposes the audit endpoints (NestJS auto-registers them)

**High database growth:**
1. Enable `fireAndForget: true` for write performance
2. Implement retention policies --- periodically delete old records
3. Consider archiving to cold storage for compliance

## What's Next

- **[Audit Logs](/docs/concepts/audit-logs)** --- How audit logging works (event types catalog, data model, metadata examples)
- **[Lifecycle Hooks](/docs/guides/lifecycle-hooks)** --- React to auth events with custom logic
- **[Geolocation](/docs/guides/geolocation)** --- Enable location data in audit records
- **[Admin Operations](/docs/guides/admin-operations)** --- User management and session control
