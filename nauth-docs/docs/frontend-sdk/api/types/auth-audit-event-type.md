---
title: AuthAuditEventType
description: Enum of authentication and security event types
keywords: [audit, event, type, enum, security, authentication, api]
image: /img/api-social-card.png
---

# AuthAuditEventType

**Package:** `@nauth-toolkit/client`
**Type:** Enum

Enum of all authentication and security event types.

```typescript
import { AuthAuditEventType } from '@nauth-toolkit/client';
```

## Values

### Authentication Events

| Value           | Description            |
| --------------- | ---------------------- |
| `LOGIN_SUCCESS` | Successful login       |
| `LOGIN_FAILED`  | Failed login attempt   |
| `LOGOUT`        | User logout            |
| `TOKEN_REFRESH` | Access token refreshed |
| `TOKEN_REVOKED` | Token manually revoked |

### Registration Events

| Value            | Description                  |
| ---------------- | ---------------------------- |
| `SIGNUP_SUCCESS` | Successful user registration |
| `SIGNUP_FAILED`  | Failed registration attempt  |

### Verification Events

| Value                 | Description                  |
| --------------------- | ---------------------------- |
| `EMAIL_VERIFIED`      | Email verification completed |
| `PHONE_VERIFIED`      | Phone verification completed |
| `VERIFICATION_FAILED` | Verification attempt failed  |

### MFA Events

| Value                  | Description                 |
| ---------------------- | --------------------------- |
| `MFA_ENABLED`          | MFA enabled for account     |
| `MFA_DISABLED`         | MFA disabled for account    |
| `MFA_VERIFIED`         | MFA verification successful |
| `MFA_FAILED`           | MFA verification failed     |
| `MFA_BACKUP_CODE_USED` | Backup code used for MFA    |

### Password Events

| Value                      | Description              |
| -------------------------- | ------------------------ |
| `PASSWORD_CHANGED`         | Password changed         |
| `PASSWORD_RESET_REQUESTED` | Password reset requested |
| `PASSWORD_RESET_COMPLETED` | Password reset completed |

### Security Events

| Value                    | Description                               |
| ------------------------ | ----------------------------------------- |
| `ACCOUNT_LOCKED`         | Account locked due to suspicious activity |
| `ACCOUNT_UNLOCKED`       | Account unlocked                          |
| `SUSPICIOUS_ACTIVITY`    | Suspicious activity detected              |
| `ADAPTIVE_MFA_TRIGGERED` | Adaptive MFA triggered by risk analysis   |

### Social Authentication Events

| Value                 | Description                        |
| --------------------- | ---------------------------------- |
| `SOCIAL_LINK_SUCCESS` | Social account linked successfully |
| `SOCIAL_LINK_FAILED`  | Social account linking failed      |
| `SOCIAL_UNLINK`       | Social account unlinked            |

## Examples

**Filtering by Event Type:**

```typescript
// Get all login attempts
const logins = await client.getAuditHistory({
  eventType: AuthAuditEventType.LOGIN_SUCCESS,
  page: 1,
  limit: 50,
});

// Get all MFA events
const mfaEvents = await client.getAuditHistory({
  eventType: AuthAuditEventType.MFA_VERIFIED,
  page: 1,
  limit: 20,
});
```

**Display Event Type Icons:**

```typescript
function getEventIcon(eventType: AuthAuditEventType): string {
  const icons: Record<AuthAuditEventType, string> = {
    [AuthAuditEventType.LOGIN_SUCCESS]: 'log-in',
    [AuthAuditEventType.LOGIN_FAILED]: 'x-circle',
    [AuthAuditEventType.LOGOUT]: 'log-out',
    [AuthAuditEventType.MFA_ENABLED]: 'shield-check',
    [AuthAuditEventType.MFA_VERIFIED]: 'shield',
    [AuthAuditEventType.PASSWORD_CHANGED]: 'key',
    [AuthAuditEventType.SUSPICIOUS_ACTIVITY]: 'alert-triangle',
    // ... other mappings
  };

  return icons[eventType] || 'info-circle';
}
```

**Angular Component:**

```typescript
export class AuditLogComponent {
  eventTypes = AuthAuditEventType;
  selectedType: AuthAuditEventType | null = null;

  filterByType(type: AuthAuditEventType) {
    this.selectedType = type;
    this.loadAuditHistory(type);
  }

  async loadAuditHistory(type: AuthAuditEventType) {
    const history = await this.authService.getClient().getAuditHistory({
      eventType: type,
      page: 1,
      limit: 20,
    });
    this.events = history.data;
  }
}
```

## Related Types

- [`AuthAuditEvent`](./auth-audit-event) - Individual audit event with [`AuthAuditEventType`](./auth-audit-event-type) property
- [`AuthAuditEventStatus`](./auth-audit-event-status) - Event status type
- [`AuditHistoryResponse`](./audit-history-response) - Paginated audit history

## Used By

- [AuthAuditEvent](./auth-audit-event) - `eventType` property uses [`AuthAuditEventType`](./auth-audit-event-type) enum
- [NAuthClient.getAuditHistory()](../nauth-client#getaudithistory) - Filter parameter accepts [`AuthAuditEventType`](./auth-audit-event-type) values
