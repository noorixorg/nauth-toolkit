---
title: IUser
description: User entity contract used across core services and database implementations
keywords: [user, entity, interface, api]
image: /img/api-social-card.png
---
import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# IUser

**Package:** `@nauth-toolkit/core`
**Type:** Interface

Entity contract for user records implemented by database packages.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { IUser } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { IUser } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { IUser } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Properties

### Identity

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | `number` | Yes | Database auto-increment ID |
| `sub` | `string` | Yes | Public user identifier (UUID v4) |
| `email` | `string` | Yes | Email address |
| `username` | `string \| null` | Yes | Username |
| `phone` | `string \| null` | Yes | Phone number (E.164 format) |
| `firstName` | `string \| null` | Yes | First name |
| `lastName` | `string \| null` | Yes | Last name |
| `metadata` | `Record<string, unknown> \| null` | Yes | Custom user metadata |

### Verification and status

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `isEmailVerified` | `boolean` | Yes | Whether email is verified |
| `isPhoneVerified` | `boolean` | Yes | Whether phone is verified |
| `isActive` | `boolean` | Yes | Whether user account is active |
| `mustChangePassword` | `boolean` | Yes | Whether user must change password on next login |
| `isLocked` | `boolean` | Yes | Whether account is locked |
| `lockReason` | `string \| null` | Yes | Reason for account lock |
| `lockedAt` | `Date \| null` | Yes | When the account was locked |
| `lockedUntil` | `Date \| null` | Yes | When the lock expires (null = indefinite) |

### Login tracking

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `failedLoginAttempts` | `number` | Yes | Count of consecutive failed login attempts |
| `lastFailedLoginAt` | `Date \| null` | Yes | Timestamp of last failed login |
| `lastLoginAt` | `Date \| null` | Yes | Timestamp of last successful login |
| `lastLoginIp` | `string \| null` | Yes | IP address of last successful login |

### Social authentication

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `hasSocialAuth` | `boolean` | Yes | Whether user has any linked social accounts |
| `socialProviders` | `string[] \| null` | Yes | List of linked social providers (e.g., `['google', 'apple']`) |

### MFA

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `mfaEnabled` | `boolean` | Yes | Whether MFA is enabled |
| `mfaMethods` | `string[] \| null` | Yes | Configured MFA methods (e.g., `['totp', 'passkey']`) |
| `preferredMfaMethod` | `string \| null` | Yes | User's preferred MFA method |
| `mfaExempt` | `boolean` | No | Whether user is exempt from MFA |
| `mfaExemptReason` | `string \| null` | No | Reason for MFA exemption |
| `mfaExemptGrantedAt` | `Date \| null` | No | When exemption was granted |
| `mfaExemptGrantedBy` | `string \| null` | No | Admin who granted the exemption |
| `backupCodes` | `string[] \| null` | Yes | Hashed MFA backup codes |

### Password (internal)

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `passwordHash` | `string \| null` | Yes | Hashed password. Never expose directly. |
| `passwordChangedAt` | `Date \| null` | Yes | When password was last changed |
| `passwordHistory` | `string[] \| null` | Yes | Previous password hashes (for reuse prevention) |
| `hasPasswordHash` | `boolean` | No | Computed field: whether user has a password set. Use this instead of checking `passwordHash`. |
| `sessionAuthMethod` | `string \| null` | No | Auth method for the current session (e.g., `password`, `google`). Session-scoped, not an account capability. |

### Timestamps

| Property | Type | Required | Description |
| --- | --- | --- | --- |
| `createdAt` | `Date` | Yes | Account creation timestamp |
| `updatedAt` | `Date` | Yes | Last update timestamp |
| `deletedAt` | `Date \| null` | Yes | Soft-delete timestamp (null if active) |

## Related APIs

- [ISession](./session) - Sessions
- [AuthService](/docs/api/core/services/auth-service) - Service usage
- [UserResponseDTO](/docs/api/core/dto/user-response-dto) - Sanitized user object returned in API responses


