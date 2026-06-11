/**
 * NestJS Hook Decorators
 *
 * These decorators provide a declarative way to register authentication lifecycle hooks in NestJS applications.
 * Classes decorated with @PreSignupHook or @PostSignupHook will be automatically registered with the HookRegistryService
 * when the module is initialized.
 *
 * @example
 * ```typescript
 * import { Injectable } from '@nestjs/common';
 * import { PreSignupHook } from '@nauth-toolkit/nestjs';
 * import { IPreSignupHookProvider, NAuthException, AuthErrorCode } from '@nauth-toolkit/core';
 *
 * @Injectable()
 * @PreSignupHook({ priority: 1 })
 * export class DomainValidationHook implements IPreSignupHookProvider {
 *   async execute(userData, signupMethod, providerId, adminSignup) {
 *     const domain = userData.email.split('@')[1];
 *     if (domain === 'blocked.com') {
 *       throw new NAuthException(AuthErrorCode.PRESIGNUP_FAILED, 'Domain not allowed');
 *     }
 *   }
 * }
 * ```
 */

import { SetMetadata } from '@nestjs/common';

export const HOOK_METADATA_KEY = 'nauth:hook';

/**
 * Hook types supported by NAuth
 */
export type HookType =
  | 'preSignup'
  | 'postSignup'
  | 'userProfileUpdated'
  | 'passwordChanged'
  | 'mfaDeviceRemoved'
  | 'adaptiveMfaRiskDetected'
  | 'accountStatusChanged'
  | 'emailChanged'
  | 'accountLocked'
  | 'sessionsRevoked'
  | 'mfaFirstEnabled';

/**
 * Metadata stored on hook provider classes
 */
export interface HookMetadata {
  type: HookType;
  priority?: number;
}

/**
 * Options for hook decorators
 */
export interface HookDecoratorOptions {
  /**
   * Execution priority (lower numbers execute first)
   * Default: 100
   */
  priority?: number;
}

/**
 * Marks a provider as a pre-signup hook
 *
 * Pre-signup hooks are executed before a user account is created, allowing you to:
 * - Validate user data against business rules
 * - Block signups based on domain, IP, or other criteria
 * - Enrich user data before storage
 *
 * Hooks can block signup by throwing NAuthException with AuthErrorCode.PRESIGNUP_FAILED
 *
 * @param options - Hook configuration options
 *
 * @example
 * ```typescript
 * @Injectable()
 * @PreSignupHook({ priority: 1 })
 * export class DomainValidationHook implements IPreSignupHookProvider {
 *   async execute(userData, signupMethod, providerId, adminSignup) {
 *     const allowedDomains = ['company.com', 'partner.com'];
 *     const domain = userData.email.split('@')[1];
 *
 *     if (!allowedDomains.includes(domain)) {
 *       throw new NAuthException(
 *         AuthErrorCode.PRESIGNUP_FAILED,
 *         `Email domain ${domain} is not allowed`
 *       );
 *     }
 *   }
 * }
 * ```
 */
export function PreSignupHook(options: HookDecoratorOptions = {}): ClassDecorator {
  const metadata: HookMetadata = {
    type: 'preSignup',
    priority: options.priority ?? 100,
  };
  return SetMetadata(HOOK_METADATA_KEY, metadata);
}

/**
 * Marks a provider as a post-signup hook
 *
 * Post-signup hooks are executed after a user account is successfully created, allowing you to:
 * - Send welcome emails or notifications
 * - Sync user data to external systems
 * - Trigger analytics events
 * - Assign default roles or permissions
 *
 * These hooks cannot block signup (user is already created) but errors are logged and can be
 * handled by your application.
 *
 * @param options - Hook configuration options
 */
export function PostSignupHook(options: HookDecoratorOptions = {}): ClassDecorator {
  const metadata: HookMetadata = {
    type: 'postSignup',
    priority: options.priority ?? 100,
  };
  return SetMetadata(HOOK_METADATA_KEY, metadata);
}

/**
 * Marks a provider as a user profile updated hook
 *
 * User profile updated hooks are executed after user profile attributes change, allowing you to:
 * - Sync profile changes to CRM systems
 * - Send notifications about profile updates
 * - Trigger analytics events for profile changes
 * - Update cached user data in external services
 *
 * These hooks cannot block profile updates (changes are already saved) but errors are logged and can be
 * handled by your application.
 *
 * @param options - Hook configuration options
 *
 * @example
 * ```typescript
 * @Injectable()
 * @UserProfileUpdatedHook({ priority: 1 })
 * export class CrmSyncHook implements IUserProfileUpdatedHook {
 *   constructor(private readonly crmService: CrmService) {}
 *
 *   async execute(metadata: UserProfileUpdatedMetadata) {
 *     // Sync email changes to CRM
 *     const emailChange = metadata.changedFields.find(f => f.fieldName === 'email');
 *     if (emailChange) {
 *       await this.crmService.updateContact(metadata.user.sub, {
 *         email: emailChange.newValue
 *       });
 *     }
 *   }
 * }
 * ```
 */
