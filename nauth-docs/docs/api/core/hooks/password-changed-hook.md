---
title: IPasswordChangedHook
description: Hook interface for password change events
keywords: [hooks, password, security, interface]
image: /img/api-social-card.png
---
# IPasswordChangedHook

Hook interface for executing actions after password changes.

## Overview

The `IPasswordChangedHook` interface enables reactions to password change events. This includes user-initiated changes, admin password resets, and password recovery completions.

The hook is **non-blocking** - errors are logged but do not affect the password change operation.

## Interface

```typescript
interface IPasswordChangedHook {
  execute(metadata: PasswordChangedMetadata): Promise<void>;
}
```

## Metadata

### PasswordChangedMetadata

```typescript
interface PasswordChangedMetadata {
  user: IUser;
  changedBy: 'user' | 'admin' | 'reset';
  sessionsRevoked?: number;
  clientInfo?: ClientInfo;
}
```

| Property          | Type                           | Description                             |
| ----------------- | ------------------------------ | --------------------------------------- |
| `user`            | `IUser`                        | User whose password was changed         |
| `changedBy`       | `'user' \| 'admin' \| 'reset'` | How password was changed                |
| `sessionsRevoked` | `number`                       | Number of sessions revoked              |
| `clientInfo`      | `ClientInfo`                   | IP, user agent, location                |

## When Hook Fires

- User changes own password via `changePassword()`
- Admin sets new password via `adminSetPassword()`
- Password reset completed via `confirmPasswordReset()`

## Example

```typescript
import { IPasswordChangedHook, PasswordChangedMetadata } from '@nauth-toolkit/core';

export class PasswordChangedEmailHook implements IPasswordChangedHook {
  async execute(metadata: PasswordChangedMetadata): Promise<void> {
    await this.emailService.sendPasswordChangedAlert({
      to: metadata.user.email,
      changedBy: metadata.changedBy,
      sessionsRevoked: metadata.sessionsRevoked || 0,
    });
  }
}
```

## Related

- [HookRegistryService](../services/hook-registry-service) - Hook registration
- [@PasswordChangedHook()](/docs/api/nestjs/decorators/password-changed-hook) - NestJS decorator
- [Lifecycle Hooks Guide](/docs/guides/lifecycle-hooks) - Complete hooks overview

