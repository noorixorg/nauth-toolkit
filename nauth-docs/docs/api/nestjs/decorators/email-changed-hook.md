---
title: '@EmailChangedHook()'
description: Decorator for automatic email changed hook registration in NestJS
keywords: [decorator, hooks, lifecycle, email, security]
image: /img/api-social-card.png
---
# @EmailChangedHook()

**Package:** `@nauth-toolkit/nestjs`
**Type:** Class Decorator

Class decorator that automatically registers a provider as an email changed hook. Executes after email address changes. Non-blocking - errors are logged but don't affect email change.

:::warning[Not in Main Barrel Export]
`EmailChangedHook` is not exported from the `@nauth-toolkit/nestjs` main entry point. Register this hook manually using [`HookRegistryService`](/docs/api/core/services/hook-registry-service) instead of the decorator pattern.
:::

## Overview

The `@EmailChangedHook()` decorator enables automatic hook registration. Classes decorated with this decorator are discovered at module initialization and registered with the [`HookRegistryService`](/docs/api/core/services/hook-registry-service).

**Key Features:**

- Automatic hook discovery and registration
- Full dependency injection support
- Priority-based execution ordering
- Non-blocking - errors don't affect email change

## Usage

### Basic Hook

```typescript
import { Injectable } from '@nestjs/common';
import {
  EmailChangedHook,
  IEmailChangedHook,
  EmailChangedMetadata,
} from '@nauth-toolkit/nestjs';

@Injectable()
@EmailChangedHook()
export class EmailChangedNotificationHook implements IEmailChangedHook {
  constructor(private readonly emailService: EmailService) {}

  async execute(metadata: EmailChangedMetadata): Promise<void> {
    // Alert to old email
    await this.emailService.sendEmailChangedAlertEmail({
      to: metadata.oldEmail,
      newEmail: metadata.newEmail,
    });

    // Confirmation to new email
    await this.emailService.sendEmailChangedConfirmationEmail({
      to: metadata.newEmail,
    });
  }
}
```

### With Priority

```typescript
@Injectable()
@EmailChangedHook({ priority: 1 })
export class EmailChangedEmailHook implements IEmailChangedHook {
  // Executes first
}
```

**Default Priority:** 100

### Module Registration

```typescript
import { Module } from '@nestjs/common';
import { AuthModule, NAuthHooksModule } from '@nauth-toolkit/nestjs';
import { EmailChangedNotificationHook } from './hooks/email-changed.hook';

@Module({
  imports: [
    AuthModule.forRoot(authConfig),
    NAuthHooksModule.forFeature([EmailChangedNotificationHook]),
  ],
})
export class CustomAuthModule {}
```

## Related

- [IEmailChangedHook](/docs/api/core/hooks/email-changed-hook) - Hook interface
- [HookRegistryService](/docs/api/core/services/hook-registry-service) - Hook registry
- [Lifecycle Hooks Guide](/docs/guides/lifecycle-hooks) - Complete hooks overview

