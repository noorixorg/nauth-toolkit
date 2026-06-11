---
title: IOnboardingCompletedHook
description: Hook interface for onboarding completion actions
keywords: [hooks, onboarding, signup, verification, interface]
image: /img/api-social-card.png
---
# IOnboardingCompletedHook

Hook interface for executing actions **after onboarding becomes complete**.

## Overview

Onboarding completion means the user has satisfied the configured signup verification requirements:

- `signup.verificationMethod = 'none'`: onboarding completes immediately after signup
- `signup.verificationMethod = 'email'`: onboarding completes after email verification succeeds
- `signup.verificationMethod = 'phone'`: onboarding completes after phone verification succeeds
- `signup.verificationMethod = 'both'`: onboarding completes after **both** email and phone verification succeed

This is the best lifecycle hook for:

- Welcome emails
- “Account ready” notifications
- Post-verification onboarding flows

## Interface

```typescript
interface IOnboardingCompletedHook {
  execute(user: IUser, metadata: OnboardingCompletedMetadata): Promise<void>;
}
```

## Metadata

```typescript
interface OnboardingCompletedMetadata {
  verificationMethod: 'none' | 'email' | 'phone' | 'both';
  source: 'signup' | 'email_verification' | 'phone_verification';
  completedAt: Date;
}
```

## Example (manual registration)

```typescript
import { HookRegistryService, type IOnboardingCompletedHook, type OnboardingCompletedMetadata, type IUser } from '@nauth-toolkit/core';

export class WelcomeEmailHook implements IOnboardingCompletedHook {
  async execute(user: IUser, _metadata: OnboardingCompletedMetadata): Promise<void> {
    // Send your “welcome” email here (after required verification(s) are complete)
    await this.emailService.sendWelcome(user.email);
  }
}

hookRegistry.registerOnboardingCompleted(new WelcomeEmailHook());
```

## Related

- [`IPostSignupHookProvider`](./post-signup-hook-provider) - Runs after user creation (before verification completion)
- [Lifecycle Hooks Guide](/docs/guides/lifecycle-hooks)
