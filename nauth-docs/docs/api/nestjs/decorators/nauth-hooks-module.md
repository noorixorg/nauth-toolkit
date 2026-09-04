---
title: "NAuthHooksModule"
description: NestJS module for automatic lifecycle hook registration
keywords: [module, hooks, lifecycle, nestjs, registration]
image: /img/api-social-card.png
---
# NAuthHooksModule

**Package:** `@nauth-toolkit/nestjs`
**Type:** Dynamic Module

NestJS module for automatic hook registration. Discovers and registers classes decorated with any of the 11 lifecycle hook decorators at module initialization.

:::tip[Import from NestJS Package]
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

**Supported Hook Decorators:**

| Decorator | Hook Type | When It Fires |
| --------- | --------- | ------------- |
| `@PreSignupHook` | `preSignup` | Before a user account is created |
| `@PostSignupHook` | `postSignup` | After a user account is created |
| `@UserProfileUpdatedHook` | `userProfileUpdated` | After user profile attributes change |
| `@PasswordChangedHook` | `passwordChanged` | After a password is changed |
| `@MFADeviceRemovedHook` | `mfaDeviceRemoved` | After an MFA device is removed |
| `@AdaptiveMFARiskDetectedHook` | `adaptiveMfaRiskDetected` | When high-risk signin activity is detected |
| `@AccountStatusChangedHook` | `accountStatusChanged` | After an account is enabled or disabled |
| `@EmailChangedHook` | `emailChanged` | After a user's email address is changed |
| `@AccountLockedHook` | `accountLocked` | After an account is locked due to failed login attempts |
| `@SessionsRevokedHook` | `sessionsRevoked` | After user sessions are bulk revoked |
| `@MFAFirstEnabledHook` | `mfaFirstEnabled` | After a user enables MFA for the first time |

## Methods

### forFeature()

Register hooks for a feature module.

```typescript
static forFeature(hooks: Type<any>[]): DynamicModule
```

**Parameters**

| Parameter | Type         | Description                                                                        |
| --------- | ------------ | ---------------------------------------------------------------------------------- |
| `hooks`   | `Type<any>[]` | Array of hook provider classes decorated with any lifecycle hook decorator |

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
3. **Metadata Check**: For each provider, checks for lifecycle hook decorator metadata
4. **Registration**: Calls the appropriate `HookRegistryService` registration method based on the hook type
5. **Execution**: Hooks execute in priority order during the corresponding authentication lifecycle events

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
- [`@UserProfileUpdatedHook()`](./user-profile-updated-hook) - User profile updated hook decorator
- [`@PasswordChangedHook()`](./password-changed-hook) - Password changed hook decorator
- [`@MFADeviceRemovedHook()`](./mfa-device-removed-hook) - MFA device removed hook decorator
- [`@AdaptiveMFARiskDetectedHook()`](./adaptive-mfa-risk-detected-hook) - Adaptive MFA risk detected hook decorator
- [`@AccountStatusChangedHook()`](./account-status-changed-hook) - Account status changed hook decorator
- [`@EmailChangedHook()`](./email-changed-hook) - Email changed hook decorator
- [`@AccountLockedHook()`](./account-locked-hook) - Account locked hook decorator
- [`@SessionsRevokedHook()`](./sessions-revoked-hook) - Sessions revoked hook decorator
- [`@MFAFirstEnabledHook()`](./mfa-first-enabled-hook) - MFA first enabled hook decorator
- [`HookRegistryService`](/docs/api/core/services/hook-registry-service) - Hook registry service
- [`IPreSignupHookProvider`](/docs/api/core/hooks/pre-signup-hook-provider) - Pre-signup hook interface
- [`IPostSignupHookProvider`](/docs/api/core/hooks/post-signup-hook-provider) - Post-signup hook interface
- [Lifecycle Hooks Guide](/docs/guides/lifecycle-hooks) - Complete usage guide

