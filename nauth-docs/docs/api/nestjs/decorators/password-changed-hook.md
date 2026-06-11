---
title: '@PasswordChangedHook()'
description: Decorator for automatic password changed hook registration in NestJS
keywords: [decorator, hooks, lifecycle, password, security]
image: /img/api-social-card.png
---
# @PasswordChangedHook()

**Package:** `@nauth-toolkit/nestjs`
**Type:** Class Decorator

Class decorator that automatically registers a provider as a password changed hook. Executes after password changes. Non-blocking - errors are logged but don't affect password change.

:::warning Not in Main Barrel Export
`PasswordChangedHook` is not exported from the `@nauth-toolkit/nestjs` main entry point. Register this hook manually using [`HookRegistryService`](/docs/api/core/services/hook-registry-service) instead of the decorator pattern.
:::

## Overview

The `@PasswordChangedHook()` decorator enables automatic hook registration. Classes decorated with this decorator are discovered at module initialization and registered with the [`HookRegistryService`](/docs/api/core/services/hook-registry-service).

**Key Features:**

- Automatic hook discovery and registration
- Full dependency injection support
- Priority-based execution ordering
- Non-blocking - errors don't affect password change

## Usage

### Basic Hook

```typescript
import { Injectable } from '@nestjs/common';
import {
  PasswordChangedHook,
  IPasswordChangedHook,
  PasswordChangedMetadata,
} from '@nauth-toolkit/nestjs';

@Injectable()
@PasswordChangedHook()
export class PasswordChangedEmailHook implements IPasswordChangedHook {
  constructor(private readonly emailService: EmailService) {}

  async execute(metadata: PasswordChangedMetadata): Promise<void> {
    await this.emailService.sendPasswordChangedAlert({
      to: metadata.user.email,
      changedBy: metadata.changedBy,
      sessionsRevoked: metadata.sessionsRevoked || 0,
    });
  }
}
```

### With Priority

```typescript
@Injectable()
@PasswordChangedHook({ priority: 1 })
export class PasswordChangedEmailHook implements IPasswordChangedHook {
  // Executes first
}
```

**Default Priority:** 100

### Module Registration

```typescript
import { Module } from '@nestjs/common';
import { AuthModule, NAuthHooksModule } from '@nauth-toolkit/nestjs';
import { PasswordChangedEmailHook } from './hooks/password-changed.hook';

@Module({
  imports: [
    AuthModule.forRoot(authConfig),
    NAuthHooksModule.forFeature([PasswordChangedEmailHook]),
  ],
})
export class CustomAuthModule {}
```

## Related

- [IPasswordChangedHook](/docs/api/core/hooks/password-changed-hook) - Hook interface
- [HookRegistryService](/docs/api/core/services/hook-registry-service) - Hook registry
- [Lifecycle Hooks Guide](/docs/guides/lifecycle-hooks) - Complete hooks overview

