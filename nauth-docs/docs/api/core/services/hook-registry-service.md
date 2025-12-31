---
title: HookRegistryService
description: Service for registering and managing authentication lifecycle hooks
keywords: [hooks, registry, lifecycle, service, api]
image: /img/api-social-card.png
sidebar_position: 7
---

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

# HookRegistryService

**Package:** `@nauth-toolkit/core/internal`
**Type:** Service (Internal)

Central registry for managing authentication lifecycle hooks. Handles hook registration and execution with proper error handling and logging.

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { HookRegistryService } from '@nauth-toolkit/nestjs';
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
import { NAuth } from '@nauth-toolkit/core';

const nauth = await NAuth.create(config, dataSource);
const hookRegistry = nauth.hookRegistry;
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { NAuth } from '@nauth-toolkit/core';

const nauth = await NAuth.create(config, dataSource);
const hookRegistry = nauth.hookRegistry;
```

</TabItem>
</Tabs>

## Overview

Provides centralized hook management for authentication lifecycle events. Hooks are executed in registration order.

:::note
Auto-injected by framework adapters. Manual instantiation not recommended.
:::

## Methods

### registerPreSignup()

Register a pre-signup hook provider. Hooks execute before user creation and can block signups.

```typescript
registerPreSignup(provider: IPreSignupHookProvider): void
```

**Parameters**

- `provider` - [`IPreSignupHookProvider`](../interfaces/hook-providers#ipreSignuphookprovider)

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
// Use decorators - automatic registration
@Injectable()
@PreSignupHook()
export class MyHook implements IPreSignupHookProvider {
  async execute(userData, signupMethod, providerId, adminSignup) {
    // Validation logic
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
class MyHook implements IPreSignupHookProvider {
  async execute(userData, signupMethod, providerId, adminSignup) {
    // Validation logic
  }
}

nauth.hookRegistry.registerPreSignup(new MyHook());
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
class MyHook implements IPreSignupHookProvider {
  async execute(userData, signupMethod, providerId, adminSignup) {
    // Validation logic
  }
}

nauth.hookRegistry.registerPreSignup(new MyHook());
```

</TabItem>
</Tabs>

---

### registerAfterSignup()

Register an after-signup hook provider. Hooks execute after successful user creation. Non-blocking - errors are logged.

```typescript
registerAfterSignup(provider: IAfterSignupHookProvider): void
```

**Parameters**

- `provider` - [`IAfterSignupHookProvider`](../interfaces/hook-providers#iaftersignuphookprovider)

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
// Use decorators - automatic registration
@Injectable()
@AfterSignupHook()
export class WelcomeEmailHook implements IAfterSignupHookProvider {
  constructor(private emailService: EmailService) {}

  async execute(user, metadata) {
    await this.emailService.sendWelcome(user.email);
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
class WelcomeEmailHook implements IAfterSignupHookProvider {
  constructor(private emailService: EmailService) {}

  async execute(user, metadata) {
    await this.emailService.sendWelcome(user.email);
  }
}

nauth.hookRegistry.registerAfterSignup(new WelcomeEmailHook(emailService));
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
class WelcomeEmailHook implements IAfterSignupHookProvider {
  constructor(private emailService: EmailService) {}

  async execute(user, metadata) {
    await this.emailService.sendWelcome(user.email);
  }
}

nauth.hookRegistry.registerAfterSignup(new WelcomeEmailHook(emailService));
```

</TabItem>
</Tabs>

---

### executePreSignup()

**Internal method.** Executes all registered pre-signup hooks in order. Called automatically by AuthService.

```typescript
async executePreSignup(
  userData: Partial<IUser>,
  signupMethod: SignupMethod,
  providerId?: string | null,
  adminSignup?: boolean,
): Promise<void>
```

**Parameters**

- `userData` - User data being created
- `signupMethod` - Signup method type
- `providerId` - Social provider ID (if applicable)
- `adminSignup` - Whether admin-initiated

**Errors**

| Code | When | Details |
|---|---|---|
| `PRESIGNUP_FAILED` | Hook throws exception | `{ message: string }` |

Throws [`NAuthException`](../exceptions/nauth-exception) with code `PRESIGNUP_FAILED` if any hook throws an error.

---

### executeAfterSignup()

**Internal method.** Executes all registered after-signup hooks in order. Called automatically by AuthService. Errors are logged but don't block signup.

```typescript
async executeAfterSignup(user: IUser, metadata?: SignupMetadata): Promise<void>
```

**Parameters**

- `user` - Created user entity
- `metadata` - Optional signup metadata

---

## Execution Order

Hooks execute in registration order:

```typescript
// First hook registered
hookRegistry.registerPreSignup(domainValidation);

// Second hook registered
hookRegistry.registerPreSignup(inviteCodeCheck);

// Execution order during signup:
// 1. domainValidation.execute()
// 2. inviteCodeCheck.execute()
```

**Stopping Execution:**

For pre-signup hooks, first hook to throw `NAuthException` stops execution and blocks signup:

```typescript
// Hook 1: Throws error
domainValidation.execute(); // Throws PRESIGNUP_FAILED

// Hook 2: Never executes
inviteCodeCheck.execute(); // Skipped
```

**After-Signup Hooks:**

All hooks execute regardless of errors. Errors are caught and logged:

```typescript
// Hook 1: Throws error
welcomeEmail.execute(); // Throws error - logged, continues

// Hook 2: Still executes
analytics.execute(); // Executes normally
```

---

## Error Handling

**Pre-Signup Hooks:**
- Errors with code `PRESIGNUP_FAILED` are re-thrown as-is
- Other errors are wrapped in `PRESIGNUP_FAILED` with original message
- First error stops execution and blocks signup

**After-Signup Hooks:**
- All errors are caught and logged
- Execution continues to next hook
- Signup is never blocked

---

## Related APIs

- [IPreSignupHookProvider](../interfaces/hook-providers#ipreSignuphookprovider) - Pre-signup hook interface
- [IAfterSignupHookProvider](../interfaces/hook-providers#iaftersignuphookprovider) - After-signup hook interface
- [Lifecycle Hooks Guide](/docs/guides/lifecycle-hooks) - Complete usage guide

