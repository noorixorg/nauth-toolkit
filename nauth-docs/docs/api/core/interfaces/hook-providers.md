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
import { IPreSignupHookProvider, IPostSignupHookProvider, SignupMetadata } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { IPreSignupHookProvider, IPostSignupHookProvider, SignupMetadata } from '@nauth-toolkit/core';
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { IPreSignupHookProvider, IPostSignupHookProvider, SignupMetadata } from '@nauth-toolkit/core';
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
    data: PreSignupHookData,
    signupType: 'password' | 'social',
    provider?: string,
    adminSignup?: boolean,
  ): Promise<void>;
}
```

**Parameters**

| Parameter     | Type                     | Description                                                                                  |
| ------------- | ------------------------ | -------------------------------------------------------------------------------------------- |
| `data`        | `PreSignupHookData`      | `SignupDTO` or `AdminSignupDTO` for password signup, `OAuthUserProfile` for social signup    |
| `signupType`  | `'password' \| 'social'` | Type of signup being performed                                                               |
| `provider`    | `string`                 | Social provider name (e.g., 'google', 'apple', 'facebook') - only present for social signups |
| `adminSignup` | `boolean`                | Whether this is an admin-initiated signup (via `adminSignup()` or `adminSignupSocial()`)     |

**Returns**

- `Promise<void>` - Resolves if validation passes, throws to block signup

**Blocking Signup**

Throw [`NAuthException`](../exceptions/nauth-exception) with `AuthErrorCode.PRESIGNUP_FAILED` to block signup:

```typescript
throw new NAuthException(AuthErrorCode.PRESIGNUP_FAILED, 'Email domain not allowed');
```

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { Injectable } from '@nestjs/common';
import {
  PreSignupHook,
  IPreSignupHookProvider,
  PreSignupHookData,
  SignupDTO,
  AdminSignupDTO,
  OAuthUserProfile,
  NAuthException,
  AuthErrorCode,
} from '@nauth-toolkit/nestjs';

@Injectable()
@PreSignupHook()
export class DomainValidationHook implements IPreSignupHookProvider {
  private allowedDomains = ['company.com', 'partner.com'];

  async execute(
    data: PreSignupHookData,
    signupType: 'password' | 'social',
    provider?: string,
    adminSignup?: boolean,
  ): Promise<void> {
    if (adminSignup) return; // Skip validation for admin signups

    let email: string | null | undefined;

    if (signupType === 'password') {
      const dto = data as SignupDTO | AdminSignupDTO;
      email = dto.email;
    } else if (signupType === 'social') {
      const profile = data as OAuthUserProfile;
      email = profile.email;
    }

    if (email) {
      const domain = email.split('@')[1];
      if (domain && !this.allowedDomains.includes(domain)) {
        throw new NAuthException(AuthErrorCode.PRESIGNUP_FAILED, `Domain ${domain} not allowed`);
      }
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
      throw new NAuthException(AuthErrorCode.PRESIGNUP_FAILED, `Domain ${domain} not allowed`);
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
      throw new NAuthException(AuthErrorCode.PRESIGNUP_FAILED, `Domain ${domain} not allowed`);
    }
  }
}

// Register with HookRegistryService
nauth.hookRegistry.registerPreSignup(new DomainValidationHook());
```

</TabItem>
</Tabs>

---

## IPostSignupHookProvider

Interface for post-signup hooks. Executed after successful user creation. Non-blocking - errors are logged but don't affect signup.

```typescript
interface IPostSignupHookProvider {
  execute(user: IUser, metadata?: SignupMetadata): Promise<void>;
}
```

**Parameters**

| Parameter  | Type                                | Description                        |
| ---------- | ----------------------------------- | ---------------------------------- |
| `user`     | `IUser`                             | Newly created user entity          |
| `metadata` | [`SignupMetadata`](#signupmetadata) | Optional metadata about the signup |

**Returns**

- `Promise<void>` - Errors are caught and logged

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { Injectable } from '@nestjs/common';
import { PostSignupHook, IPostSignupHookProvider, IUser, SignupMetadata } from '@nauth-toolkit/nestjs';

@Injectable()
@PostSignupHook()
export class WelcomeEmailHook implements IPostSignupHookProvider {
  constructor(private emailService: EmailService) {}

  async execute(user: IUser, metadata?: SignupMetadata): Promise<void> {
    await this.emailService.sendWelcome({
      to: user.email,
      firstName: user.firstName,
      signupType: metadata?.signupType,
      provider: metadata?.provider,
      profilePicture: metadata?.profilePicture, // Available for social signups
    });
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
class WelcomeEmailHook implements IPostSignupHookProvider {
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
nauth.hookRegistry.registerPostSignup(new WelcomeEmailHook(emailService));
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
class WelcomeEmailHook implements IPostSignupHookProvider {
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
nauth.hookRegistry.registerPostSignup(new WelcomeEmailHook(emailService));
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
  socialMetadata?: Record<string, unknown> | null;
  profilePicture?: string | null;
}
```

**Properties**

| Property               | Type                                | Description                                                                 |
| ---------------------- | ----------------------------------- | ---------------------------------------------------------------------------- |
| `requiresVerification` | `boolean`                           | Whether user needs to complete verification challenge                       |
| `signupType`           | `'password' \| 'social'`            | Type of signup performed                                                    |
| `provider`             | `string`                            | Social provider name (google, apple, facebook) if social signup              |
| `adminSignup`          | `boolean`                           | Whether signup was initiated by admin                                       |
| `socialMetadata`       | `Record<string, unknown> \| null`   | Raw OAuth profile data from provider (only for social signups)              |
| `profilePicture`       | `string \| null`                     | Profile picture URL from OAuth provider (only for social signups)           |

**Social Metadata**

For social signups, `socialMetadata` contains the complete raw OAuth profile data stored in the social account's metadata field. This includes provider-specific fields such as:

- `sub` - Provider's user identifier
- `given_name` - First name from provider
- `family_name` - Last name from provider
- `picture` - Profile picture URL (also available as `profilePicture`)
- `locale` - User's locale preference
- Any other provider-specific fields

**Example**

```typescript
// Social signup metadata
{
  signupType: 'social',
  provider: 'google',
  socialMetadata: {
    sub: 'google_123',
    email: 'user@gmail.com',
    given_name: 'John',
    family_name: 'Doe',
    picture: 'https://lh3.googleusercontent.com/a/...',
    locale: 'en'
  },
  profilePicture: 'https://lh3.googleusercontent.com/a/...'
}
```

---

## Related APIs

- [HookRegistryService](../services/hook-registry-service) - Hook registration and execution
- [NAuthException](../exceptions/nauth-exception) - Error handling
- [Lifecycle Hooks Guide](/docs/features/lifecycle-hooks) - Complete usage guide
