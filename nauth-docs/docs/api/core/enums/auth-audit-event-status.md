---
title: AuthAuditEventStatus
description: Event classification status for audit records
keywords: [enum, audit, status, security, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# AuthAuditEventStatus

**Package:** `@nauth-toolkit/core`
**Type:** Type Union

Event classification status for filtering and analyzing audit records.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { AuthAuditEventStatus } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { AuthAuditEventStatus } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { AuthAuditEventStatus } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Values

| Value | Description | Example Events |
|-------|-------------|----------------|
| `SUCCESS` | Operation completed successfully | `LOGIN_SUCCESS`, `MFA_VERIFICATION_SUCCESS`, `EMAIL_VERIFIED` |
| `FAILURE` | Operation failed | `LOGIN_FAILED`, `MFA_VERIFICATION_FAILED`, `EMAIL_VERIFICATION_FAILED` |
| `INFO` | Informational event | `PROFILE_UPDATED`, `MFA_DEVICE_ADDED`, `ACCOUNT_CREATED` |
| `SUSPICIOUS` | Security violation or suspicious activity detected | `SUSPICIOUS_ACTIVITY`, `LOGIN_BLOCKED` |

## Usage

Filter audit events by status:

```typescript
const result = await auditService.getUserAuthHistory({
  userSub: 'user-uuid',
  eventStatus: ['SUSPICIOUS', 'FAILURE'],
});
```

## Related

- [AuthAuditEventType](./auth-audit-event-type)
- [AuthAuditService](../services/auth-audit-service)

