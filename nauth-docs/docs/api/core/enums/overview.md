---
title: Enums
description: Enumeration types for authentication states and codes
keywords: [enums, types, mfa, errors, api]
image: /img/api-social-card.png
sidebar_position: 0
---

# Enums

**Package:** `@nauth-toolkit/core`
**Type:** Enumerations

## AuthErrorCode

Error codes for `NAuthException`.

See [AuthErrorCode](./auth-error-code) for the complete list.

## AuthAuditEventType

Complete enumeration of authentication audit event types (50+ events).

```typescript
import { AuthAuditEventType } from '@nauth-toolkit/core';
```

**Categories:** Login, Session, Password, MFA, Adaptive MFA, Verification, Account Management, Profile Updates, Social Auth, Challenge Flow, Security.

See [AuthAuditEventType](./auth-audit-event-type) for complete list.

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

## MFAMethod

MFA method identifiers.

See [MFAMethod](./mfa-method) for values and related types.

## SMSTemplateType

SMS template type identifiers used by the SMS template engine.

See [SMSTemplateType](./sms-template-type) for values.

## RiskFactor

Risk factor identifiers used in risk scoring and audit logging.

See [RiskFactor](./risk-factor) for values.

## Related

- [NAuthException](/docs/api/core/exceptions/nauth-exception)
- [MFAService](/docs/api/core/services/mfa-service)
