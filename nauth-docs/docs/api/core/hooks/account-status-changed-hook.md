---
title: IAccountStatusChangedHook
description: Hook interface for account enable/disable events
keywords: [hooks, account, status, interface]
image: /img/api-social-card.png
---
# IAccountStatusChangedHook

Hook interface for executing actions after account status changes.

## Overview

The `IAccountStatusChangedHook` interface enables reactions to account enable/disable events triggered by administrators.

The hook is **non-blocking** - errors are logged but do not affect the status change operation.

## Interface

```typescript
interface IAccountStatusChangedHook {
  execute(metadata: AccountStatusChangedMetadata): Promise<void>;
}
```

## Metadata

### AccountStatusChangedMetadata

```typescript
interface AccountStatusChangedMetadata {
  user: IUser;
  status: 'disabled' | 'enabled';
  reason?: string;
  performedBy?: string;
  revokedSessions?: number;
  clientInfo?: ClientInfo;
}
```

| Property          | Type                       | Description                          |
| ----------------- | -------------------------- | ------------------------------------ |
| `user`            | `IUser`                    | User whose status changed            |
| `status`          | `'disabled' \| 'enabled'`  | New account status                   |
| `reason`          | `string`                   | Reason for status change             |
| `performedBy`     | `string`                   | Admin who performed action (sub)     |
| `revokedSessions` | `number`                   | Sessions revoked (disable only)      |
| `clientInfo`      | `ClientInfo`               | IP, user agent, location             |

## When Hook Fires

- Admin disables user via `disableUser()`
- Admin enables user via `enableUser()`

## Example

```typescript
import { IAccountStatusChangedHook, AccountStatusChangedMetadata } from '@nauth-toolkit/core';

export class AccountStatusNotificationHook implements IAccountStatusChangedHook {
  async execute(metadata: AccountStatusChangedMetadata): Promise<void> {
    if (metadata.status === 'disabled') {
      await this.emailService.sendAccountDisabledEmail({
        to: metadata.user.email,
        reason: metadata.reason,
        revokedSessions: metadata.revokedSessions,
      });
    }
  }
}
```

## Related

- [HookRegistryService](../services/hook-registry-service) - Hook registration
- [@AccountStatusChangedHook()](/docs/api/nestjs/decorators/account-status-changed-hook) - NestJS decorator
- [Lifecycle Hooks Guide](/docs/guides/lifecycle-hooks) - Complete hooks overview