export function UserProfileUpdatedHook(options: HookDecoratorOptions = {}): ClassDecorator {
  const metadata: HookMetadata = {
    type: 'userProfileUpdated',
    priority: options.priority ?? 100,
  };
  return SetMetadata(HOOK_METADATA_KEY, metadata);
}

/**
 * Marks a provider as a password changed hook
 *
 * Password changed hooks are executed after a password is successfully changed, allowing you to:
 * - Send security notification emails
 * - Log password change events
 * - Revoke active sessions
 * - Trigger security audits
 *
 * These hooks cannot block password changes (password is already updated) but errors are logged.
 *
 * @param options - Hook configuration options
 *
 * @example
 * ```typescript
 * @Injectable()
 * @PasswordChangedHook({ priority: 1 })
 * export class PasswordChangedNotificationHook implements IPasswordChangedHook {
 *   constructor(private readonly emailService: EmailService) {}
 *
 *   async execute(metadata: PasswordChangedMetadata) {
 *     await this.emailService.sendPasswordChangedAlert({
 *       to: metadata.user.email,
 *       changedBy: metadata.changedBy,
 *     });
 *   }
 * }
 * ```
 */
export function PasswordChangedHook(options: HookDecoratorOptions = {}): ClassDecorator {
  const metadata: HookMetadata = {
    type: 'passwordChanged',
    priority: options.priority ?? 100,
  };
  return SetMetadata(HOOK_METADATA_KEY, metadata);
}

/**
 * Marks a provider as an MFA device removed hook
 *
 * MFA device removed hooks are executed after an MFA device is removed, allowing you to:
 * - Send security notification emails
 * - Log device removal events
 * - Alert if user has no remaining MFA devices
 * - Trigger security audits
 *
 * These hooks cannot block device removal (device is already removed) but errors are logged.
 *
 * @param options - Hook configuration options
 *
 * @example
 * ```typescript
 * @Injectable()
 * @MFADeviceRemovedHook({ priority: 1 })
 * export class MFADeviceRemovedNotificationHook implements IMFADeviceRemovedHook {
 *   constructor(private readonly emailService: EmailService) {}
 *
 *   async execute(metadata: MFADeviceRemovedMetadata) {
 *     await this.emailService.sendMFADeviceRemovedAlert({
 *       to: metadata.user.email,
 *       deviceType: metadata.deviceType,
 *       remainingDevices: metadata.remainingDeviceCount,
 *     });
 *   }
 * }
 * ```
 */
export function MFADeviceRemovedHook(options: HookDecoratorOptions = {}): ClassDecorator {
  const metadata: HookMetadata = {
    type: 'mfaDeviceRemoved',
    priority: options.priority ?? 100,
  };
  return SetMetadata(HOOK_METADATA_KEY, metadata);
}

/**
 * Marks a provider as an adaptive MFA risk detected hook
 *
 * Adaptive MFA risk detected hooks are executed when high-risk signin activity is detected, allowing you to:
 * - Send risk alert emails to users
 * - Notify security teams
 * - Log suspicious activity
 * - Trigger additional security checks
 *
 * These hooks cannot block authentication (risk decision is already made) but errors are logged.
 *
 * @param options - Hook configuration options
 *
 * @example
 * ```typescript
 * @Injectable()
 * @AdaptiveMFARiskDetectedHook({ priority: 1 })
 * export class RiskAlertHook implements IAdaptiveMFARiskDetectedHook {
 *   constructor(private readonly emailService: EmailService) {}
 *
 *   async execute(metadata: AdaptiveMFARiskDetectedMetadata) {
 *     await this.emailService.sendRiskAlert({
 *       to: metadata.user.email,
 *       riskLevel: metadata.riskLevel,
 *       riskFactors: metadata.riskFactors,
 *     });
 *   }
 * }
 * ```
 */
export function AdaptiveMFARiskDetectedHook(options: HookDecoratorOptions = {}): ClassDecorator {
  const metadata: HookMetadata = {
    type: 'adaptiveMfaRiskDetected',
    priority: options.priority ?? 100,
  };
  return SetMetadata(HOOK_METADATA_KEY, metadata);
}

/**
 * Marks a provider as an account status changed hook
 *
 * Account status changed hooks are executed after an account is enabled or disabled, allowing you to:
 * - Send account status notification emails
 * - Log account status changes
 * - Sync status to external systems
 * - Trigger compliance workflows
 *
 * These hooks cannot block status changes (status is already updated) but errors are logged.
 *
 * @param options - Hook configuration options
 *
 * @example
 * ```typescript
 * @Injectable()
 * @AccountStatusChangedHook({ priority: 1 })
 * export class AccountStatusNotificationHook implements IAccountStatusChangedHook {
 *   constructor(private readonly emailService: EmailService) {}
 *
 *   async execute(metadata: AccountStatusChangedMetadata) {
 *     if (metadata.status === 'disabled') {
 *       await this.emailService.sendAccountDisabledAlert({
 *         to: metadata.user.email,
 *         reason: metadata.reason,
 *       });
 *     }
 *   }
 * }
 * ```
 */
