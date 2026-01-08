---
title: '@MFADeviceRemovedHook()'
description: Decorator for automatic MFA device removed hook registration in NestJS
keywords: [decorator, hooks, lifecycle, mfa, security]
image: /img/api-social-card.png
---
# @MFADeviceRemovedHook()

**Package:** `@nauth-toolkit/nestjs`
**Type:** Class Decorator

Class decorator that automatically registers a provider as an MFA device removed hook. Executes after MFA device removal. Non-blocking - errors are logged but don't affect removal.

:::tip Import from NestJS Package

```typescript
import { MFADeviceRemovedHook } from '@nauth-toolkit/nestjs';
```

:::

## Overview

The `@MFADeviceRemovedHook()` decorator enables automatic hook registration. Classes decorated with this decorator are discovered at module initialization and registered with the [`HookRegistryService`](/docs/api/core/services/hook-registry-service).

**Key Features:**

- Automatic hook discovery and registration
- Full dependency injection support
- Priority-based execution ordering
- Non-blocking - errors don't affect removal

## Usage

### Basic Hook

```typescript
import { Injectable } from '@nestjs/common';
import {
  MFADeviceRemovedHook,
  IMFADeviceRemovedHook,
  MFADeviceRemovedMetadata,
} from '@nauth-toolkit/nestjs';

@Injectable()
@MFADeviceRemovedHook()
export class MFADeviceRemovedAlertHook implements IMFADeviceRemovedHook {
  constructor(private readonly emailService: EmailService) {}

  async execute(metadata: MFADeviceRemovedMetadata): Promise<void> {
    await this.emailService.sendMFADeviceRemovedEmail({
      to: metadata.user.email,
      deviceType: metadata.deviceType,
      remainingDevices: metadata.remainingDeviceCount,
    });
  }
}
```

### With Priority

```typescript
@Injectable()
@MFADeviceRemovedHook({ priority: 1 })
export class MFADeviceRemovedEmailHook implements IMFADeviceRemovedHook {
  // Executes first
}
```

**Default Priority:** 100

### Module Registration

```typescript
import { Module } from '@nestjs/common';
import { AuthModule, NAuthHooksModule } from '@nauth-toolkit/nestjs';
import { MFADeviceRemovedAlertHook } from './hooks/mfa-device-removed.hook';

@Module({
  imports: [
    AuthModule.forRoot(authConfig),
    NAuthHooksModule.forFeature([MFADeviceRemovedAlertHook]),
  ],
})
export class CustomAuthModule {}
```

## Related

- [IMFADeviceRemovedHook](/docs/api/core/hooks/mfa-device-removed-hook) - Hook interface
- [HookRegistryService](/docs/api/core/services/hook-registry-service) - Hook registry
- [Lifecycle Hooks Guide](/docs/features/lifecycle-hooks) - Complete hooks overview

