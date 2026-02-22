---
title: '@SessionsRevokedHook()'
description: Decorator for automatic sessions revoked hook registration in NestJS
keywords: [decorator, hooks, lifecycle, sessions, security]
image: /img/api-social-card.png
---
# @SessionsRevokedHook()

**Package:** `@nauth-toolkit/nestjs`
**Type:** Class Decorator

Class decorator that automatically registers a provider as a sessions revoked hook. Executes after bulk session revocations. Non-blocking - errors are logged but don't affect revocation.

:::tip Import from NestJS Package

```typescript
import { SessionsRevokedHook } from '@nauth-toolkit/nestjs';
```

:::

## Overview

The `@SessionsRevokedHook()` decorator enables automatic hook registration. Classes decorated with this decorator are discovered at module initialization and registered with the [`HookRegistryService`](/docs/api/core/services/hook-registry-service).

**Key Features:**

- Automatic hook discovery and registration
- Full dependency injection support
- Priority-based execution ordering
- Non-blocking - errors don't affect revocation

## Usage

### Basic Hook

```typescript
import { Injectable } from '@nestjs/common';
import {
  SessionsRevokedHook,
  ISessionsRevokedHook,
  SessionsRevokedMetadata,
} from '@nauth-toolkit/nestjs';

@Injectable()
@SessionsRevokedHook()
export class SessionsRevokedAlertHook implements ISessionsRevokedHook {
  constructor(private readonly emailService: EmailService) {}

  async execute(metadata: SessionsRevokedMetadata): Promise<void> {
    await this.emailService.sendSessionsRevokedEmail({
      to: metadata.user.email,
      revokedCount: metadata.revokedCount,
      reason: metadata.reason,
    });
  }
}
```

### With Priority

```typescript
@Injectable()
@SessionsRevokedHook({ priority: 1 })
export class SessionsRevokedEmailHook implements ISessionsRevokedHook {
  // Executes first
}
```

**Default Priority:** 100

### Module Registration

```typescript
import { Module } from '@nestjs/common';
import { AuthModule, NAuthHooksModule } from '@nauth-toolkit/nestjs';
import { SessionsRevokedAlertHook } from './hooks/sessions-revoked.hook';

@Module({
  imports: [
    AuthModule.forRoot(authConfig),
    NAuthHooksModule.forFeature([SessionsRevokedAlertHook]),
  ],
})
export class CustomAuthModule {}
```

## Related

- [ISessionsRevokedHook](/docs/api/core/hooks/sessions-revoked-hook) - Hook interface
- [HookRegistryService](/docs/api/core/services/hook-registry-service) - Hook registry
- [Lifecycle Hooks Guide](/docs/guides/lifecycle-hooks) - Complete hooks overview