export function AccountStatusChangedHook(options: HookDecoratorOptions = {}): ClassDecorator {
  const metadata: HookMetadata = {
    type: 'accountStatusChanged',
    priority: options.priority ?? 100,
  };
  return SetMetadata(HOOK_METADATA_KEY, metadata);
}

/**
 * Marks a provider as an email changed hook
 *
 * Email changed hooks are executed after a user's email address is changed, allowing you to:
 * - Send notification to both old and new email addresses
 * - Log email change events
 * - Sync to external systems
 * - Trigger security audits
 *
 * These hooks cannot block email changes (email is already updated) but errors are logged.
 *
 * @param options - Hook configuration options
 *
 * @example
 * ```typescript
 * @Injectable()
 * @EmailChangedHook({ priority: 1 })
 * export class EmailChangedNotificationHook implements IEmailChangedHook {
 *   constructor(private readonly emailService: EmailService) {}
 *
 *   async execute(metadata: EmailChangedMetadata) {
 *     await this.emailService.sendEmailChangedAlert({
 *       oldEmail: metadata.oldEmail,
 *       newEmail: metadata.newEmail,
 *     });
 *   }
 * }
 * ```
 */
export function EmailChangedHook(options: HookDecoratorOptions = {}): ClassDecorator {
  const metadata: HookMetadata = {
    type: 'emailChanged',
    priority: options.priority ?? 100,
  };
  return SetMetadata(HOOK_METADATA_KEY, metadata);
}

/**
 * Marks a provider as an account locked hook
 *
 * Account locked hooks are executed after an account is locked due to failed login attempts, allowing you to:
 * - Send lockout notification emails
 * - Log lockout events
 * - Trigger security alerts
 * - Provide unlock instructions
 *
 * These hooks cannot block lockouts (account is already locked) but errors are logged.
 *
 * @param options - Hook configuration options
 *
 * @example
 * ```typescript
 * @Injectable()
 * @AccountLockedHook({ priority: 1 })
 * export class AccountLockedNotificationHook implements IAccountLockedHook {
 *   constructor(private readonly emailService: EmailService) {}
 *
 *   async execute(metadata: AccountLockedMetadata) {
 *     await this.emailService.sendAccountLockedAlert({
 *       to: metadata.user.email,
 *       reason: metadata.lockoutReason,
 *       unlockTime: metadata.unlockTime,
 *     });
 *   }
 * }
 * ```
 */
export function AccountLockedHook(options: HookDecoratorOptions = {}): ClassDecorator {
  const metadata: HookMetadata = {
    type: 'accountLocked',
    priority: options.priority ?? 100,
  };
  return SetMetadata(HOOK_METADATA_KEY, metadata);
}

/**
 * Marks a provider as a sessions revoked hook
 *
 * Sessions revoked hooks are executed after user sessions are bulk revoked, allowing you to:
 * - Send security notification emails
 * - Log session revocation events
 * - Trigger security audits
 * - Alert users of forced logouts
 *
 * These hooks cannot block session revocation (sessions are already revoked) but errors are logged.
 *
 * @param options - Hook configuration options
 *
 * @example
 * ```typescript
 * @Injectable()
 * @SessionsRevokedHook({ priority: 1 })
 * export class SessionsRevokedNotificationHook implements ISessionsRevokedHook {
 *   constructor(private readonly emailService: EmailService) {}
 *
 *   async execute(metadata: SessionsRevokedMetadata) {
 *     await this.emailService.sendSessionsRevokedAlert({
 *       to: metadata.user.email,
 *       revokedCount: metadata.revokedCount,
 *       reason: metadata.reason,
 *     });
 *   }
 * }
 * ```
 */
export function SessionsRevokedHook(options: HookDecoratorOptions = {}): ClassDecorator {
  const metadata: HookMetadata = {
    type: 'sessionsRevoked',
    priority: options.priority ?? 100,
  };
  return SetMetadata(HOOK_METADATA_KEY, metadata);
}

/**
 * Marks a provider as an MFA first enabled hook
 *
 * MFA first enabled hooks are executed after a user enables MFA for the first time, allowing you to:
 * - Send congratulations emails
 * - Log MFA enablement events
 * - Track security adoption
 * - Reward users for enabling MFA
 *
 * These hooks cannot block MFA enablement (MFA is already enabled) but errors are logged.
 *
 * @param options - Hook configuration options
 *
 * @example
 * ```typescript
 * @Injectable()
 * @MFAFirstEnabledHook({ priority: 1 })
 * export class MFAFirstEnabledNotificationHook implements IMFAFirstEnabledHook {
 *   constructor(private readonly emailService: EmailService) {}
 *
 *   async execute(metadata: MFAFirstEnabledMetadata) {
 *     await this.emailService.sendMFAEnabledCongrats({
 *       to: metadata.user.email,
 *       method: metadata.firstMethod,
 *     });
 *   }
 * }
 * ```
 */
export function MFAFirstEnabledHook(options: HookDecoratorOptions = {}): ClassDecorator {
  const metadata: HookMetadata = {
    type: 'mfaFirstEnabled',
    priority: options.priority ?? 100,
  };
  return SetMetadata(HOOK_METADATA_KEY, metadata);
}
