---
title: IMFAMethodAddedHook
description: Hook interface for MFA method additions (after enrollment changes)
keywords: [hooks, mfa, security, interface]
image: /img/api-social-card.png
---
# IMFAMethodAddedHook

Hook interface for executing actions when a user adds an MFA method (e.g., enabling Passkey after already having TOTP).

## Overview

The `IMFAMethodAddedHook` interface enables reactions to MFA enrollment changes, useful for security alert emails and audit/analytics tracking.

The hook is **non-blocking** - errors are logged but do not affect the MFA enrollment operation.

## Interface

```typescript
interface IMFAMethodAddedHook {
  execute(metadata: MFAMethodAddedMetadata): Promise<void>;
}
```

## Metadata

### MFAMethodAddedMetadata

```typescript
interface MFAMethodAddedMetadata {
  user: IUser;
  method: MFADeviceMethod;
  deviceName?: string;
  isFirstMethod: boolean;
  enabledMethods: MFADeviceMethod[];
  timestamp: Date;
  clientInfo?: ClientInfo;
}
```

| Property         | Type              | Description                                            |
| ---------------- | ----------------- | ------------------------------------------------------ |
| `user`           | `IUser`           | User who added an MFA method                           |
| `method`         | `MFADeviceMethod` | MFA method that was added                              |
| `deviceName`     | `string`          | Device name (optional, user-provided label)            |
| `isFirstMethod`  | `boolean`         | Whether this addition is also the user's first method  |
| `enabledMethods` | `MFADeviceMethod[]` | Enabled MFA methods after the change                 |
| `timestamp`      | `Date`            | Event timestamp                                        |
| `clientInfo`     | `ClientInfo`      | IP, user agent, location                               |

## When Hook Fires

- When the toolkit adds an MFA method for a user (TOTP/SMS/Email/Passkey).

## Example

```typescript
import { IMFAMethodAddedHook, MFAMethodAddedMetadata } from '@nauth-toolkit/core';

export class MFAMethodAddedSecurityAlertHook implements IMFAMethodAddedHook {
  async execute(metadata: MFAMethodAddedMetadata): Promise<void> {
    // Example: log or notify security systems
    await this.securityLog.write({
      userId: metadata.user.sub,
      event: 'mfa_method_added',
      method: metadata.method,
      enabledMethods: metadata.enabledMethods,
      at: metadata.timestamp,
      ipAddress: metadata.clientInfo?.ipAddress,
    });
  }
}
```

## Related

- [HookRegistryService](../services/hook-registry-service) - Hook registration
- [MFADeviceMethod](../enums/mfa-method) - MFA method enum
- [Lifecycle Hooks Guide](/docs/features/lifecycle-hooks) - Complete hooks overview

