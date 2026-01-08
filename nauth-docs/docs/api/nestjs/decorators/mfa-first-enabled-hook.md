---
title: '@MFAFirstEnabledHook()'
description: Decorator for automatic MFA first enabled hook registration in NestJS
keywords: [decorator, hooks, lifecycle, mfa, security]
image: /img/api-social-card.png
---
# @MFAFirstEnabledHook()

**Package:** `@nauth-toolkit/nestjs`
**Type:** Class Decorator

Class decorator that automatically registers a provider as an MFA first enabled hook. Executes when user enables their first MFA device. Non-blocking - errors are logged but don't affect enrollment.

:::tip Import from NestJS Package

```typescript
import { MFAFirstEnabledHook } from '@nauth-toolkit/nestjs';
```

:::

## Overview

The `@MFAFirstEnabledHook()` decorator enables automatic hook registration. Classes decorated with this decorator are discovered at module initialization and registered with the [`HookRegistryService`](/docs/api/core/services/hook-registry-service).

**Key Features:**

- Automatic hook discovery and registration
- Full dependency injection support
- Priority-based execution ordering
- Non-blocking - errors don't affect enrollment

## Usage

### Basic Hook

```typescript
import { Injectable } from '@nestjs/common';
import {
  MFAFirstEnabledHook,
  IMFAFirstEnabledHook,
  MFAFirstEnabledMetadata,
} from '@nauth-toolkit/nestjs';

@Injectable()
@MFAFirstEnabledHook()
export class MFAFirstEnabledConfirmationHook implements IMFAFirstEnabledHook {
  constructor(private readonly emailService: EmailService) {}

  async execute(metadata: MFAFirstEnabledMetadata): Promise<void> {
    await this.emailService.sendMFAEnabledCongratulationsEmail({
      to: metadata.user.email,
      method: metadata.firstMethod,
    });
  }
}
```

### With Priority

```typescript
@Injectable()
@MFAFirstEnabledHook({ priority: 1 })
export class MFAFirstEnabledEmailHook implements IMFAFirstEnabledHook {
  // Executes first
}
```

**Default Priority:** 100

### Module Registration

```typescript
import { Module } from '@nestjs/common';
import { AuthModule, NAuthHooksModule } from '@nauth-toolkit/nestjs';
import { MFAFirstEnabledConfirmationHook } from './hooks/mfa-first-enabled.hook';

@Module({
  imports: [
    AuthModule.forRoot(authConfig),
    NAuthHooksModule.forFeature([MFAFirstEnabledConfirmationHook]),
  ],
})
export class CustomAuthModule {}
```

## Related

- [IMFAFirstEnabledHook](/docs/api/core/hooks/mfa-first-enabled-hook) - Hook interface
- [HookRegistryService](/docs/api/core/services/hook-registry-service) - Hook registry
- [Lifecycle Hooks Guide](/docs/features/lifecycle-hooks) - Complete hooks overview

