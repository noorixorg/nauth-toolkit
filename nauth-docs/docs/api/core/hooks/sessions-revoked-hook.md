---
title: ISessionsRevokedHook
description: Hook interface for session revocation events
keywords: [hooks, sessions, security, interface]
image: /img/api-social-card.png
---
# ISessionsRevokedHook

Hook interface for executing actions after bulk session revocations.

## Overview

The `ISessionsRevokedHook` interface enables reactions to session revocation events. NOT triggered for user-initiated revocations to avoid notification spam.

The hook is **non-blocking** - errors are logged but do not affect the revocation operation.

## Interface

```typescript
interface ISessionsRevokedHook {
  execute(metadata: SessionsRevokedMetadata): Promise<void>;
}
```

## Metadata

### SessionsRevokedMetadata

```typescript
interface SessionsRevokedMetadata {
  user: IUser;
  revokedCount: number;
  reason: string;
  initiatedBy: 'user' | 'admin' | 'system';
  triggerEvent?: string;
}
```

| Property       | Type                              | Description                           |
| -------------- | --------------------------------- | ------------------------------------- |
| `user`         | `IUser`                           | User whose sessions were revoked      |
| `revokedCount` | `number`                          | Number of sessions revoked            |
| `reason`       | `string`                          | Reason for revocation                 |
| `initiatedBy`  | `'user' \| 'admin' \| 'system'`   | Who initiated revocation              |
| `triggerEvent` | `string`                          | Trigger event (e.g., password_changed)|

## When Hook Fires

- Sessions revoked via `revokeAllUserSessions()` when NOT user-initiated

## Example

```typescript
import { ISessionsRevokedHook, SessionsRevokedMetadata } from '@nauth-toolkit/core';

export class SessionsRevokedAlertHook implements ISessionsRevokedHook {
  async execute(metadata: SessionsRevokedMetadata): Promise<void> {
    await this.emailService.sendSessionsRevokedEmail({
      to: metadata.user.email,
      revokedCount: metadata.revokedCount,
      reason: metadata.reason,
    });
  }
}
```

## Related

- [HookRegistryService](../services/hook-registry-service) - Hook registration
- [@SessionsRevokedHook()](/docs/api/nestjs/decorators/sessions-revoked-hook) - NestJS decorator
- [Lifecycle Hooks Guide](/docs/features/lifecycle-hooks) - Complete hooks overview

