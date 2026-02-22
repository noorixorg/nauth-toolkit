---
title: IPostSignupHookProvider
description: Hook interface for post-signup actions
keywords: [hooks, signup, notifications, interface]
image: /img/api-social-card.png
---
# IPostSignupHookProvider

Hook interface for executing actions after user creation.

## Overview

The `IPostSignupHookProvider` interface enables reactions to successful user creation for notifications, integrations, and analytics.

The hook is **non-blocking** - errors are logged but do not affect signup.

## Interface

```typescript
interface IPostSignupHookProvider {
  execute(user: IUser, metadata?: SignupMetadata): Promise<void>;
}
```

## Parameters

| Parameter  | Type             | Description                      |
| ---------- | ---------------- | -------------------------------- |
| `user`     | `IUser`          | Newly created user entity        |
| `metadata` | `SignupMetadata` | Optional signup metadata         |

### SignupMetadata

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

| Property               | Type                      | Description                        |
| ---------------------- | ------------------------- | ---------------------------------- |
| `requiresVerification` | `boolean`                 | Needs verification challenge       |
| `signupType`           | `'password' \| 'social'`  | Type of signup                     |
| `provider`             | `string`                  | Social provider name               |
| `adminSignup`          | `boolean`                 | Admin-initiated signup             |
| `socialMetadata`       | `Record<string, unknown>` | Raw OAuth profile data             |
| `profilePicture`       | `string`                  | Profile picture URL                |

:::tip
`IPostSignupHookProvider` runs **before** verification challenges are completed.
If you want to send a “welcome” email after the user has finished required verification(s), use `IOnboardingCompletedHook` instead.
:::

## When Hook Fires

- After password signup completes
- After social signup completes
- After admin signup completes

## Example

```typescript
import { IPostSignupHookProvider, IUser, SignupMetadata } from '@nauth-toolkit/core';

export class WelcomeEmailHook implements IPostSignupHookProvider {
  async execute(user: IUser, metadata?: SignupMetadata): Promise<void> {
    await this.emailService.sendWelcome({
      to: user.email,
      firstName: user.firstName,
      signupType: metadata?.signupType,
    });
  }
}
```

## Related

- [HookRegistryService](../services/hook-registry-service) - Hook registration
- [@PostSignupHook()](/docs/api/nestjs/decorators/post-signup-hook) - NestJS decorator
- [Lifecycle Hooks Guide](/docs/guides/lifecycle-hooks) - Complete hooks overview

