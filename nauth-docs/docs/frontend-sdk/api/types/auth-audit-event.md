---
title: AuthAuditEvent
description: Individual authentication or security audit event record
sidebar_position: 40
keywords: [audit, event, security, logging, authentication, api]
image: /img/api-social-card.png
---

# AuthAuditEvent

**Package:** `@nauth-toolkit/client`
**Type:** Interface

Individual authentication or security audit event record.

```typescript
import { AuthAuditEvent } from '@nauth-toolkit/client';
```

## Properties

| Property               | Type                                                | Required | Description                            |
| ---------------------- | --------------------------------------------------- | -------- | -------------------------------------- |
| `id`                   | `number`                                            | Yes      | Unique event identifier                |
| `userId`               | `number`                                            | Yes      | User ID associated with event          |
| `eventType`            | [`AuthAuditEventType`](./auth-audit-event-type)     | Yes      | Type of event                          |
| `eventStatus`          | [`AuthAuditEventStatus`](./auth-audit-event-status) | Yes      | Event status                           |
| `riskFactor`           | `number \| null`                                    | No       | Risk score (0-100)                     |
| `riskFactors`          | `string[] \| null`                                  | No       | Array of risk factor identifiers       |
| `adaptiveMfaTriggered` | `boolean \| null`                                   | No       | Whether adaptive MFA was triggered     |
| `ipAddress`            | `string \| null`                                    | No       | IP address of request                  |
| `ipCountry`            | `string \| null`                                    | No       | Country from IP geolocation            |
| `ipCity`               | `string \| null`                                    | No       | City from IP geolocation               |
| `userAgent`            | `string \| null`                                    | No       | Full user agent string                 |
| `platform`             | `string \| null`                                    | No       | Platform (Windows, macOS, Linux, etc.) |
| `browser`              | `string \| null`                                    | No       | Browser name and version               |
| `deviceId`             | `string \| null`                                    | No       | Device identifier                      |
| `deviceName`           | `string \| null`                                    | No       | Device name                            |
| `deviceType`           | `string \| null`                                    | No       | Device type (desktop, mobile, tablet)  |
| `sessionId`            | `number \| null`                                    | No       | Associated session ID                  |
| `challengeSessionId`   | `number \| null`                                    | No       | Associated challenge session ID        |
| `authMethod`           | `string \| null`                                    | No       | Authentication method used             |
| `performedBy`          | `string \| null`                                    | No       | Who performed the action               |
| `reason`               | `string \| null`                                    | No       | Reason for the action                  |
| `description`          | `string \| null`                                    | No       | Additional description                 |
| `metadata`             | `Record<string, unknown> \| null`                   | No       | Additional metadata                    |
| `createdAt`            | `string \| Date`                                    | Yes      | Event timestamp                        |

## Example

**Displaying Event Details:**

```typescript
function displayAuditEvent(event: AuthAuditEvent) {
  console.log(`Event #${event.id}`);
  console.log(`Type: ${event.eventType}`);
  console.log(`Status: ${event.eventStatus}`);
  console.log(`Time: ${new Date(event.createdAt).toLocaleString()}`);

  if (event.ipAddress) {
    console.log(`Location: ${event.ipCity}, ${event.ipCountry} (${event.ipAddress})`);
  }

  if (event.deviceType) {
    console.log(`Device: ${event.deviceType} - ${event.browser} on ${event.platform}`);
  }

  if (event.riskFactor) {
    console.log(`Risk Score: ${event.riskFactor}/100`);
    if (event.riskFactors) {
      console.log(`Risk Factors: ${event.riskFactors.join(', ')}`);
    }
  }

  if (event.adaptiveMfaTriggered) {
    console.log('Adaptive MFA was triggered for this event');
  }
}
```

**Angular (20+) Example:**

```typescript
// audit-log.component.ts
import { Component, computed, input } from '@angular/core';
import { AuthAuditEvent } from './auth-audit-event';

@Component({
  selector: 'app-audit-log',
  templateUrl: './audit-log.component.html',
})
export class AuditLogComponent {
  // New input API (Angular 16+) - works great with signals-based templates.
  readonly auditEvents = input.required<AuthAuditEvent[]>();

  // Signals-friendly derived state
  readonly hasEvents = computed(() => (this.auditEvents()?.length ?? 0) > 0);
}
```

```html
<!-- audit-log.component.html -->
@if (!hasEvents()) {
  <p>No audit events.</p>
} @else {
  @for (event of auditEvents(); track event.id) {
    <div class="audit-event">
      <div class="event-header">
        <span class="event-type">{{ event.eventType }}</span>
        <span [class]="'event-status-' + event.eventStatus">
          {{ event.eventStatus }}
        </span>
      </div>

      <div class="event-details">
        <p>{{ event.createdAt | date:'medium' }}</p>

        @if (event.ipAddress) {
          <p>
            Location: {{ event.ipCity }}, {{ event.ipCountry }} ({{ event.ipAddress }})
          </p>
        }

        @if (event.deviceType) {
          <p>Device: {{ event.browser }} on {{ event.platform }}</p>
        }

        @if (event.riskFactor) {
          <p class="risk-indicator">Risk Score: {{ event.riskFactor }}/100</p>
        }
      </div>
    </div>
  }
}
```

## Related Types

- [`AuditHistoryResponse`](./audit-history-response) - Paginated audit history containing [`AuthAuditEvent`](./auth-audit-event) array
- [`AuthAuditEventType`](./auth-audit-event-type) - Event type enum values
- [`AuthAuditEventStatus`](./auth-audit-event-status) - Event status type values

## Used By

- [NAuthClient.getAuditHistory()](../nauth-client#getaudithistory) - Returns [`AuditHistoryResponse`](./audit-history-response) with [`AuthAuditEvent`](./auth-audit-event) array
