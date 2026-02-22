---
title: IPreSignupHookProvider
description: Hook interface for pre-signup validation
keywords: [hooks, signup, validation, interface]
image: /img/api-social-card.png
---
# IPreSignupHookProvider

Hook interface for executing validation before user creation.

## Overview

The `IPreSignupHookProvider` interface enables validation and blocking of signups before user creation. This is the **only blocking hook** - it can throw exceptions to prevent signup.

The hook is **blocking** - throwing an exception prevents user creation.

## Interface

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

## Parameters

| Parameter     | Type                        | Description                                    |
| ------------- | --------------------------- | ---------------------------------------------- |
| `data`        | `PreSignupHookData`         | Signup DTO or OAuth profile                    |
| `signupType`  | `'password' \| 'social'`    | Type of signup                                 |
| `provider`    | `string`                    | Social provider name (social signups only)     |
| `adminSignup` | `boolean`                   | Whether admin-initiated signup                 |

## When Hook Fires

- Before password signup via `signup()`
- Before social signup (web redirect or native mobile flows)
- Before admin signup via `adminSignup()` or `adminSignupSocial()`

## Blocking Signup

Throw `NAuthException` with `AuthErrorCode.PRESIGNUP_FAILED`:

```typescript
throw new NAuthException(AuthErrorCode.PRESIGNUP_FAILED, 'Email domain not allowed');
```

## Example

```typescript
import { IPreSignupHookProvider, NAuthException, AuthErrorCode } from '@nauth-toolkit/core';

export class DomainValidationHook implements IPreSignupHookProvider {
  async execute(data, signupType) {
    const domain = data.email?.split('@')[1];
    const allowedDomains = ['company.com'];

    if (domain && !allowedDomains.includes(domain)) {
      throw new NAuthException(AuthErrorCode.PRESIGNUP_FAILED, 'Domain not allowed');
    }
  }
}
```

## Related

- [HookRegistryService](../services/hook-registry-service) - Hook registration
- [@PreSignupHook()](/docs/api/nestjs/decorators/pre-signup-hook) - NestJS decorator
- [NAuthException](../exceptions/nauth-exception) - Exception handling
- [Lifecycle Hooks Guide](/docs/guides/lifecycle-hooks) - Complete hooks overview

