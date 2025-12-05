---
title: AuthAuditEventType
description: Complete enumeration of authentication audit event types
keywords: [enum, audit, events, security, api]
image: /img/api-social-card.png
sidebar_position: 1
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# AuthAuditEventType

**Package:** `@nauth-toolkit/core`
**Type:** Enum

Complete enumeration of all authentication and security events recorded in the audit trail.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { AuthAuditEventType } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { AuthAuditEventType } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { AuthAuditEventType } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Login Events

| Value           | Description                                                    |
| --------------- | -------------------------------------------------------------- |
| `LOGIN_ATTEMPT` | Login attempt initiated (credentials validated, risk assessed) |
| `LOGIN_SUCCESS` | User successfully authenticated                                |
| `LOGIN_FAILED`  | Login attempt failed (invalid credentials, account locked)     |
| `LOGIN_BLOCKED` | Login attempt blocked (account locked, IP blocked)             |

## Session Events

| Value             | Description                                                |
| ----------------- | ---------------------------------------------------------- |
| `SESSION_CREATED` | New session created (after successful authentication)      |
| `SESSION_REVOKED` | Session revoked (logout, security violation, admin action) |

## Password Events

| Value                             | Description                                                |
| --------------------------------- | ---------------------------------------------------------- |
| `PASSWORD_CHANGED`                | User changed their password                                |
| `PASSWORD_RESET_REQUESTED`        | Password reset requested (email/SMS sent)                  |
| `PASSWORD_RESET_COMPLETED`        | Password reset completed successfully                      |
| `PASSWORD_FORCE_CHANGE_SET`       | Force password change requirement set (by admin or policy) |
| `PASSWORD_FORCE_CHANGE_COMPLETED` | Force password change completed                            |

## Multi-Factor Authentication (MFA) Events

| Value                          | Description                                                      |
| ------------------------------ | ---------------------------------------------------------------- |
| `MFA_ENABLED`                  | MFA enabled for user account                                     |
| `MFA_DISABLED`                 | MFA disabled for user account                                    |
| `MFA_DEVICE_ADDED`             | New MFA device registered (TOTP, SMS, Passkey)                   |
| `MFA_DEVICE_REMOVED`           | MFA device removed from account                                  |
| `MFA_DEVICE_UPDATED`           | MFA device updated (name changed, primary flag changed)          |
| `MFA_VERIFICATION_SUCCESS`     | MFA verification succeeded                                       |
| `MFA_VERIFICATION_FAILED`      | MFA verification failed (invalid code, expired)                  |
| `MFA_EXEMPTION_GRANTED`        | MFA exemption granted (admin action)                             |
| `MFA_EXEMPTION_REVOKED`        | MFA exemption revoked (admin action)                             |
| `MFA_BACKUP_CODES_GENERATED`   | Backup codes generated for MFA recovery                          |
| `MFA_BACKUP_CODE_USED`         | Backup code used for MFA verification                            |
| `MFA_PREFERRED_METHOD_UPDATED` | User's preferred MFA method updated                              |
| `DEVICE_TRUSTED`               | Device trusted by user (remember device feature)                 |
| `DEVICE_UNTRUSTED`             | Trusted device revoked (user untrusted device or device expired) |

## Adaptive MFA Events (Risk-Based)

| Value                        | Description                                                            |
| ---------------------------- | ---------------------------------------------------------------------- |
| `ADAPTIVE_MFA_RISK_ASSESSED` | Risk assessment completed (for future adaptive MFA implementation)     |
| `ADAPTIVE_MFA_TRIGGERED`     | Adaptive MFA triggered due to risk factors (for future implementation) |
| `ADAPTIVE_MFA_BYPASSED`      | Adaptive MFA bypassed due to low risk (for future implementation)      |

## Verification Events

| Value                          | Description                                       |
| ------------------------------ | ------------------------------------------------- |
| `EMAIL_VERIFIED`               | Email address verified successfully               |
| `EMAIL_VERIFICATION_REQUESTED` | Email verification code/link requested            |
| `EMAIL_VERIFICATION_FAILED`    | Email verification failed (invalid code, expired) |
| `PHONE_VERIFIED`               | Phone number verified successfully                |
| `PHONE_VERIFICATION_REQUESTED` | Phone verification code requested                 |
| `PHONE_VERIFICATION_FAILED`    | Phone verification failed (invalid code, expired) |

## Account Management Events

| Value                 | Description                                         |
| --------------------- | --------------------------------------------------- |
| `ACCOUNT_CREATED`     | New user account created (signup)                   |
| `ACCOUNT_ACTIVATED`   | User account activated                              |
| `ACCOUNT_DEACTIVATED` | User account deactivated                            |
| `ACCOUNT_LOCKED`      | User account locked (security measure)              |
| `ACCOUNT_UNLOCKED`    | User account unlocked (admin action or auto-unlock) |
| `ACCOUNT_DELETED`     | User account deleted                                |

## Profile Update Events

| Value              | Description                           |
| ------------------ | ------------------------------------- |
| `PROFILE_UPDATED`  | User profile updated (general update) |
| `EMAIL_CHANGED`    | User email address changed            |
| `PHONE_CHANGED`    | User phone number changed             |
| `USERNAME_CHANGED` | User username changed                 |

## Social Authentication Events

| Value                     | Description                                                      |
| ------------------------- | ---------------------------------------------------------------- |
| `SOCIAL_LOGIN`            | User authenticated via social provider (Google, Apple, Facebook) |
| `SOCIAL_ACCOUNT_LINKED`   | Social account linked to user account                            |
| `SOCIAL_ACCOUNT_UNLINKED` | Social account unlinked from user account                        |

## Challenge Flow Events

| Value                      | Description                                                                   |
| -------------------------- | ----------------------------------------------------------------------------- |
| `CHALLENGE_CREATED`        | Challenge session created (email verification, phone verification, MFA setup) |
| `CHALLENGE_COMPLETED`      | Challenge completed successfully                                              |
| `CHALLENGE_ATTEMPT_FAILED` | Challenge attempt failed (max attempts exceeded)                              |

## Security Events

| Value                 | Description                                                   |
| --------------------- | ------------------------------------------------------------- |
| `SUSPICIOUS_ACTIVITY` | Suspicious activity detected (token reuse, impossible travel) |

## Related

- [AuthAuditEventStatus](./auth-audit-event-status)
- [AuthAuditService](../services/auth-audit-service)
