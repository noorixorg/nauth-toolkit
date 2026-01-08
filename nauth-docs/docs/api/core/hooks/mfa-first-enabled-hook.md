---
title: IMFAFirstEnabledHook
description: Hook interface for first MFA device enrollment
keywords: [hooks, mfa, security, interface]
image: /img/api-social-card.png
---
# IMFAFirstEnabledHook

Hook interface for executing actions when user enables their first MFA device.

## Overview

The `IMFAFirstEnabledHook` interface enables reactions to first-time MFA enrollment, useful for congratulations emails and security milestone tracking.

The hook is **non-blocking** - errors are logged but do not affect the MFA enrollment operation.

## Interface

```typescript
interface IMFAFirstEnabledHook {
  execute(metadata: MFAFirstEnabledMetadata): Promise<void>;
}
```

## Metadata

### MFAFirstEnabledMetadata

```typescript
interface MFAFirstEnabledMetadata {
  user: IUser;
  firstMethod: MFADeviceMethod;
  deviceName?: string;
  enforcedAt: Date;
  clientInfo?: ClientInfo;
}
```

| Property      | Type              | Description                              |
| ------------- | ----------------- | ---------------------------------------- |
| `user`        | `IUser`           | User who enabled first MFA device        |
| `firstMethod` | `MFADeviceMethod` | Type of first MFA device                 |
| `deviceName`  | `string`          | Device name (user-provided label)        |
| `enforcedAt`  | `Date`            | When MFA was first enforced              |
| `clientInfo`  | `ClientInfo`      | IP, user agent, location                 |

## When Hook Fires

- User enables first MFA device via `enableMFAForUser()` when `isFirstDevice = true`

## Example

```typescript
import { IMFAFirstEnabledHook, MFAFirstEnabledMetadata } from '@nauth-toolkit/core';

export class MFAFirstEnabledConfirmationHook implements IMFAFirstEnabledHook {
  async execute(metadata: MFAFirstEnabledMetadata): Promise<void> {
    await this.emailService.sendMFAEnabledCongratulationsEmail({
      to: metadata.user.email,
      method: metadata.firstMethod,
    });
  }
}
```

## Related

- [HookRegistryService](../services/hook-registry-service) - Hook registration
- [@MFAFirstEnabledHook()](/docs/api/nestjs/decorators/mfa-first-enabled-hook) - NestJS decorator
- [MFADeviceMethod](../enums/mfa-method) - MFA method enum
- [Lifecycle Hooks Guide](/docs/features/lifecycle-hooks) - Complete hooks overview

