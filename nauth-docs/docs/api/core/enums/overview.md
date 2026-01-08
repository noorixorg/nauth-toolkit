---
title: Enums
description: Enumeration types for authentication states and codes
keywords: [enums, types, mfa, errors, api]
image: /img/api-social-card.png
---
# Enums

**Package:** `@nauth-toolkit/core`
**Type:** Enumerations

## AuthAuditEventStatus

Event classification status for filtering audit records.

```typescript
import { AuthAuditEventStatus } from '@nauth-toolkit/core';
```

| Value | Description |
|-------|-------------|
| `SUCCESS` | Operation completed successfully |
| `FAILURE` | Operation failed |
| `INFO` | Informational event |
| `SUSPICIOUS` | Security violation detected |

See [AuthAuditEventStatus](./auth-audit-event-status) for details.

## AuthAuditEventType

Complete enumeration of authentication audit event types (50+ events).

```typescript
import { AuthAuditEventType } from '@nauth-toolkit/core';
```

**Categories:** Login, Session, Password, MFA, Adaptive MFA, Verification, Account Management, Profile Updates, Social Auth, Challenge Flow, Security.

See [AuthAuditEventType](./auth-audit-event-type) for complete list.

## AuthErrorCode

Error codes for `NAuthException`.

See [AuthErrorCode](./auth-error-code) for the complete list.

## MFAMethod

MFA method identifiers.

See [MFAMethod](./mfa-method) for values and related types.

## RiskFactor

Risk factor identifiers used in risk scoring and audit logging.

See [RiskFactor](./risk-factor) for values.

## SMSTemplateType

SMS template type identifiers used by the SMS template engine.

See [SMSTemplateType](./sms-template-type) for values.

## Related

- [NAuthException](/docs/api/core/exceptions/nauth-exception)
- [MFAService](/docs/api/core/services/mfa-service)
