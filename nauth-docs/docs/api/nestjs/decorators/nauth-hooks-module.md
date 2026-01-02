---
title: "NAuthHooksModule"
description: NestJS module for automatic lifecycle hook registration
sidebar_position: 3
keywords: [module, hooks, lifecycle, nestjs, registration]
image: /img/api-social-card.png
---

# NAuthHooksModule

**Package:** `@nauth-toolkit/nestjs`
**Type:** Dynamic Module

NestJS module for automatic hook registration. Discovers and registers classes decorated with [`@PreSignupHook`](./pre-signup-hook) or [`@PostSignupHook`](./post-signup-hook) at module initialization.

:::tip Import from NestJS Package
```typescript
import { NAuthHooksModule } from '@nauth-toolkit/nestjs';
```
:::

## Overview

`NAuthHooksModule` provides automatic hook discovery and registration without manual `HookRegistryService` calls. Use the static `forFeature()` method to register hook providers in feature modules.

**Key Features:**

- Automatic decorator-based hook discovery
- Feature module support for modular organization
- Priority-based execution ordering
- Global hook registry integration
- Type-safe registration

## Methods

### forFeature()

Register hooks for a feature module.

```typescript
static forFeature(hooks: Type<any>[]): DynamicModule
```

**Parameters**

| Parameter | Type         | Description                                                                        |
| --------- | ------------ | ---------------------------------------------------------------------------------- |
| `hooks`   | `Type<any>[]` | Array of hook provider classes decorated with `@PreSignupHook` or `@PostSignupHook` |

**Returns**

- `DynamicModule` - NestJS dynamic module configuration

## Usage

### Basic Registration

```typescript
import { Module } from '@nestjs/common';
import { AuthModule, NAuthHooksModule } from '@nauth-toolkit/nestjs';
import { authConfig } from './auth.config';
import { DomainValidationHook } from './hooks/domain-validation.hook';
import { WelcomeEmailHook } from './hooks/welcome-email.hook';

@Module({
  imports: [
    AuthModule.forRoot(authConfig),
    NAuthHooksModule.forFeature([
      DomainValidationHook,
      WelcomeEmailHook,
    ]),
  ],
})
export class AuthModule {}
```

### Multiple Feature Modules

You can register hooks from multiple feature modules. All hooks are registered with the global `HookRegistryService`:

```typescript
// auth/auth.module.ts
import { Module } from '@nestjs/common';
import { NAuthHooksModule } from '@nauth-toolkit/nestjs';
import { DomainValidationHook } from './hooks/domain-validation.hook';
import { WelcomeEmailHook } from './hooks/welcome-email.hook';

@Module({
  imports: [
    NAuthHooksModule.forFeature([
      DomainValidationHook,
      WelcomeEmailHook,
    ]),
  ],
})
export class AuthModule {}
```

```typescript
// analytics/analytics.module.ts
import { Module } from '@nestjs/common';
import { NAuthHooksModule } from '@nauth-toolkit/nestjs';
import { AnalyticsHook } from './hooks/analytics.hook';
import { UserTrackingHook } from './hooks/user-tracking.hook';

@Module({
  imports: [
    NAuthHooksModule.forFeature([
      AnalyticsHook,
      UserTrackingHook,
    ]),
  ],
})
export class AnalyticsModule {}
```

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { AnalyticsModule } from './analytics/analytics.module';

@Module({
  imports: [
    AuthModule,      // Registers domain validation + welcome email hooks
    AnalyticsModule, // Registers analytics + tracking hooks
  ],
})
export class AppModule {}
```

All hooks from all modules are registered globally and execute in priority order.

### With Hook Dependencies

Don't forget to provide dependencies that hooks need:

```typescript
import { Module } from '@nestjs/common';
import { NAuthHooksModule } from '@nauth-toolkit/nestjs';
import { WelcomeEmailHook } from './hooks/welcome-email.hook';
import { InviteCodeHook } from './hooks/invite-code.hook';
import { EmailService } from './services/email.service';
import { InviteService } from './services/invite.service';

@Module({
  imports: [
    NAuthHooksModule.forFeature([
      WelcomeEmailHook,  // Depends on EmailService
      InviteCodeHook,    // Depends on InviteService
    ]),
  ],
  providers: [
    EmailService,   // Provide hook dependencies
    InviteService,
  ],
})
export class AuthModule {}
```

### Organizing Hooks

**Recommended Structure:**

```
src/
├── auth/
│   ├── hooks/
│   │   ├── domain-validation.hook.ts
│   │   ├── invite-code.hook.ts
│   │   ├── welcome-email.hook.ts
│   │   └── index.ts
│   ├── services/
│   │   ├── email.service.ts
│   │   └── invite.service.ts
│   └── auth.module.ts
└── app.module.ts
```

```typescript
// hooks/index.ts
export * from './domain-validation.hook';
export * from './invite-code.hook';
export * from './welcome-email.hook';
```

```typescript
// auth.module.ts
import { Module } from '@nestjs/common';
import { NAuthHooksModule } from '@nauth-toolkit/nestjs';
import * as Hooks from './hooks';

@Module({
  imports: [
    NAuthHooksModule.forFeature([
      Hooks.DomainValidationHook,
      Hooks.InviteCodeHook,
      Hooks.WelcomeEmailHook,
    ]),
  ],
})
export class AuthModule {}
```

## How It Works

1. **Module Initialization**: `NAuthHooksModule.forFeature()` is called with hook classes
2. **Hook Discovery**: On module init, the module uses `ModuleRef` to discover all providers
3. **Metadata Check**: For each provider, checks for hook decorator metadata
4. **Registration**: Calls `HookRegistryService.registerPreSignup()` or `registerPostSignup()`
5. **Execution**: Hooks execute in priority order during authentication flows

## Execution Order

Hooks execute in priority order across all registered modules:

```typescript
// Module 1
@PreSignupHook({ priority: 1 })
export class DomainValidation { }

@PreSignupHook({ priority: 3 })
export class RateLimitCheck { }

// Module 2
@PreSignupHook({ priority: 2 })
export class InviteCodeCheck { }

// Execution order:
// 1. DomainValidation (priority 1)
// 2. InviteCodeCheck (priority 2)
// 3. RateLimitCheck (priority 3)
```

## Related APIs

- [`@PreSignupHook()`](./pre-signup-hook) - Pre-signup hook decorator
- [`@PostSignupHook()`](./post-signup-hook) - Post-signup hook decorator
- [`HookRegistryService`](/docs/api/core/services/hook-registry-service) - Hook registry service
- [`IPreSignupHookProvider`](/docs/api/core/interfaces/hook-providers#ipresignuphookprovider) - Pre-signup hook interface
- [`IPostSignupHookProvider`](/docs/api/core/interfaces/hook-providers#ipostsignuphookprovider) - Post-signup hook interface
- [Lifecycle Hooks Guide](/docs/features/lifecycle-hooks) - Complete usage guide

