# Email Notification System Implementation Plan

**Version:** 1.0
**Status:** Planning
**Last Updated:** 2025-01-08

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture Principles](#architecture-principles)
3. [Email Categories](#email-categories)
4. [Phase 1: Core Infrastructure](#phase-1-core-infrastructure)
5. [Phase 2: Hook Interfaces](#phase-2-hook-interfaces)
6. [Phase 3: Configuration Layer](#phase-3-configuration-layer)
7. [Phase 4: Hook Triggers](#phase-4-hook-triggers)
8. [Phase 5: Email Provider Updates](#phase-5-email-provider-updates)
9. [Phase 6: Email Templates](#phase-6-email-templates)
10. [Phase 7: Service Integration](#phase-7-service-integration)
11. [Phase 8: Testing](#phase-8-testing)
12. [Phase 9: Documentation](#phase-9-documentation)
13. [Implementation Checklist](#implementation-checklist)
14. [Validation Checklist](#validation-checklist)

---

## Overview

**Extend existing email system** with comprehensive lifecycle hooks and configurable notifications.

### Current System (Preserve)

- MJML templates compiled at build time → Handlebars
- `NodemailerProvider` with template rendering
- `build-templates.js` for MJML compilation
- Existing templates: verification, password-reset, admin-password-reset, welcome, account-lockout, new-device

### What We're Adding

- **8 new hook interfaces** for lifecycle events
- **10 new email templates** (MJML → Handlebars)
- **Configurable suppression** for ALL emails (including code emails)
- **Consumer override capability** - Disable built-in, implement custom hooks

### Design Goals

1. **Minimal consumer boilerplate** - Works out of the box
2. **Complete flexibility** - ANY email can be disabled, hooks provide alternative
3. **Non-blocking execution** - Follows existing `IPostSignupHookProvider` pattern
4. **Production-ready** - 80%+ test coverage, full documentation

---

## Architecture Principles

### 1. Hook Pattern (Non-blocking)

```typescript
// All hooks follow this pattern:
// 1. Execute after operation completes
// 2. Errors logged but don't fail operation
// 3. Sequential execution in registration order
// 4. Consumers can register multiple implementations
```

### 2. Config-Driven Suppression

```typescript
// Email notifications config structure:
emailNotifications: {
  enabled: true,  // Global kill switch
  suppress: {
    // Only optional emails can be suppressed
    // Critical emails (codes) are ALWAYS sent
    passwordChanged: false,
    accountDisabled: false,
    // ... etc
  }
}
```

### 3. Service Dependency Injection

```typescript
// Services receive HookRegistryService via constructor
constructor(
  // ... existing deps
  private readonly hookRegistry?: HookRegistryService,
)
```

---

## Email Categories

### ALL Emails Can Be Suppressed

**Key Principle:** Consumers can disable ANY email and implement their own via hooks.

| Email Type           | Current Method/Hook             | Hook for Override           | Template               |
| -------------------- | ------------------------------- | --------------------------- | ---------------------- |
| Email Verification   | `sendVerificationEmail()`       | `IVerificationCodeSentHook` | `email-verification`   |
| Password Reset       | `sendPasswordResetEmail()`      | `IPasswordResetSentHook`    | `password-reset`       |
| Admin Password Reset | `sendAdminPasswordResetEmail()` | `IPasswordResetSentHook`    | `admin-password-reset` |
| MFA Code             | Auto-sent in challenge          | (Challenge system)          | N/A (inline)           |
| Phone Verification   | `sendVerificationSMS()`         | (SMS provider)              | N/A (SMS)              |

### New Lifecycle Notifications

| Event                   | Hook Interface                 | Template (MJML)           | Default  |
| ----------------------- | ------------------------------ | ------------------------- | -------- |
| Welcome Email           | `IPostSignupHookProvider`      | `welcome`                 | DISABLED |
| Password Changed        | `IPasswordChangedHook`         | `password-changed`        | DISABLED |
| MFA Device Removed      | `IMFADeviceRemovedHook`        | `mfa-device-removed`      | DISABLED |
| Adaptive MFA Risk Alert | `IAdaptiveMFARiskDetectedHook` | `adaptive-mfa-risk-alert` | DISABLED |
| Account Disabled        | `IAccountStatusChangedHook`    | `account-disabled`        | DISABLED |
| Account Enabled         | `IAccountStatusChangedHook`    | `account-enabled`         | DISABLED |
| Email Changed           | `IEmailChangedHook`            | Two templates (below)     | DISABLED |
| Account Lockout         | `IAccountLockedHook`           | `account-lockout`         | DISABLED |
| Sessions Revoked        | `ISessionsRevokedHook`         | `sessions-revoked`        | DISABLED |
| MFA First Enabled       | `IMFAFirstEnabledHook`         | `mfa-first-enabled`       | DISABLED |

**Note:** All optional notifications default to DISABLED. Consumers opt-in by setting to `false` in `suppress` config or implementing hooks.

**Email Changed Details:**

- ONE hook triggers TWO emails for security:
  - `email-changed-old` → Sent to OLD email address (security alert)
  - `email-changed-new` → Sent to NEW email address (confirmation)
- Separate suppression controls for each template

---

## Phase 1: Core Infrastructure

### 1.1 Update Hook Registry Service

**File:** `packages/core/src/services/hook-registry.service.ts`

Add for each new hook:

- Private array: `private readonly hookNameHooks: IHookType[] = []`
- Registration method: `registerHookName(provider: IHookType): void`
- Execution method: `async executeHookName(metadata: MetadataType): Promise<void>`

**Follow existing pattern:** `registerPostSignup()` and `executePostSignup()` (non-blocking, errors logged)

### 1.2 Export New Hooks

**File:** `packages/core/src/index.ts`

Export all new hook interfaces and metadata types.

---

## Phase 2: Hook Interfaces

### 2.1 Add Hook Interfaces

**File:** `packages/core/src/interfaces/hooks.interface.ts`

Add 8 new hook interfaces following existing `IPostSignupHookProvider` pattern.

**Requirements:**

- Full JSDoc with @remarks, @example
- Metadata interface for each hook
- Non-blocking execution pattern
- Clear triggering conditions

#### IPasswordChangedHook

**Metadata:**

```typescript
interface PasswordChangedMetadata {
  user: IUser;
  changedBy: 'user' | 'admin' | 'reset';
  sessionsRevoked?: number;
  clientInfo?: ClientInfo; // Reuse existing ClientInfo interface
}

interface IPasswordChangedHook {
  execute(metadata: PasswordChangedMetadata): Promise<void>;
}
```

**Triggers:** `changePassword()`, `adminSetPassword()`, `confirmPasswordReset()`
**Use case:** Send security alert, log to SIEM, trigger re-enrollment

#### IMFADeviceRemovedHook

**Metadata:**

```typescript
interface MFADeviceRemovedMetadata {
  user: IUser;
  deviceType: MFADeviceMethod; // Reuse existing MFADeviceMethod type
  deviceName?: string;
  removedBy: 'user' | 'system';
  reason?: string; // 'email_changed' | 'phone_changed' | 'user_request'
  remainingDeviceCount: number;
  clientInfo?: ClientInfo;
}
```

**Triggers:** `removeDevices()`, `updateUserAttributes()` (email/phone change)
**Use case:** Security alert, log, warn if last device

#### IAdaptiveMFARiskDetectedHook

**Metadata:**

```typescript
interface AdaptiveMFARiskDetectedMetadata {
  user: IUser;
  riskScore: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high';
  riskFactors: RiskFactor[]; // Reuse existing RiskFactor enum
  action: 'allow' | 'require_mfa' | 'block_signin';
  authMethod: string;
  clientInfo: ClientInfo;
  timestamp: Date;
}
```

**Triggers:** `evaluateAdaptiveMFA()` when `notifyUser = true`
**Use case:** Send risk alert, log to SIEM, trigger additional verification

#### IAccountStatusChangedHook

**Metadata:**

```typescript
interface AccountStatusChangedMetadata {
  user: IUser;
  status: 'disabled' | 'enabled';
  reason?: string;
  performedBy?: string; // admin sub
  revokedSessions?: number;
  clientInfo?: ClientInfo;
}
```

**Triggers:** `disableUser()`, `enableUser()`
**Use case:** Notify user, log to compliance, trigger CRM/support

#### IEmailChangedHook

**Metadata:**

```typescript
interface EmailChangedMetadata {
  user: IUser;
  oldEmail: string;
  newEmail: string;
  updateSource: UserProfileUpdateSource; // Reuse existing type from hooks.interface
  deactivatedMFADevices?: number;
  clientInfo?: ClientInfo;
}
```

**Triggers:** `updateUserAttributes()` when email changes

**Use case:** Sends TWO emails from ONE hook execution:

1. **Security alert to OLD email** - "Your email was changed to new@example.com"
2. **Confirmation to NEW email** - "Your email has been updated"

**Built-in implementation:** Calls `sendEmailChangedAlertEmail(oldEmail, newEmail)` and `sendEmailChangedConfirmationEmail(newEmail)`

#### IAccountLockedHook

**Metadata:**

```typescript
interface AccountLockedMetadata {
  user: IUser;
  reason: string;
  lockType: 'temporary' | 'permanent';
  lockDuration?: number; // seconds
  lockedUntil?: Date;
  ipAddress?: string;
  failedAttempts?: number;
}
```

**Triggers:** `handleFailedLogin()` when lockout threshold reached
**Use case:** Notify user, log to security, trigger fraud detection

#### ISessionsRevokedHook

**Metadata:**

```typescript
interface SessionsRevokedMetadata {
  user: IUser;
  revokedCount: number;
  reason: string;
  initiatedBy: 'user' | 'admin' | 'system';
  triggerEvent?: string; // 'password_changed' | 'account_disabled' | etc
}
```

**Triggers:** `revokeAllUserSessions()` when NOT user-initiated
**Use case:** Security alert about forced logout (skip if user-initiated)

#### IMFAFirstEnabledHook

**Metadata:**

```typescript
interface MFAFirstEnabledMetadata {
  user: IUser;
  firstMethod: MFADeviceMethod;
  deviceName?: string;
  enforcedAt: Date;
  clientInfo?: ClientInfo;
}
```

**Triggers:** `enableMFAForUser()` when `isFirstDevice = true`
**Use case:** Send confirmation, log, update onboarding status

---

## Phase 3: Configuration Layer

### 3.1 Config Interface

**File:** `packages/core/src/interfaces/config.interface.ts`

Add `EmailNotificationsConfig` interface with:

```typescript
interface EmailNotificationsConfig {
  enabled?: boolean; // Global kill switch (default: true)
  suppress?: {
    // Optional notifications (all default: true = DISABLED)
    welcome?: boolean;
    passwordChanged?: boolean;
    mfaDeviceRemoved?: boolean;
    adaptiveMfaRiskDetected?: boolean;
    accountDisabled?: boolean;
    accountEnabled?: boolean;
    emailChangedOld?: boolean;
    emailChangedNew?: boolean;
    accountLockout?: boolean;
    sessionsRevoked?: boolean;
    mfaFirstEnabled?: boolean;
    // Code emails (consumers can suppress and use hooks)
    emailVerification?: boolean;
    passwordReset?: boolean;
    adminPasswordReset?: boolean;
  };
}

// Add to NAuthConfig
interface NAuthConfig {
  emailNotifications?: EmailNotificationsConfig;
}
```

### 3.2 Config Schema

**File:** `packages/core/src/schemas/auth-config.schema.ts`

Add Zod validation for `emailNotificationsSchema`.

---

## Phase 4: Hook Triggers

**Pattern for all hooks:** After operation completes, call `hookRegistry.executeHookName()` in try-catch (non-blocking).

### 4.1 Password Changed

**File:** `packages/core/src/services/auth-service-internal-helpers.ts`
**Location:** `updateUserPassword()` after line 1073
**Metadata:** Build from `user`, `params.audit`, `sessionsRevoked`, `clientInfo`
**Note:** Set `changedBy: 'reset'` for `confirmPasswordReset()` flow

### 4.2 MFA Device Removed

**Files:** `user.service.ts` (SMS/Email - system removed), `mfa.service.ts` (user removed)
**Locations:** After device deletion/deactivation
**Metadata:** `deviceType`, `deviceName`, `removedBy`, `reason`, `remainingDeviceCount`

### 4.3 Adaptive MFA Risk Detected

**File:** `adaptive-mfa-decision.service.ts`
**Location:** `evaluateAdaptiveMFA()` when `notifyUser = true`
**Metadata:** Build from `decision` object + `clientInfo`

### 4.4 Account Status Changed

**File:** `user.service.ts`
**Locations:** `disableUser()`, `enableUser()`
**Metadata:** `user`, `status`, `reason`, `performedBy` (from context), `revokedSessions`

### 4.5 Email Changed

**File:** `user.service.ts`
**Location:** `updateUserAttributes()` when email changes
**Metadata:** `oldEmail`, `newEmail`, `deactivatedMFADevices`, `updateSource`

### 4.6 Account Locked

**File:** `auth-service-internal-helpers.ts`
**Location:** `handleFailedLogin()` after IP lockout threshold
**Metadata:** Find user, build lockout info

### 4.7 Sessions Revoked

**File:** `session.service.ts`
**Location:** `revokeAllUserSessions()` - add `metadata` parameter
**Update callers:** Pass `{ initiatedBy, triggerEvent }`
**Metadata:** Skip hook if `initiatedBy === 'user'`

### 4.8 MFA First Enabled

**File:** `mfa-base.service.ts`
**Location:** `enableMFAForUser()` when `isFirstDevice = true`
**Metadata:** `firstMethod`, `enforcedAt`

---

## Phase 5: Email Provider Updates

### 5.1 Email Provider Interface

**File:** `packages/core/src/interfaces/provider.interface.ts`

Add 10 new optional methods to `EmailProvider`:

- `sendPasswordChangedEmail?()`
- `sendMFADeviceRemovedEmail?()`
- `sendAdaptiveMFARiskAlertEmail?()`
- `sendAccountDisabledEmail?()`
- `sendAccountEnabledEmail?()`
- `sendEmailChangedAlertEmail?()` (to old email)
- `sendEmailChangedConfirmationEmail?()` (to new email)
- `sendAccountLockedEmail?()`
- `sendSessionsRevokedEmail?()`
- `sendMFAFirstEnabledEmail?()`

### 5.2 Nodemailer Provider

**File:** `packages/email/nodemailer/src/nodemailer-email.provider.ts`

**Add:**

1. `private config?: NAuthConfig`
2. `setConfig(config: NAuthConfig): void` - called from init-services.ts
3. `private shouldSendEmail(notificationType: string): boolean` - checks suppression
4. Implement all 10 new methods - each calls `shouldSendEmail()` first

**Pattern:**

```typescript
async sendXxxEmail(...params): Promise<void> {
  if (!this.shouldSendEmail('xxx')) return;
  await this.send({ to, templateType: 'xxx', variables: {...} });
}
```

---

## Phase 6: Email Templates

### 6.1 Create 10 MJML Templates

**Directory:** `packages/email/nodemailer/src/templates/mjml/content/`

Follow existing patterns (reference `verification.mjml`, `password-reset.mjml`). Use Handlebars variables.

**Files:**

1. `password-changed.mjml`
2. `mfa-device-removed.mjml`
3. `adaptive-mfa-risk-alert.mjml`
4. `account-disabled.mjml`
5. `account-enabled.mjml`
6. `email-changed-old.mjml` (security alert to old email)
7. `email-changed-new.mjml` (confirmation to new email)
8. `account-lockout.mjml` (update existing if needed)
9. `sessions-revoked.mjml`
10. `mfa-first-enabled.mjml`

**Note:** Email changed creates TWO templates but uses ONE hook.

### 6.2 Update Build Script

**File:** `packages/email/nodemailer/src/templates/mjml/build-templates.js`

Add to `SUBJECTS` and `TEXT_TEMPLATES` objects. Run `yarn workspace @nauth-toolkit/email-nodemailer build:templates`.

---

## Phase 7: Service Integration

### 7.1 Constructor Updates

Add `hookRegistry?: HookRegistryService` parameter to:

- `AdaptiveMFADecisionService`
- `MFAService`
- `BaseMFAProviderService`
- `SessionService` (also needs `UserRepository` for hook metadata)

### 7.2 init-services.ts

**File:** `packages/core/src/utils/setup/init-services.ts`

1. Pass `hookRegistry` to all updated service constructors
2. Inject config into email provider: `emailProvider.setConfig?.(config)`

---

## Phase 8: Testing

**Target:** 80%+ coverage for all new code

### 8.1 Hook Registry Tests

Test registration + execution (including error handling) for all 8 new hooks

### 8.2 Hook Trigger Tests

Update service tests to verify hooks called with correct metadata (non-blocking)

### 8.3 Email Provider Tests

Test suppression logic for all 10 new methods

### 8.4 Template Build

Verify MJML compilation succeeds

---

## Phase 9: Documentation

### 9.1 Configuration Guide

**File:** `nauth-docs/docs/concepts/configuration.md`
Add `emailNotifications` section with examples (global disable, per-type suppression, hooks alternative)

### 9.2 Lifecycle Hooks Guide

**File:** `nauth-docs/docs/features/lifecycle-hooks.md` (NEW)
Follow `social-login.md` structure. Cover all 8 hooks with platform examples (NestJS/Express/Fastify).

### 9.3 API Documentation

**Directory:** `nauth-docs/docs/api/core/hooks/`
Create 16 files (alphabetical) following `@nauth-docs/API_DOCUMENTATION_RULES.md`

### 9.4 Email Templates Guide

Update `email-templates.md` with new templates and suppression config

---

## Implementation Checklist

Track progress across context windows:

### Phase 0: Cleanup & Standardization

- [ ] Rename all `TemplateType` enum values to kebab-case
- [ ] Update `template.validator.ts` with new template names
- [ ] Update `html-template.engine.ts` template registrations
- [ ] Update `NodemailerProvider` template references
- [ ] Search/replace all `TemplateType` usage across codebase
- [ ] Verify no breaking changes in existing email flows

### Phase 1: Core Infrastructure

- [ ] Update `HookRegistryService` with new registration methods
- [ ] Update `HookRegistryService` with new execution methods
- [ ] Export new hooks from `packages/core/src/index.ts`
- [ ] Add import for `RiskFactor` in hooks.interface.ts

### Phase 2: Hook Interfaces

- [ ] Add `IPasswordChangedHook` interface and metadata
- [ ] Add `IMFADeviceRemovedHook` interface and metadata
- [ ] Add `IAdaptiveMFARiskDetectedHook` interface and metadata
- [ ] Add `IAccountStatusChangedHook` interface and metadata
- [ ] Add `IEmailChangedHook` interface and metadata
- [ ] Add `IAccountLockedHook` interface and metadata
- [ ] Add `ISessionsRevokedHook` interface and metadata
- [ ] Add `IMFAFirstEnabledHook` interface and metadata

### Phase 3: Configuration Layer

- [ ] Add `EmailNotificationsConfig` to config interface
- [ ] Update Zod schema for email notifications
- [ ] Add config to `NAuthConfig` interface

### Phase 4: Hook Triggers

- [ ] Trigger password changed hook in `updateUserPassword()`
- [ ] Trigger MFA device removed hook in `updateUserAttributes()` (SMS)
- [ ] Trigger MFA device removed hook in `updateUserAttributes()` (Email)
- [ ] Trigger MFA device removed hook in `removeDevices()`
- [ ] Trigger adaptive MFA risk hook in `evaluateAdaptiveMFA()`
- [ ] Trigger account disabled hook in `disableUser()`
- [ ] Trigger account enabled hook in `enableUser()`
- [ ] Trigger email changed hook in `updateUserAttributes()`
- [ ] Trigger account locked hook in `handleFailedLogin()`
- [ ] Trigger sessions revoked hook in `revokeAllUserSessions()`
- [ ] Trigger MFA first enabled hook in `enableMFAForUser()`
- [ ] Update `revokeAllUserSessions()` signature with metadata
- [ ] Update all `revokeAllUserSessions()` callers

### Phase 5: Email Provider Updates

- [ ] Add new methods to `EmailProvider` interface
- [ ] Add `setConfig()` method to `NodemailerProvider`
- [ ] Add `shouldSendOptionalEmail()` helper
- [ ] Implement `sendPasswordChangedEmail()`
- [ ] Implement `sendMFADeviceRemovedEmail()`
- [ ] Implement `sendAdaptiveMFARiskAlertEmail()`
- [ ] Implement `sendAccountDisabledEmail()`
- [ ] Implement `sendAccountEnabledEmail()`
- [ ] Implement `sendEmailChangedAlertEmail()`
- [ ] Implement `sendEmailChangedConfirmationEmail()`
- [ ] Implement `sendAccountLockedEmail()`
- [ ] Implement `sendSessionsRevokedEmail()`
- [ ] Implement `sendMFAFirstEnabledEmail()`

### Phase 6: Email Templates

- [ ] Create `password-changed.mjml`
- [ ] Create `mfa-device-removed.mjml`
- [ ] Create `adaptive-mfa-risk-alert.mjml`
- [ ] Create `account-disabled.mjml`
- [ ] Create `account-enabled.mjml`
- [ ] Create `email-changed-old.mjml`
- [ ] Create `email-changed-new.mjml`
- [ ] Create `account-lockout.mjml`
- [ ] Create `sessions-revoked.mjml`
- [ ] Create `mfa-first-enabled.mjml`
- [ ] Update `build-templates.js` with new subjects
- [ ] Update `build-templates.js` with text templates
- [ ] Run build script and verify compilation

### Phase 7: Service Integration

- [ ] Update `AuthServiceInternalHelpers` constructor
- [ ] Update `AdaptiveMFADecisionService` constructor
- [ ] Update `MFAService` constructor
- [ ] Update `UserService` constructor
- [ ] Update `BaseMFAProviderService` constructor
- [ ] Update `SessionService` constructor
- [ ] Update `init-services.ts` to pass hookRegistry
- [ ] Update `init-services.ts` to inject config into email provider
- [ ] Add `UserRepository` to `SessionService` for hook metadata

### Phase 8: Testing

- [ ] Test new hook registry methods (registration)
- [ ] Test new hook registry methods (execution)
- [ ] Test hook triggers in `auth-service-internal-helpers`
- [ ] Test hook triggers in `user.service`
- [ ] Test hook triggers in `mfa.service`
- [ ] Test hook triggers in `adaptive-mfa-decision.service`
- [ ] Test hook triggers in `session.service`
- [ ] Test hook triggers in `mfa-base.service`
- [ ] Test email provider suppression logic
- [ ] Test all new email provider methods
- [ ] Verify test coverage 80%+

### Phase 9: Documentation

- [ ] Add email notifications section to `configuration.md`
- [ ] Create `lifecycle-hooks.md` feature guide
- [ ] Create API docs for all hook interfaces (16 files)
- [ ] Update `email-templates.md` with new templates and cleanup
- [ ] Document email-changed dual-email behavior
- [ ] Update sidebar.ts with new docs
- [ ] Verify alphabetical ordering in API docs
- [ ] Verify platform tabs use `groupId="platform"`
- [ ] Add migration notes for TemplateType enum changes (if needed)

---

## Validation Checklist

**Per `@docs/PROJ_RULES.md`:**

- [ ] All classes/methods/interfaces have JSDoc with @example
- [ ] Complex logic has inline comments (WHY not WHAT)
- [ ] Section headers: `// ============`
- [ ] Zero `any` types
- [ ] Explicit return types
- [ ] No `console.log()` (use logger)
- [ ] No emojis
- [ ] 80%+ test coverage
- [ ] Tests pass: `yarn workspace @nauth-toolkit/core test`
- [ ] Build clean: `yarn workspace @nauth-toolkit/core build`
- [ ] No lint errors: `yarn workspace @nauth-toolkit/core lint`
- [ ] Docs follow `@nauth-docs/API_DOCUMENTATION_RULES.md`
- [ ] Alphabetical order in API docs
- [ ] Platform tabs use `groupId="platform"`
- [ ] Hooks non-blocking (errors logged, don't fail operations)
- [ ] All emails can be suppressed
- [ ] Email provider receives config via `setConfig()`

---

## Implementation Patterns

**Hook Execution (Non-blocking):**

```typescript
if (this.hookRegistry) {
  try {
    await this.hookRegistry.executeHookName(metadata);
  } catch (hookError) {
    const errorMessage = hookError instanceof Error ? hookError.message : 'Unknown error';
    this.logger?.error?.(
      `Failed to execute hook: ${errorMessage}`,
      hookError instanceof Error ? { error: hookError } : undefined,
    );
  }
}
```

**Email Suppression Check:**

```typescript
private shouldSendEmail(notificationType: string): boolean {
  const notifications = this.config?.emailNotifications;
  if (notifications?.enabled === false) return false;
  if (notifications?.suppress?.[notificationType]) return false;
  return true;
}
```

**Existing Types to Reuse:**

- `ClientInfo` - from `packages/core/src/interfaces/client-info.interface.ts`
- `MFADeviceMethod` - from `packages/core/src/enums/mfa-method.enum.ts`
- `RiskFactor` - from `packages/core/src/enums/risk-factor.enum.ts`
- `UserProfileUpdateSource` - from `packages/core/src/interfaces/hooks.interface.ts`
- `IUser` - from `packages/core/src/interfaces/entities.interface.ts`

**Existing System Reference:**

- MJML templates: `packages/email/nodemailer/src/templates/mjml/content/`
- Build script: `build-templates.js`
- NodemailerProvider: Follow `sendVerificationEmail()` pattern
- Hook pattern: Follow `IPostSignupHookProvider` + `executePostSignup()`

---

**End of Implementation Plan**
