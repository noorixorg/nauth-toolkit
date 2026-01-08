---
title: '@AccountStatusChangedHook()'
description: Decorator for automatic account status changed hook registration in NestJS
keywords: [decorator, hooks, lifecycle, account, status]
image: /img/api-social-card.png
---
# @AccountStatusChangedHook()

**Package:** `@nauth-toolkit/nestjs`
**Type:** Class Decorator

Class decorator that automatically registers a provider as an account status changed hook. Executes after account enable/disable operations. Non-blocking - errors are logged but don't affect status change.

:::tip Import from NestJS Package

```typescript
import { AccountStatusChangedHook } from '@nauth-toolkit/nestjs';
```

:::

## Overview

The `@AccountStatusChangedHook()` decorator enables automatic hook registration. Classes decorated with this decorator are discovered at module initialization and registered with the [`HookRegistryService`](/docs/api/core/services/hook-registry-service).

**Key Features:**

- Automatic hook discovery and registration
- Full dependency injection support
- Priority-based execution ordering
- Non-blocking - errors don't affect status change

## Usage

### Basic Hook

```typescript
import { Injectable } from '@nestjs/common';
import {
  AccountStatusChangedHook,
  IAccountStatusChangedHook,
  AccountStatusChangedMetadata,
} from '@nauth-toolkit/nestjs';

@Injectable()
@AccountStatusChangedHook()
export class AccountStatusNotificationHook implements IAccountStatusChangedHook {
  constructor(private readonly emailService: EmailService) {}

  async execute(metadata: AccountStatusChangedMetadata): Promise<void> {
    if (metadata.status === 'disabled') {
      await this.emailService.sendAccountDisabledEmail({
        to: metadata.user.email,
        reason: metadata.reason,
      });
    }
  }
}
```

### With Priority

```typescript
@Injectable()
@AccountStatusChangedHook({ priority: 1 })
export class AccountStatusEmailHook implements IAccountStatusChangedHook {
  // Executes first
}
```

**Default Priority:** 100

### Module Registration

```typescript
import { Module } from '@nestjs/common';
import { AuthModule, NAuthHooksModule } from '@nauth-toolkit/nestjs';
import { AccountStatusNotificationHook } from './hooks/account-status.hook';

@Module({
  imports: [
    AuthModule.forRoot(authConfig),
    NAuthHooksModule.forFeature([AccountStatusNotificationHook]),
  ],
})
export class CustomAuthModule {}
```

## Related

- [IAccountStatusChangedHook](/docs/api/core/hooks/account-status-changed-hook) - Hook interface
- [HookRegistryService](/docs/api/core/services/hook-registry-service) - Hook registry
- [Lifecycle Hooks Guide](/docs/features/lifecycle-hooks) - Complete hooks overview

