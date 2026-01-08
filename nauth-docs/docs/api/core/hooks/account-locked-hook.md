---
title: IAccountLockedHook
description: Hook interface for account lockout events
keywords: [hooks, security, lockout, interface]
image: /img/api-social-card.png
---
# IAccountLockedHook

Hook interface for executing actions after account lockouts.

## Overview

The `IAccountLockedHook` interface enables reactions to account lockout events triggered by failed login attempts exceeding configured thresholds.

The hook is **non-blocking** - errors are logged but do not affect the lockout operation.

## Interface

```typescript
interface IAccountLockedHook {
  execute(metadata: AccountLockedMetadata): Promise<void>;
}
```

## Metadata

### AccountLockedMetadata

```typescript
interface AccountLockedMetadata {
  user: IUser;
  reason: string;
  lockType: 'temporary' | 'permanent';
  lockDuration?: number;
  lockedUntil?: Date;
  ipAddress?: string;
  failedAttempts?: number;
}
```

| Property         | Type                           | Description                              |
| ---------------- | ------------------------------ | ---------------------------------------- |
| `user`           | `IUser`                        | User whose account was locked            |
| `reason`         | `string`                       | Reason for lockout                       |
| `lockType`       | `'temporary' \| 'permanent'`   | Type of lock (temporary or permanent)    |
| `lockDuration`   | `number`                       | Lock duration in seconds (temporary only)|
| `lockedUntil`    | `Date`                         | When lock expires (temporary only)       |
| `ipAddress`      | `string`                       | IP that triggered lockout                |
| `failedAttempts` | `number`                       | Failed attempts that triggered lockout   |

## When Hook Fires

- Account lockout threshold reached via rate limiting

## Example

```typescript
import { IAccountLockedHook, AccountLockedMetadata } from '@nauth-toolkit/core';

export class AccountLockedNotificationHook implements IAccountLockedHook {
  async execute(metadata: AccountLockedMetadata): Promise<void> {
    await this.emailService.sendAccountLockedEmail({
      to: metadata.user.email,
      lockType: metadata.lockType,
      lockedUntil: metadata.lockedUntil,
      ipAddress: metadata.ipAddress,
    });
  }
}
```

## Related

- [HookRegistryService](../services/hook-registry-service) - Hook registration
- [@AccountLockedHook()](/docs/api/nestjs/decorators/account-locked-hook) - NestJS decorator
- [Lifecycle Hooks Guide](/docs/features/lifecycle-hooks) - Complete hooks overview

