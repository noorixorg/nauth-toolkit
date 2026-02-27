---
title: '@AccountLockedHook()'
description: Decorator for automatic account locked hook registration in NestJS
keywords: [decorator, hooks, lifecycle, security, lockout]
image: /img/api-social-card.png
---
# @AccountLockedHook()

**Package:** `@nauth-toolkit/nestjs`
**Type:** Class Decorator

Class decorator that automatically registers a provider as an account locked hook. Executes after account lockouts triggered by failed login attempts. Non-blocking - errors are logged but don't affect lockout.

:::warning Not in Main Barrel Export
`AccountLockedHook` is not exported from the `@nauth-toolkit/nestjs` main entry point. Register this hook manually using [`HookRegistryService`](/docs/api/core/services/hook-registry-service) instead of the decorator pattern.
:::

## Overview

The `@AccountLockedHook()` decorator enables automatic hook registration. Classes decorated with this decorator are discovered at module initialization and registered with the [`HookRegistryService`](/docs/api/core/services/hook-registry-service).

**Key Features:**

- Automatic hook discovery and registration
- Full dependency injection support
- Priority-based execution ordering
- Non-blocking - errors don't affect lockout

## Usage

### Basic Hook

```typescript
import { Injectable } from '@nestjs/common';
import {
  AccountLockedHook,
  IAccountLockedHook,
  AccountLockedMetadata,
} from '@nauth-toolkit/nestjs';

@Injectable()
@AccountLockedHook()
export class AccountLockedNotificationHook implements IAccountLockedHook {
  constructor(private readonly emailService: EmailService) {}

  async execute(metadata: AccountLockedMetadata): Promise<void> {
    await this.emailService.sendAccountLockedEmail({
      to: metadata.user.email,
      lockType: metadata.lockType,
      lockedUntil: metadata.lockedUntil,
    });
  }
}
```

### With Priority

```typescript
@Injectable()
@AccountLockedHook({ priority: 1 })
export class AccountLockedEmailHook implements IAccountLockedHook {
  // Executes first
}

@Injectable()
@AccountLockedHook({ priority: 2 })
export class AccountLockedAuditHook implements IAccountLockedHook {
  // Executes second
}
```

**Default Priority:** 100

### Module Registration

```typescript
import { Module } from '@nestjs/common';
import { AuthModule, NAuthHooksModule } from '@nauth-toolkit/nestjs';
import { AccountLockedNotificationHook } from './hooks/account-locked.hook';

@Module({
  imports: [
    AuthModule.forRoot(authConfig),
    NAuthHooksModule.forFeature([AccountLockedNotificationHook]),
  ],
})
export class CustomAuthModule {}
```

## Related

- [IAccountLockedHook](/docs/api/core/hooks/account-locked-hook) - Hook interface
- [HookRegistryService](/docs/api/core/services/hook-registry-service) - Hook registry
- [Lifecycle Hooks Guide](/docs/guides/lifecycle-hooks) - Complete hooks overview

