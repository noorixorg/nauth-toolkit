---
title: '@UserProfileUpdatedHook()'
description: NestJS decorator for user profile updated hooks with automatic registration
sidebar_position: 9
keywords: [decorator, hook, profile, update, nestjs]
image: /img/api-social-card.png
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# @UserProfileUpdatedHook()

**Package:** `@nauth-toolkit/nestjs`
**Type:** Class Decorator

Marks a provider as a user profile updated hook for automatic registration with `NAuthHooksModule`.

```typescript
import { UserProfileUpdatedHook } from '@nauth-toolkit/nestjs';
```

## Overview

The `@UserProfileUpdatedHook()` decorator automatically registers a class with the `HookRegistryService` when used with `NAuthHooksModule.forFeature()`. The decorated class must implement [`IUserProfileUpdatedHook`](/docs/api/core/interfaces/user-profile-updated-hook).

:::note
Requires `NAuthHooksModule.forFeature()` to be imported in your module.
:::

## Signature

```typescript
function UserProfileUpdatedHook(options?: HookDecoratorOptions): ClassDecorator;
```

## Parameters

| Parameter | Type                   | Required | Description                      |
| --------- | ---------------------- | -------- | -------------------------------- |
| `options` | `HookDecoratorOptions` | No       | Configuration options (priority) |

### HookDecoratorOptions

| Property   | Type     | Required | Description                                        |
| ---------- | -------- | -------- | -------------------------------------------------- |
| `priority` | `number` | No       | Execution priority (lower = earlier). Default: 100 |

## Example

```typescript
import { Injectable } from '@nestjs/common';
import { UserProfileUpdatedHook, IUserProfileUpdatedHook, UserProfileUpdatedMetadata } from '@nauth-toolkit/nestjs';

@Injectable()
@UserProfileUpdatedHook({ priority: 1 })
export class CrmSyncHook implements IUserProfileUpdatedHook {
  constructor(private readonly crmService: CrmService) {}

  async execute(metadata: UserProfileUpdatedMetadata): Promise<void> {
    // Sync email changes to CRM
    const emailChange = metadata.changedFields.find((f) => f.fieldName === 'email');
    if (emailChange) {
      await this.crmService.updateContact(metadata.user.sub, {
        email: emailChange.newValue as string,
      });
    }
  }
}
```

## Registration

Register the hook using `NAuthHooksModule.forFeature()`:

```typescript
import { Module } from '@nestjs/common';
import { AuthModule, NAuthHooksModule } from '@nauth-toolkit/nestjs';
import { CrmSyncHook } from './hooks/crm-sync.hook';

@Module({
  imports: [AuthModule.forRoot(authConfig), NAuthHooksModule.forFeature([CrmSyncHook])],
})
export class AuthModule {}
```

## Hook Execution

- Executes **after** user profile attributes change
- Runs in priority order (lower priority number = earlier execution)
- **Non-blocking** - errors are logged but don't affect updates
- All hooks execute regardless of errors

## Related APIs

- [IUserProfileUpdatedHook](../../core/interfaces/user-profile-updated-hook) - Hook interface
- [NAuthHooksModule](./nauth-hooks-module) - Hook registration module
- [HookRegistryService](../../core/services/hook-registry-service) - Hook registry
