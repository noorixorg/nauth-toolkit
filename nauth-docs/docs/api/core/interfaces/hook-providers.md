---
title: Hook Provider Interfaces
description: Interfaces for implementing authentication lifecycle hooks with dependency injection support
keywords: [hooks, interfaces, lifecycle, providers, dependency injection]
image: /img/api-social-card.png
sidebar_position: 5
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# Hook Provider Interfaces

**Package:** `@nauth-toolkit/core`
**Type:** Interface

Provider interfaces for implementing authentication lifecycle hooks. These interfaces enable custom logic injection at specific points in the authentication flow with full dependency injection support.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { IPreSignupHookProvider, IAfterSignupHookProvider, SignupMetadata } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { IPreSignupHookProvider, IAfterSignupHookProvider, SignupMetadata } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { IPreSignupHookProvider, IAfterSignupHookProvider, SignupMetadata } from '@nauth-toolkit/core';
```

</TabItem>
</Tabs>

## Overview

Hook provider interfaces define the contract for implementing lifecycle hooks. Unlike config-based hooks, provider-based hooks support:

- Full dependency injection
- Class-based implementation
- Testability and reusability
- Automatic registration (NestJS decorators)

:::note
Hooks are executed in registration order. First registered = first executed.
:::

## IPreSignupHookProvider

Interface for pre-signup hooks. Executed before user creation, allows validation and blocking signups.

```typescript
interface IPreSignupHookProvider {
  execute(
    userData: Partial<IUser>,
    signupMethod: SignupMethod,
    providerId?: string | null,
    adminSignup?: boolean,
  ): Promise<void>;
}
```

**Parameters**

| Parameter | Type | Description |
|---|---|---|
| `userData` | `Partial<IUser>` | User data being created (email, firstName, lastName, etc.) |
| `signupMethod` | `'password' \| 'social' \| 'phone' \| 'email'` | Method used for signup |
| `providerId` | `string \| null` | Social provider ID (google, apple, facebook) if social signup, otherwise null |
| `adminSignup` | `boolean` | Whether this is an admin-initiated signup (via adminSignup or adminSignupSocial) |

**Returns**

- `Promise<void>` - Resolves if validation passes, throws to block signup

**Blocking Signup**

Throw [`NAuthException`](../exceptions/nauth-exception) with `AuthErrorCode.PRESIGNUP_FAILED` to block signup:

```typescript
throw new NAuthException(
  AuthErrorCode.PRESIGNUP_FAILED,
  'Email domain not allowed'
);
```

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { Injectable } from '@nestjs/common';
import { PreSignupHook, IPreSignupHookProvider, NAuthException, AuthErrorCode } from '@nauth-toolkit/nestjs';

@Injectable()
@PreSignupHook()
export class DomainValidationHook implements IPreSignupHookProvider {
  private allowedDomains = ['company.com', 'partner.com'];

  async execute(userData, signupMethod, providerId, adminSignup) {
    if (adminSignup) return; // Skip validation for admin signups

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

</TabItem>
<TabItem value="express" label="Express">

```typescript
class DomainValidationHook implements IPreSignupHookProvider {
  private allowedDomains = ['company.com', 'partner.com'];

  async execute(userData, signupMethod, providerId, adminSignup) {
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

// Register with HookRegistryService
nauth.hookRegistry.registerPreSignup(new DomainValidationHook());
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
class DomainValidationHook implements IPreSignupHookProvider {
  private allowedDomains = ['company.com', 'partner.com'];

  async execute(userData, signupMethod, providerId, adminSignup) {
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

// Register with HookRegistryService
nauth.hookRegistry.registerPreSignup(new DomainValidationHook());
```

</TabItem>
</Tabs>

---

## IAfterSignupHookProvider

Interface for after-signup hooks. Executed after successful user creation. Non-blocking - errors are logged but don't affect signup.

```typescript
interface IAfterSignupHookProvider {
  execute(user: IUser, metadata?: SignupMetadata): Promise<void>;
}
```

**Parameters**

| Parameter | Type | Description |
|---|---|---|
| `user` | `IUser` | Newly created user entity |
| `metadata` | [`SignupMetadata`](#signupmetadata) | Optional metadata about the signup |

**Returns**

- `Promise<void>` - Errors are caught and logged

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { Injectable } from '@nestjs/common';
import { AfterSignupHook, IAfterSignupHookProvider } from '@nauth-toolkit/nestjs';

@Injectable()
@AfterSignupHook()
export class WelcomeEmailHook implements IAfterSignupHookProvider {
  constructor(private emailService: EmailService) {}

  async execute(user, metadata) {
    await this.emailService.sendWelcome({
      to: user.email,
      firstName: user.firstName,
      signupMethod: metadata?.signupType,
    });
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
class WelcomeEmailHook implements IAfterSignupHookProvider {
  constructor(private emailService: EmailService) {}

  async execute(user, metadata) {
    await this.emailService.sendWelcome({
      to: user.email,
      firstName: user.firstName,
      signupMethod: metadata?.signupType,
    });
  }
}

// Register
nauth.hookRegistry.registerAfterSignup(new WelcomeEmailHook(emailService));
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
class WelcomeEmailHook implements IAfterSignupHookProvider {
  constructor(private emailService: EmailService) {}

  async execute(user, metadata) {
    await this.emailService.sendWelcome({
      to: user.email,
      firstName: user.firstName,
      signupMethod: metadata?.signupType,
    });
  }
}

// Register
nauth.hookRegistry.registerAfterSignup(new WelcomeEmailHook(emailService));
```

</TabItem>
</Tabs>

---

## SignupMetadata

Metadata interface passed to after-signup hooks providing context about the signup event.

```typescript
interface SignupMetadata {
  requiresVerification?: boolean;
  signupType?: 'password' | 'social';
  provider?: string;
  adminSignup?: boolean;
}
```

**Properties**

| Property | Type | Description |
|---|---|---|
| `requiresVerification` | `boolean` | Whether user needs to complete verification challenge |
| `signupType` | `'password' \| 'social'` | Type of signup performed |
| `provider` | `string` | Social provider name (google, apple, facebook) if social signup |
| `adminSignup` | `boolean` | Whether signup was initiated by admin |

---

## Related APIs

- [HookRegistryService](../services/hook-registry-service) - Hook registration and execution
- [NAuthException](../exceptions/nauth-exception) - Error handling
- [Lifecycle Hooks Guide](/docs/guides/lifecycle-hooks) - Complete usage guide

