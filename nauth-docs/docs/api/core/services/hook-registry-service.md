---
title: HookRegistryService
description: Service for registering and managing authentication lifecycle hooks
keywords: [hooks, registry, lifecycle, service, api]
image: /img/api-social-card.png
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

const nauth = await NAuth.create({ config, dataSource, adapter });
const hookRegistry = nauth.hookRegistry;
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
import { NAuth } from '@nauth-toolkit/core';

const nauth = await NAuth.create({ config, dataSource, adapter });
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

- `provider` - [`IPreSignupHookProvider`](../hooks/pre-signup-hook-provider)

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
import { Injectable } from '@nestjs/common';
import { PreSignupHook, IPreSignupHookProvider, PreSignupHookData } from '@nauth-toolkit/nestjs';

// Use decorators - automatic registration
@Injectable()
@PreSignupHook()
export class MyHook implements IPreSignupHookProvider {
  async execute(
    data: PreSignupHookData,
    signupType: 'password' | 'social',
    provider?: string,
    adminSignup?: boolean,
  ): Promise<void> {
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

### registerPostSignup()

Register a post-signup hook provider. Hooks execute after successful user creation. Non-blocking - errors are logged.

```typescript
registerPostSignup(provider: IPostSignupHookProvider): void
```

**Parameters**

- `provider` - [`IPostSignupHookProvider`](../hooks/post-signup-hook-provider)

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
// Use decorators - automatic registration
@Injectable()
@PostSignupHook()
export class WelcomeEmailHook implements IPostSignupHookProvider {
  constructor(private emailService: EmailService) {}

  async execute(user, metadata) {
    // For social signups, include profile picture
    if (metadata?.signupType === 'social' && metadata.profilePicture) {
      await this.emailService.sendWelcome({
        email: user.email,
        profilePicture: metadata.profilePicture,
      });
    } else {
      await this.emailService.sendWelcome(user.email);
    }
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
class WelcomeEmailHook implements IPostSignupHookProvider {
  constructor(private emailService: EmailService) {}

  async execute(user, metadata) {
    await this.emailService.sendWelcome(user.email);
  }
}

nauth.hookRegistry.registerPostSignup(new WelcomeEmailHook(emailService));
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
class WelcomeEmailHook implements IPostSignupHookProvider {
  constructor(private emailService: EmailService) {}

  async execute(user, metadata) {
    await this.emailService.sendWelcome(user.email);
  }
}

nauth.hookRegistry.registerPostSignup(new WelcomeEmailHook(emailService));
```

</TabItem>
</Tabs>

---

### registerOnboardingCompleted()

Register an onboarding completed hook. Hooks execute when a user completes onboarding (email/phone verification). Non-blocking - errors are logged.

```typescript
registerOnboardingCompleted(provider: IOnboardingCompletedHook): void
```

**Parameters**

- `provider` - `IOnboardingCompletedHook`

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@Injectable()
@OnboardingCompletedHook()
export class OnboardingHook implements IOnboardingCompletedHook {
  async execute(user, metadata) {
    await this.analyticsService.track('onboarding_completed', {
      userId: user.sub,
      method: metadata.verificationMethod,
    });
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
class OnboardingHook implements IOnboardingCompletedHook {
  async execute(user, metadata) {
    await analyticsService.track('onboarding_completed', { userId: user.sub });
  }
}

nauth.hookRegistry.registerOnboardingCompleted(new OnboardingHook());
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
class OnboardingHook implements IOnboardingCompletedHook {
  async execute(user, metadata) {
    await analyticsService.track('onboarding_completed', { userId: user.sub });
  }
}

nauth.hookRegistry.registerOnboardingCompleted(new OnboardingHook());
```

</TabItem>
</Tabs>

---

### registerUserProfileUpdated()

Register a user profile updated hook provider. Hooks execute after profile attribute changes. Non-blocking - errors are logged.

```typescript
registerUserProfileUpdated(provider: IUserProfileUpdatedHook): void
```

**Parameters**

- `provider` - [`IUserProfileUpdatedHook`](../hooks/user-profile-updated-hook)

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@Injectable()
@UserProfileUpdatedHook()
export class CrmSyncHook implements IUserProfileUpdatedHook {
  async execute(metadata: UserProfileUpdatedMetadata) {
    const emailChange = metadata.changedFields.find((f) => f.fieldName === 'email');
    if (emailChange) {
      await this.crmService.updateContact(metadata.user.sub, {
        email: emailChange.newValue,
      });
    }
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
class CrmSyncHook implements IUserProfileUpdatedHook {
  async execute(metadata) {
    const emailChange = metadata.changedFields.find((f) => f.fieldName === 'email');
    if (emailChange) {
      await crmService.updateContact(metadata.user.sub, emailChange.newValue);
    }
  }
}

nauth.hookRegistry.registerUserProfileUpdated(new CrmSyncHook());
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
class CrmSyncHook implements IUserProfileUpdatedHook {
  async execute(metadata) {
    const emailChange = metadata.changedFields.find((f) => f.fieldName === 'email');
    if (emailChange) {
      await crmService.updateContact(metadata.user.sub, emailChange.newValue);
    }
  }
}

nauth.hookRegistry.registerUserProfileUpdated(new CrmSyncHook());
```

</TabItem>
</Tabs>

---

### registerPasswordChanged()

Register a password changed hook. Hooks execute after a user's password is changed. Non-blocking - errors are logged.

```typescript
registerPasswordChanged(provider: IPasswordChangedHook): void
```

**Parameters**

- `provider` - `IPasswordChangedHook`

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@Injectable()
@PasswordChangedHook()
export class PasswordAuditHook implements IPasswordChangedHook {
  async execute(metadata) {
    await this.auditService.log('password_changed', { userId: metadata.user.sub });
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
class PasswordAuditHook implements IPasswordChangedHook {
  async execute(metadata) {
    await auditService.log('password_changed', { userId: metadata.user.sub });
  }
}

nauth.hookRegistry.registerPasswordChanged(new PasswordAuditHook());
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
class PasswordAuditHook implements IPasswordChangedHook {
  async execute(metadata) {
    await auditService.log('password_changed', { userId: metadata.user.sub });
  }
}

nauth.hookRegistry.registerPasswordChanged(new PasswordAuditHook());
```

</TabItem>
</Tabs>

---

### registerMFADeviceRemoved()

Register an MFA device removed hook. Hooks execute after an MFA device is removed from a user account. Non-blocking - errors are logged.

```typescript
registerMFADeviceRemoved(provider: IMFADeviceRemovedHook): void
```

**Parameters**

- `provider` - `IMFADeviceRemovedHook`

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@Injectable()
@MFADeviceRemovedHook()
export class SecurityAlertHook implements IMFADeviceRemovedHook {
  async execute(metadata) {
    await this.notifyService.sendSecurityAlert(metadata.user.email, 'mfa_device_removed');
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
class SecurityAlertHook implements IMFADeviceRemovedHook {
  async execute(metadata) {
    await notifyService.sendSecurityAlert(metadata.user.email, 'mfa_device_removed');
  }
}

nauth.hookRegistry.registerMFADeviceRemoved(new SecurityAlertHook());
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
class SecurityAlertHook implements IMFADeviceRemovedHook {
  async execute(metadata) {
    await notifyService.sendSecurityAlert(metadata.user.email, 'mfa_device_removed');
  }
}

nauth.hookRegistry.registerMFADeviceRemoved(new SecurityAlertHook());
```

</TabItem>
</Tabs>

---

### registerAdaptiveMFARiskDetected()

Register an adaptive MFA risk detected hook. Hooks execute when a risk factor is detected during authentication. Non-blocking - errors are logged.

```typescript
registerAdaptiveMFARiskDetected(provider: IAdaptiveMFARiskDetectedHook): void
```

**Parameters**

- `provider` - `IAdaptiveMFARiskDetectedHook`

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@Injectable()
@AdaptiveMFARiskDetectedHook()
export class RiskLoggingHook implements IAdaptiveMFARiskDetectedHook {
  async execute(metadata) {
    await this.securityService.logRiskEvent(metadata.user.sub, metadata.riskFactors);
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
class RiskLoggingHook implements IAdaptiveMFARiskDetectedHook {
  async execute(metadata) {
    await securityService.logRiskEvent(metadata.user.sub, metadata.riskFactors);
  }
}

nauth.hookRegistry.registerAdaptiveMFARiskDetected(new RiskLoggingHook());
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
class RiskLoggingHook implements IAdaptiveMFARiskDetectedHook {
  async execute(metadata) {
    await securityService.logRiskEvent(metadata.user.sub, metadata.riskFactors);
  }
}

nauth.hookRegistry.registerAdaptiveMFARiskDetected(new RiskLoggingHook());
```

</TabItem>
</Tabs>

---

### registerAccountStatusChanged()

Register an account status changed hook. Hooks execute when an account is enabled or disabled by an admin. Non-blocking - errors are logged.

```typescript
registerAccountStatusChanged(provider: IAccountStatusChangedHook): void
```

**Parameters**

- `provider` - `IAccountStatusChangedHook`

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@Injectable()
@AccountStatusChangedHook()
export class AccountStatusHook implements IAccountStatusChangedHook {
  async execute(metadata) {
    await this.auditService.log('account_status_changed', {
      userId: metadata.user.sub,
      status: metadata.newStatus,
    });
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
class AccountStatusHook implements IAccountStatusChangedHook {
  async execute(metadata) {
    await auditService.log('account_status_changed', { userId: metadata.user.sub });
  }
}

nauth.hookRegistry.registerAccountStatusChanged(new AccountStatusHook());
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
class AccountStatusHook implements IAccountStatusChangedHook {
  async execute(metadata) {
    await auditService.log('account_status_changed', { userId: metadata.user.sub });
  }
}

nauth.hookRegistry.registerAccountStatusChanged(new AccountStatusHook());
```

</TabItem>
</Tabs>

---

### registerEmailChanged()

Register an email changed hook. Hooks execute after a user's email address is changed. Non-blocking - errors are logged.

```typescript
registerEmailChanged(provider: IEmailChangedHook): void
```

**Parameters**

- `provider` - `IEmailChangedHook`

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@Injectable()
@EmailChangedHook()
export class EmailChangedHook implements IEmailChangedHook {
  async execute(metadata) {
    await this.crmService.updateEmail(metadata.user.sub, metadata.newEmail);
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
class EmailSyncHook implements IEmailChangedHook {
  async execute(metadata) {
    await crmService.updateEmail(metadata.user.sub, metadata.newEmail);
  }
}

nauth.hookRegistry.registerEmailChanged(new EmailSyncHook());
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
class EmailSyncHook implements IEmailChangedHook {
  async execute(metadata) {
    await crmService.updateEmail(metadata.user.sub, metadata.newEmail);
  }
}

nauth.hookRegistry.registerEmailChanged(new EmailSyncHook());
```

</TabItem>
</Tabs>

---

### registerAccountLocked()

Register an account locked hook. Hooks execute when an account is locked due to failed login attempts. Non-blocking - errors are logged.

```typescript
registerAccountLocked(provider: IAccountLockedHook): void
```

**Parameters**

- `provider` - `IAccountLockedHook`

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@Injectable()
@AccountLockedHook()
export class LockoutNotificationHook implements IAccountLockedHook {
  async execute(metadata) {
    await this.alertService.notifyAdmin('account_locked', { userId: metadata.user.sub });
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
class LockoutNotificationHook implements IAccountLockedHook {
  async execute(metadata) {
    await alertService.notifyAdmin('account_locked', { userId: metadata.user.sub });
  }
}

nauth.hookRegistry.registerAccountLocked(new LockoutNotificationHook());
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
class LockoutNotificationHook implements IAccountLockedHook {
  async execute(metadata) {
    await alertService.notifyAdmin('account_locked', { userId: metadata.user.sub });
  }
}

nauth.hookRegistry.registerAccountLocked(new LockoutNotificationHook());
```

</TabItem>
</Tabs>

---

### registerSessionsRevoked()

Register a sessions revoked hook. Hooks execute when user sessions are revoked (logout, global sign-out, admin action). Non-blocking - errors are logged.

```typescript
registerSessionsRevoked(provider: ISessionsRevokedHook): void
```

**Parameters**

- `provider` - `ISessionsRevokedHook`

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@Injectable()
@SessionsRevokedHook()
export class SessionAuditHook implements ISessionsRevokedHook {
  async execute(metadata) {
    await this.auditService.log('sessions_revoked', {
      userId: metadata.user.sub,
      sessionCount: metadata.sessionCount,
    });
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
class SessionAuditHook implements ISessionsRevokedHook {
  async execute(metadata) {
    await auditService.log('sessions_revoked', { userId: metadata.user.sub });
  }
}

nauth.hookRegistry.registerSessionsRevoked(new SessionAuditHook());
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
class SessionAuditHook implements ISessionsRevokedHook {
  async execute(metadata) {
    await auditService.log('sessions_revoked', { userId: metadata.user.sub });
  }
}

nauth.hookRegistry.registerSessionsRevoked(new SessionAuditHook());
```

</TabItem>
</Tabs>

---

### registerMFAFirstEnabled()

Register an MFA first enabled hook. Hooks execute when a user enables MFA for the first time on their account. Non-blocking - errors are logged.

```typescript
registerMFAFirstEnabled(provider: IMFAFirstEnabledHook): void
```

**Parameters**

- `provider` - `IMFAFirstEnabledHook`

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@Injectable()
@MFAFirstEnabledHook()
export class MFAEnrollmentHook implements IMFAFirstEnabledHook {
  async execute(metadata) {
    await this.analyticsService.track('mfa_first_enabled', { userId: metadata.user.sub });
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
class MFAEnrollmentHook implements IMFAFirstEnabledHook {
  async execute(metadata) {
    await analyticsService.track('mfa_first_enabled', { userId: metadata.user.sub });
  }
}

nauth.hookRegistry.registerMFAFirstEnabled(new MFAEnrollmentHook());
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
class MFAEnrollmentHook implements IMFAFirstEnabledHook {
  async execute(metadata) {
    await analyticsService.track('mfa_first_enabled', { userId: metadata.user.sub });
  }
}

nauth.hookRegistry.registerMFAFirstEnabled(new MFAEnrollmentHook());
```

</TabItem>
</Tabs>

---

### registerMFAMethodAdded()

Register an MFA method added hook. Hooks execute when an additional MFA method is added to an account that already has MFA enabled. Non-blocking - errors are logged.

```typescript
registerMFAMethodAdded(provider: IMFAMethodAddedHook): void
```

**Parameters**

- `provider` - `IMFAMethodAddedHook`

**Example**

<Tabs groupId="platform">
<TabItem value="nestjs" label="NestJS">

```typescript
@Injectable()
@MFAMethodAddedHook()
export class MFAMethodHook implements IMFAMethodAddedHook {
  async execute(metadata) {
    await this.analyticsService.track('mfa_method_added', {
      userId: metadata.user.sub,
      method: metadata.method,
    });
  }
}
```

</TabItem>
<TabItem value="express" label="Express">

```typescript
class MFAMethodHook implements IMFAMethodAddedHook {
  async execute(metadata) {
    await analyticsService.track('mfa_method_added', { userId: metadata.user.sub });
  }
}

nauth.hookRegistry.registerMFAMethodAdded(new MFAMethodHook());
```

</TabItem>
<TabItem value="fastify" label="Fastify">

```typescript
class MFAMethodHook implements IMFAMethodAddedHook {
  async execute(metadata) {
    await analyticsService.track('mfa_method_added', { userId: metadata.user.sub });
  }
}

nauth.hookRegistry.registerMFAMethodAdded(new MFAMethodHook());
```

</TabItem>
</Tabs>

---

### executePreSignup()

**Internal method.** Executes all registered pre-signup hooks in order. Called automatically by AuthService.

```typescript
async executePreSignup(
  data: PreSignupHookData,
  signupType: 'password' | 'social',
  provider?: string,
  adminSignup?: boolean,
): Promise<void>
```

**Parameters**

- `data` - `SignupDTO`, `AdminSignupDTO`, or `OAuthUserProfile` depending on signup type
- `signupType` - Type of signup ('password' or 'social')
- `provider` - Social provider name (e.g., 'google', 'apple', 'facebook') - only for social signups
- `adminSignup` - Whether this is an admin-initiated signup

**Errors**

| Code               | When                  | Details               |
| ------------------ | --------------------- | --------------------- |
| `PRESIGNUP_FAILED` | Hook throws exception | `{ message: string }` |

Throws [`NAuthException`](../exceptions/nauth-exception) with code `PRESIGNUP_FAILED` if any hook throws an error.

---

### executePostSignup()

**Internal method.** Executes all registered post-signup hooks in order. Called automatically by AuthService. Errors are logged but don't block signup.

```typescript
async executePostSignup(user: IUser, metadata?: SignupMetadata): Promise<void>
```

**Parameters**

- `user` - Created user entity
- `metadata` - Optional signup metadata

---

### executeOnboardingCompleted()

**Internal method.** Executes all registered onboarding completed hooks. Called automatically by AuthService, EmailVerificationService, and PhoneVerificationService. Errors are logged but don't block the flow.

```typescript
async executeOnboardingCompleted(user: IUser, metadata: OnboardingCompletedMetadata): Promise<void>
```

**Parameters**

- `user` - User entity
- `metadata` - Completion metadata (verification method, source, timestamp)

---

### executeUserProfileUpdated()

**Internal method.** Executes all registered user profile updated hooks in order. Called automatically by AuthService, EmailVerificationService, and PhoneVerificationService. Errors are logged but don't block updates.

```typescript
async executeUserProfileUpdated(metadata: UserProfileUpdatedMetadata): Promise<void>
```

**Parameters**

- `metadata` - [`UserProfileUpdatedMetadata`](../hooks/user-profile-updated-hook#userprofileupdatedmetadata) containing updated user and change details

---

### executePasswordChanged()

**Internal method.** Executes all registered password changed hooks. Called automatically by AuthServiceInternalHelpers. Errors are logged but don't block the operation.

```typescript
async executePasswordChanged(metadata: PasswordChangedMetadata): Promise<void>
```

---

### executeMFADeviceRemoved()

**Internal method.** Executes all registered MFA device removed hooks. Called automatically by UserService and MFAService. Errors are logged but don't block the operation.

```typescript
async executeMFADeviceRemoved(metadata: MFADeviceRemovedMetadata): Promise<void>
```

---

### executeAdaptiveMFARiskDetected()

**Internal method.** Executes all registered adaptive MFA risk detected hooks. Called automatically by AdaptiveMFADecisionService. Errors are logged but don't block authentication.

```typescript
async executeAdaptiveMFARiskDetected(metadata: AdaptiveMFARiskDetectedMetadata): Promise<void>
```

---

### executeAccountStatusChanged()

**Internal method.** Executes all registered account status changed hooks. Called automatically by UserService. Errors are logged but don't block the operation.

```typescript
async executeAccountStatusChanged(metadata: AccountStatusChangedMetadata): Promise<void>
```

---

### executeEmailChanged()

**Internal method.** Executes all registered email changed hooks. Called automatically by UserService. Errors are logged but don't block the operation.

```typescript
async executeEmailChanged(metadata: EmailChangedMetadata): Promise<void>
```

---

### executeAccountLocked()

**Internal method.** Executes all registered account locked hooks. Called automatically by AuthServiceInternalHelpers. Errors are logged but don't block lockout.

```typescript
async executeAccountLocked(metadata: AccountLockedMetadata): Promise<void>
```

---

### executeSessionsRevoked()

**Internal method.** Executes all registered sessions revoked hooks. Called automatically by SessionService. Errors are logged but don't block the operation.

```typescript
async executeSessionsRevoked(metadata: SessionsRevokedMetadata): Promise<void>
```

---

### executeMFAFirstEnabled()

**Internal method.** Executes all registered MFA first enabled hooks. Called automatically by BaseMFAProviderService. Errors are logged but don't block MFA enrollment.

```typescript
async executeMFAFirstEnabled(metadata: MFAFirstEnabledMetadata): Promise<void>
```

---

### executeMFAMethodAdded()

**Internal method.** Executes all registered MFA method added hooks. Called automatically by BaseMFAProviderService. Errors are logged but don't block MFA enrollment.

```typescript
async executeMFAMethodAdded(metadata: MFAMethodAddedMetadata): Promise<void>
```

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

**All other hooks are non-blocking:**

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

**All Other Hooks:**

- All errors are caught and logged
- Execution continues to next hook
- The triggering operation is never blocked

---

## Related APIs

- [IPreSignupHookProvider](../hooks/pre-signup-hook-provider) - Pre-signup hook interface
- [IPostSignupHookProvider](../hooks/post-signup-hook-provider) - Post-signup hook interface
- [IUserProfileUpdatedHook](../hooks/user-profile-updated-hook) - User profile updated hook interface
- [Lifecycle Hooks Guide](/docs/guides/lifecycle-hooks) - Complete usage guide
