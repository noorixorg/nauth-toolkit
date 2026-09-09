---
title: IPhoneChangedHook
description: "Hook interface for phone number change events: PhoneChangedMetadata with oldPhone, newPhone, deactivatedMFADevices, mfaDisabled, updateSource and clientInfo"
keywords: [hooks, phone, mfa, sms, security, interface]
image: /img/api-social-card.png
---
# IPhoneChangedHook

Hook interface for executing actions after a phone number changes.

## Overview

Changing a phone number is destructive to account security: nauth-toolkit clears `isPhoneVerified`, deletes every SMS MFA device tied to the old number, and switches `mfaEnabled` off if SMS was the only remaining factor. This hook is how the account owner finds out.

The hook is **non-blocking** - errors are logged but do not affect the phone change operation.

:::note[The alert goes to the account email]
The shipped notification is addressed to the user's email, never to either phone number. A phone change is routine, so the mailbox is the stable channel, and notifying the old number fails exactly when it matters: an attacker who changed it no longer controls it.
:::

## Interface

```typescript
interface IPhoneChangedHook {
  execute(metadata: PhoneChangedMetadata): Promise<void>;
}
```

## Metadata

### PhoneChangedMetadata

```typescript
interface PhoneChangedMetadata {
  user: IUser;
  oldPhone: string | null;
  newPhone: string;
  updateSource: UserProfileUpdateSource;
  deactivatedMFADevices?: number;
  mfaDisabled?: boolean;
  clientInfo?: ClientInfo;
}
```

| Property | Type | Description |
| --- | --- | --- |
| `clientInfo` | `ClientInfo` | IP address, user agent and location of the request that made the change |
| `deactivatedMFADevices` | `number` | SMS MFA devices deleted because they were tied to the old number |
| `mfaDisabled` | `boolean` | True when that removal left no factors at all, so `mfaEnabled` was turned off |
| `newPhone` | `string` | Phone number after the change |
| `oldPhone` | `string \| null` | Phone number before the change, `null` when the account had none |
| `updateSource` | `UserProfileUpdateSource` | `'user_request'` or `'admin_action'` |
| `user` | `IUser` | User whose phone number changed |

## Usage

```typescript title="src/hooks/phone-changed.hook.ts"
import { IPhoneChangedHook, PhoneChangedMetadata } from '@nauth-toolkit/core';

export class PhoneChangedNotificationHook implements IPhoneChangedHook {
  async execute(metadata: PhoneChangedMetadata): Promise<void> {
    const { user, newPhone, deactivatedMFADevices, mfaDisabled } = metadata;

    await this.alertService.send(user.email, {
      newPhone,
      removedDevices: deactivatedMFADevices,
      mfaNowOff: mfaDisabled,
    });
  }
}
```

Register it with [`HookRegistryService.registerPhoneChanged()`](/docs/api/core/services/hook-registry-service), or on NestJS with the [`@PhoneChangedHook()`](/docs/api/nestjs/decorators/phone-changed-hook) decorator.

## Built-in Notification

The `phoneChanged` email template ships with the toolkit and is suppressed by default like every other optional notification. Enable it in config:

```typescript title="src/config/auth.config.ts"
emailNotifications: {
  enabled: true,
  suppress: {
    phoneChanged: false,
  },
}
```

See [Notifications](/docs/concepts/notifications) for the template variables.

## Related APIs

- [IEmailChangedHook](./email-changed-hook) - The equivalent for email changes
- [IMFADeviceRemovedHook](./mfa-device-removed-hook) - Fires alongside this when SMS devices are removed
- [HookRegistryService](/docs/api/core/services/hook-registry-service) - Registration and execution
