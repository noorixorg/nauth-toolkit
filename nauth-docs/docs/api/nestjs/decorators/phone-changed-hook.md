---
title: '@PhoneChangedHook()'
description: "NestJS decorator registering a provider as a phone changed hook, firing after updateUserAttributes changes a phone number and removes SMS MFA devices"
keywords: [decorator, hooks, lifecycle, phone, mfa, sms, security]
image: /img/api-social-card.png
---
# @PhoneChangedHook()

**Package:** `@nauth-toolkit/nestjs`
**Type:** Class Decorator

Class decorator that registers a provider as a phone changed hook. Executes after a phone number changes. Non-blocking - errors are logged but don't affect the change.

## Overview

The `@PhoneChangedHook()` decorator enables automatic hook registration. Classes carrying it are discovered at module initialization and registered with the [`HookRegistryService`](/docs/api/core/services/hook-registry-service).

Changing a phone number deletes the SMS MFA devices tied to the old one, and switches `mfaEnabled` off when SMS was the only factor left. This hook is where you tell the account owner.

:::note[The alert goes to the account email]
The shipped notification is addressed to the user's email, never to either phone number. An attacker who changed the number no longer controls the old one, and the new one is theirs.
:::

## Usage

```typescript title="src/hooks/phone-changed.hook.ts"
import { Injectable } from '@nestjs/common';
import { PhoneChangedHook } from '@nauth-toolkit/nestjs';
import { IPhoneChangedHook, PhoneChangedMetadata } from '@nauth-toolkit/core';

@Injectable()
@PhoneChangedHook()
export class PhoneChangedNotificationHook implements IPhoneChangedHook {
  constructor(private readonly alertService: AlertService) {}

  async execute(metadata: PhoneChangedMetadata): Promise<void> {
    await this.alertService.send(metadata.user.email, {
      newPhone: metadata.newPhone,
      removedDevices: metadata.deactivatedMFADevices,
      mfaNowOff: metadata.mfaDisabled,
    });
  }
}
```

Register it with the hooks module:

```typescript title="src/app.module.ts"
import { NAuthHooksModule } from '@nauth-toolkit/nestjs';

@Module({
  imports: [NAuthHooksModule.forFeature([PhoneChangedNotificationHook])],
})
export class AppModule {}
```

## Metadata

See [`PhoneChangedMetadata`](/docs/api/core/hooks/phone-changed-hook) for the full shape, including `deactivatedMFADevices`, `mfaDisabled`, `updateSource` and `clientInfo`.

## Related APIs

- [IPhoneChangedHook](/docs/api/core/hooks/phone-changed-hook) - Hook interface
- [@EmailChangedHook()](./email-changed-hook) - The equivalent for email changes
- [NAuthHooksModule](./nauth-hooks-module) - Hook registration module
