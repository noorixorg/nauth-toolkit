---
title: IMFADeviceRemovedHook
description: Hook interface for MFA device removal events
keywords: [hooks, mfa, security, interface]
image: /img/api-social-card.png
---
# IMFADeviceRemovedHook

Hook interface for executing actions after MFA device removal.

## Overview

The `IMFADeviceRemovedHook` interface enables reactions to MFA device removal events, whether initiated by users or system automation.

The hook is **non-blocking** - errors are logged but do not affect the removal operation.

## Interface

```typescript
interface IMFADeviceRemovedHook {
  execute(metadata: MFADeviceRemovedMetadata): Promise<void>;
}
```

## Metadata

### MFADeviceRemovedMetadata

```typescript
interface MFADeviceRemovedMetadata {
  user: IUser;
  deviceType: MFADeviceMethod;
  deviceName?: string;
  removedBy: 'user' | 'system';
  reason?: string;
  remainingDeviceCount: number;
  clientInfo?: ClientInfo;
}
```

| Property               | Type                   | Description                              |
| ---------------------- | ---------------------- | ---------------------------------------- |
| `user`                 | `IUser`                | User whose device was removed            |
| `deviceType`           | `MFADeviceMethod`      | Type of MFA device removed               |
| `deviceName`           | `string`               | Device name (user-provided label)        |
| `removedBy`            | `'user' \| 'system'`   | Who removed the device                   |
| `reason`               | `string`               | Reason for removal                       |
| `remainingDeviceCount` | `number`               | MFA devices remaining after removal      |
| `clientInfo`           | `ClientInfo`           | IP, user agent, location                 |

## When Hook Fires

- User removes MFA device via `removeDevices()`
- System removes device due to email/phone change via `updateUserAttributes()`

## Example

```typescript
import { IMFADeviceRemovedHook, MFADeviceRemovedMetadata } from '@nauth-toolkit/core';

export class MFADeviceRemovedAlertHook implements IMFADeviceRemovedHook {
  async execute(metadata: MFADeviceRemovedMetadata): Promise<void> {
    await this.emailService.sendMFADeviceRemovedEmail({
      to: metadata.user.email,
      deviceType: metadata.deviceType,
      remainingDevices: metadata.remainingDeviceCount,
    });
  }
}
```

## Related

- [HookRegistryService](../services/hook-registry-service) - Hook registration
- [@MFADeviceRemovedHook()](/docs/api/nestjs/decorators/mfa-device-removed-hook) - NestJS decorator
- [MFADeviceMethod](../enums/mfa-method) - MFA method enum
- [Lifecycle Hooks Guide](/docs/features/lifecycle-hooks) - Complete hooks overview

