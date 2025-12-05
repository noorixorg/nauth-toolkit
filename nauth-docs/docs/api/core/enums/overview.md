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

```typescript
import { AuthErrorCode } from '@nauth-toolkit/core';
```

| Code | Description |
|------|-------------|
| `INVALID_CREDENTIALS` | Wrong email/password |
| `USER_NOT_FOUND` | User doesn't exist |
| `USER_ALREADY_EXISTS` | Email already registered |
| `EMAIL_NOT_VERIFIED` | Email verification required |
| `ACCOUNT_LOCKED` | Too many failed attempts |
| `TOKEN_EXPIRED` | JWT or refresh token expired |
| `TOKEN_INVALID` | Invalid token |
| `MFA_REQUIRED` | MFA verification needed |
| `CSRF_INVALID` | CSRF token validation failed |
| `VALIDATION_ERROR` | Input validation failed |

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

```typescript
import { MFAMethod } from '@nauth-toolkit/core';
```

| Value | Description |
|-------|-------------|
| `TOTP` | Time-based one-time password (authenticator apps) |
| `SMS` | SMS verification code |
| `EMAIL` | Email verification code |
| `PASSKEY` | WebAuthn/FIDO2 passkey |
| `BACKUP` | Backup recovery code |

## MFADeviceMethod

Type union of device methods (excludes BACKUP).

```typescript
import { MFADeviceMethod } from '@nauth-toolkit/core';

// Only device setup methods
type MFADeviceMethod = MFAMethod.TOTP | MFAMethod.SMS | MFAMethod.EMAIL | MFAMethod.PASSKEY;
```

## MFAVerificationMethod

Type union of all verification methods (includes BACKUP).

```typescript
import { MFAVerificationMethod } from '@nauth-toolkit/core';

// All verification methods
type MFAVerificationMethod = MFADeviceMethod | MFAMethod.BACKUP;
```

## MFADeviceMethods

Constant array of device methods.

```typescript
import { MFADeviceMethods } from '@nauth-toolkit/core';

// ['totp', 'sms', 'email', 'passkey']
const methods: readonly MFADeviceMethod[] = MFADeviceMethods;
```

## Related

- [NAuthException](/docs/api/core/exceptions/nauth-exception)
- [MFAService](/docs/api/core/services/mfa-service)
