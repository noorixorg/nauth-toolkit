---
title: "@PreSignupHook()"
description: Decorator for automatic pre-signup hook registration in NestJS
sidebar_position: 5
keywords: [decorator, hooks, lifecycle, presignup, validation]
image: /img/api-social-card.png
---

# @PreSignupHook()

**Package:** `@nauth-toolkit/nestjs`
**Type:** Class Decorator

Class decorator that automatically registers a provider as a pre-signup hook. Pre-signup hooks execute before user creation and can block signups by throwing exceptions.

:::tip Import from NestJS Package
```typescript
import { PreSignupHook } from '@nauth-toolkit/nestjs';
```
:::

## Overview

The `@PreSignupHook()` decorator enables automatic hook registration without manual setup. Classes decorated with this decorator are discovered at module initialization and registered with the [`HookRegistryService`](/docs/api/core/services/hook-registry-service).

**Key Features:**

- Automatic hook discovery and registration
- No manual registry calls required
- Full dependency injection support
- Priority-based execution ordering
- Type-safe with TypeScript

**When Pre-Signup Hooks Execute:**

- Password signup (before user saved to database)
- Social signup (before user creation)
- Admin signup (`adminSignup` and `adminSignupSocial`)

## Usage

### Basic Hook

```typescript
import { Injectable } from '@nestjs/common';
import {
  PreSignupHook,
  IPreSignupHookProvider,
  NAuthException,
  AuthErrorCode,
} from '@nauth-toolkit/nestjs';

@Injectable()
@PreSignupHook()
export class DomainValidationHook implements IPreSignupHookProvider {
  private readonly allowedDomains = ['company.com', 'partner.com'];

  async execute(userData, signupMethod, providerId, adminSignup) {
    // Skip validation for admin-initiated signups
    if (adminSignup) return;

    const domain = userData.email?.split('@')[1];
    if (domain && !this.allowedDomains.includes(domain)) {
      throw new NAuthException(
        AuthErrorCode.PRESIGNUP_FAILED,
        `Domain ${domain} not allowed`
      );
    }
  }
}
```

### With Priority

Control execution order using the `priority` option. Lower priority values execute first:

```typescript
import { Injectable } from '@nestjs/common';
import { PreSignupHook, IPreSignupHookProvider } from '@nauth-toolkit/nestjs';

@Injectable()
@PreSignupHook({ priority: 1 })  // Executes first
export class DomainValidationHook implements IPreSignupHookProvider {
  async execute(userData, signupMethod, providerId, adminSignup) {
    // Domain validation logic
  }
}

@Injectable()
@PreSignupHook({ priority: 2 })  // Executes second
export class InviteCodeHook implements IPreSignupHookProvider {
  async execute(userData, signupMethod, providerId, adminSignup) {
    // Invite code validation logic
  }
}
```

**Default Priority:** If not specified, priority defaults to `100`.

### With Dependency Injection

Hooks support full NestJS dependency injection:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import {
  PreSignupHook,
  IPreSignupHookProvider,
  NAuthException,
  AuthErrorCode,
} from '@nauth-toolkit/nestjs';
import { InviteService } from '../services/invite.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
@PreSignupHook()
export class InviteCodeHook implements IPreSignupHookProvider {
  private readonly logger = new Logger(InviteCodeHook.name);

  constructor(
    private readonly inviteService: InviteService,
    private readonly config: ConfigService,
  ) {}

  async execute(userData, signupMethod, providerId, adminSignup) {
    if (adminSignup) return;

    const inviteCode = userData.metadata?.inviteCode;
    if (!inviteCode) {
      throw new NAuthException(
        AuthErrorCode.PRESIGNUP_FAILED,
        'Invite code required'
      );
    }

    const isValid = await this.inviteService.validate(inviteCode);
    if (!isValid) {
      this.logger.warn(`Invalid invite code: ${inviteCode}`);
      throw new NAuthException(
        AuthErrorCode.PRESIGNUP_FAILED,
        'Invalid invite code'
      );
    }
  }
}
```

### Module Registration

Register hooks using `NAuthHooksModule.forFeature()`:

```typescript
import { Module } from '@nestjs/common';
import { AuthModule, NAuthHooksModule } from '@nauth-toolkit/nestjs';
import { authConfig } from './auth.config';
import { DomainValidationHook } from './hooks/domain-validation.hook';
import { InviteCodeHook } from './hooks/invite-code.hook';

@Module({
  imports: [
    AuthModule.forRoot(authConfig),
    NAuthHooksModule.forFeature([
      DomainValidationHook,
      InviteCodeHook,
    ]),
  ],
  providers: [InviteService],  // Don't forget hook dependencies
})
export class CustomAuthModule {}
```

## Blocking Signups

Pre-signup hooks can block signups by throwing [`NAuthException`](/docs/api/core/exceptions/nauth-exception) with code `PRESIGNUP_FAILED`:

```typescript
throw new NAuthException(
  AuthErrorCode.PRESIGNUP_FAILED,
  'Custom error message shown to user'
);
```

The user receives a `400 Bad Request` response with your custom message.

**Execution Behavior:**

- First hook to throw an exception stops execution
- Subsequent hooks are skipped
- Signup is blocked

## Testing

Hooks are regular NestJS providers and can be unit tested:

```typescript
import { Test } from '@nestjs/testing';
import { DomainValidationHook } from './domain-validation.hook';
import { NAuthException, AuthErrorCode } from '@nauth-toolkit/core';

describe('DomainValidationHook', () => {
  let hook: DomainValidationHook;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [DomainValidationHook],
    }).compile();

    hook = module.get(DomainValidationHook);
  });

  it('should allow valid domain', async () => {
    const userData = { email: 'user@company.com' };
    await expect(
      hook.execute(userData, 'password', null, false)
    ).resolves.not.toThrow();
  });

  it('should block invalid domain', async () => {
    const userData = { email: 'user@blocked.com' };
    await expect(
      hook.execute(userData, 'password', null, false)
    ).rejects.toThrow(NAuthException);
  });

  it('should skip validation for admin signups', async () => {
    const userData = { email: 'user@blocked.com' };
    await expect(
      hook.execute(userData, 'password', null, true)
    ).resolves.not.toThrow();
  });
});
```

## Related APIs

- [`IPreSignupHookProvider`](/docs/api/core/interfaces/hook-providers#ipresignuphookprovider) - Pre-signup hook interface
- [`@PostSignupHook()`](./post-signup-hook) - Post-signup hook decorator
- [`HookRegistryService`](/docs/api/core/services/hook-registry-service) - Hook registry service
- [`NAuthHooksModule`](./nauth-hooks-module) - Hook registration module
- [Lifecycle Hooks Guide](/docs/features/lifecycle-hooks) - Complete usage guide

