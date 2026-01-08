/**
 * Hook provider interfaces for extending authentication flows
 *
 * Hooks allow consumer applications to inject custom logic at specific points
 * in the authentication flow. Unlike config-based hooks, provider-based hooks
 * support dependency injection and are registered after bootstrap.
 *
 * @packageDocumentation
 */

import { SignupDTO } from '../dto/signup.dto';
import { AdminSignupDTO } from '../dto/admin-signup.dto';
import { OAuthUserProfile } from './oauth.interface';
import { IUser } from './entities.interface';

/**
 * Union type for pre-signup hook data
 *
 * Represents the data passed to pre-signup hooks:
 * - `SignupDTO` for regular password signups
 * - `AdminSignupDTO` for admin-initiated password signups
 * - `OAuthUserProfile` for social signups
 */
export type PreSignupHookData = SignupDTO | AdminSignupDTO | OAuthUserProfile;

/**
 * Pre-signup hook provider interface
 *
 * Validates signup attempts before user creation.
 * Can block signup by throwing NAuthException with PRESIGNUP_FAILED.
 *
 * @remarks
 * This hook is triggered:
 * - **Password signup**: Before user is created in the database
 * - **Social signup**: Before user is created (for both web redirect and native mobile flows)
 * - **Admin signup**: Before user is created (both `adminSignup` and `adminSignupSocial`)
 */
export interface IPreSignupHookProvider {
  /**
   * Execute pre-signup validation
   *
   * @param data - SignupDTO or AdminSignupDTO for password signup, OAuthUserProfile for social signup
   * @param signupType - Type of signup ('password' or 'social')
   * @param provider - Social provider name (only for social signups, e.g., 'google', 'apple', 'facebook')
   * @param adminSignup - true for admin signups, false for regular signups
   * @throws {NAuthException} with PRESIGNUP_FAILED to block signup
   */
  execute(
    data: PreSignupHookData,
    signupType: 'password' | 'social',
    provider?: string,
    adminSignup?: boolean,
  ): Promise<void>;
}

/**
 * Post-signup hook provider interface
 *
 * Executes actions after user creation (non-blocking).
 * Errors are logged but do not affect signup.
 *
 * @remarks
 * This hook is triggered:
 * - **Password signup**: Immediately after user is created, before email/phone verification challenges
 * - **Social signup**: Immediately after user is created (for both web redirect and native mobile flows)
 * - **Admin signup**: Immediately after user is created (both `adminSignup` and `adminSignupSocial`)
 *
 * The hook is non-blocking. If it throws an error, the error is logged but signup continues.
 * The user account has already been created when the hook is called.
 */
export interface IPostSignupHookProvider {
  /**
   * Execute post-signup actions
   *
   * @param user - Created user entity (IUser interface)
   * @param metadata - Signup metadata providing context about the signup event
   */
  execute(user: IUser, metadata?: SignupMetadata): Promise<void>;
}

/**
 * Signup metadata passed to postSignup hook
 *
 * Provides context about the signup event.
 */
export interface SignupMetadata {
  /**
   * Whether user needs to complete verification challenges
   */
  requiresVerification?: boolean;

  /**
   * Type of signup
   */
  signupType?: 'password' | 'social';

  /**
   * Social provider name (only present for social signups)
   *
   * @example 'google' | 'apple' | 'facebook'
   */
  provider?: string;

  /**
   * Whether this is an admin-initiated signup
   *
   * @remarks
   * true for adminSignup() and adminSignupSocial() methods
   * false (or undefined) for regular user signups
   */
  adminSignup?: boolean;

  /**
   * Social metadata from OAuth provider (only present for social signups)
   *
   * Contains the raw OAuth profile data stored in the social account metadata field.
   * This includes all provider-specific fields like sub, given_name, family_name, locale, etc.
   *
   * @example
   * ```json
   * {
   *   "sub": "google_123",
   *   "email": "user@gmail.com",
   *   "given_name": "John",
   *   "family_name": "Doe",
   *   "picture": "https://...",
   *   "locale": "en"
   * }
   * ```
   */
  socialMetadata?: Record<string, unknown> | null;

  /**
   * Profile picture URL from OAuth provider (only present for social signups)
   *
   * Extracted from the OAuth profile for convenience.
   * Also available in socialMetadata.picture.
   *
   * @example "https://lh3.googleusercontent.com/a/..."
   */
  profilePicture?: string | null;
}

// ============================================================================
// Onboarding Completed Hook
// ============================================================================

/**
 * Onboarding completion source
 *
 * Indicates what caused onboarding to become "complete":
 * - `signup`: Signup did not require verification (verificationMethod = 'none')
 * - `email_verification`: Email verification completed onboarding
 * - `phone_verification`: Phone verification completed onboarding
 */
export type OnboardingCompletionSource = 'signup' | 'email_verification' | 'phone_verification';

/**
 * Onboarding completed metadata
 *
 * Fired exactly once when the user has satisfied the configured signup verification requirements.
 *
 * @remarks
 * This is the correct lifecycle event for sending “welcome” style emails because it represents
 * "the user can now proceed" — either immediately after signup (no verification required) or
 * after the required verification(s) succeed.
 */
export interface OnboardingCompletedMetadata {
  /**
   * Configured signup verification method at the time of completion
   *
   * @example 'none' | 'email' | 'phone' | 'both'
   */
  verificationMethod: 'none' | 'email' | 'phone' | 'both';

  /**
   * What completed onboarding
   */
  source: OnboardingCompletionSource;

  /**
   * When onboarding was completed
   */
  completedAt: Date;
}

/**
 * Onboarding completed hook interface
 *
 * Executes actions after onboarding becomes complete (non-blocking).
 *
 * @example
 * ```typescript
 * export class WelcomeAnalyticsHook implements IOnboardingCompletedHook {
 *   async execute(user: IUser, metadata: OnboardingCompletedMetadata): Promise<void> {
 *     // Track onboarding completion event
 *     await this.analytics.track('onboarding_completed', {
 *       userSub: user.sub,
 *       verificationMethod: metadata.verificationMethod,
 *       source: metadata.source,
 *     });
 *   }
 * }
 * ```
 */
export interface IOnboardingCompletedHook {
  /**
   * Execute onboarding completed actions
   *
   * @param user - User entity (IUser interface)
   * @param metadata - Completion metadata (verification method, source, timestamp)
   */
  execute(user: IUser, metadata: OnboardingCompletedMetadata): Promise<void>;
}

// ============================================================================
// User Profile Updated Hook
// ============================================================================

/**
 * User profile update source
 *
 * Indicates what triggered the profile update.
 */
export type UserProfileUpdateSource =
  | 'user_request' // User-initiated update via updateUserAttributes()
  | 'admin_action' // Admin-initiated update via updateVerifiedStatus()
  | 'email_verification' // Email verified via verification flow
  | 'phone_verification'; // Phone verified via verification flow

/**
 * Changed field metadata
 *
 * Tracks old and new values for a single field.
 */
export interface ChangedField {
  /**
   * Field name that changed
   */
  fieldName: string;

  /**
   * Previous value before update
   */
  oldValue: unknown;

  /**
   * New value after update
   */
  newValue: unknown;
}

/**
 * User profile updated metadata
 *
 * Provides context about the profile update event.
 */
export interface UserProfileUpdatedMetadata {
  /**
   * Updated user entity (full object after change)
   */
  user: IUser;

  /**
   * Array of fields that changed with old and new values
   */
  changedFields: ChangedField[];

  /**
   * What triggered the update
   */
  updateSource: UserProfileUpdateSource;

  /**
   * Admin user sub who performed the action (only for admin_action source)
   */
  performedBy?: string;

  /**
   * Client information (IP address, user agent, location)
   */
  clientInfo?: import('./client-info.interface').ClientInfo;
}

/**
 * User profile updated hook interface
 *
 * Executes actions after user profile attributes change (non-blocking).
 * Errors are logged but do not affect the update operation.
 *
 * @remarks
 * This hook is triggered when:
 * - Core attributes change (firstName, lastName, username, email, phone, metadata)
 * - Verification status changes (isEmailVerified, isPhoneVerified)
 *
 * This hook is NOT triggered for:
 * - Password changes
 * - Account lock/unlock
 * - Login state changes
 * - MFA changes
 * - Social account linkages
 *
 * The hook is non-blocking. If it throws an error, the error is logged but the update continues.
 * The user profile has already been updated when the hook is called.
 *
 * @example
 * ```typescript
 * export class CrmSyncHook implements IUserProfileUpdatedHook {
 *   async execute(metadata: UserProfileUpdatedMetadata): Promise<void> {
 *     // Sync to CRM when email changes
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
export interface IUserProfileUpdatedHook {
  /**
   * Execute user profile updated actions
   *
   * @param metadata - Profile update context with user, changed fields, and update source
   */
  execute(metadata: UserProfileUpdatedMetadata): Promise<void>;
}

// ============================================================================
// Password Changed Hook
// ============================================================================

/**
 * Password changed metadata
 *
 * Provides context about password change events.
 */
export interface PasswordChangedMetadata {
  /**
   * User whose password was changed
   */
  user: IUser;

  /**
   * How the password was changed
   *
   * - 'user': User changed their own password
   * - 'admin': Admin set new password
   * - 'reset': Password reset via forgot-password flow
   */
  changedBy: 'user' | 'admin' | 'reset';

  /**
   * Number of sessions revoked (optional)
   */
  sessionsRevoked?: number;

  /**
   * Client information (IP address, user agent, location)
   */
  clientInfo?: import('./client-info.interface').ClientInfo;
}

/**
 * Password changed hook interface
 *
 * Executes actions after password is changed (non-blocking).
 * Errors are logged but do not affect the password change operation.
 *
 * @remarks
 * This hook is triggered when:
 * - User changes their password via `changePassword()`
 * - Admin sets new password via `adminSetPassword()`
 * - User completes password reset via `confirmPasswordReset()`
 *
 * The hook is non-blocking. If it throws an error, the error is logged
 * but the password has already been changed when the hook is called.
 *
 * Use cases:
 * - Send security alert email
 * - Log to SIEM
 * - Trigger account re-enrollment
 * - Update external systems
 *
 * @example
 * ```typescript
 * export class PasswordChangedEmailHook implements IPasswordChangedHook {
 *   async execute(metadata: PasswordChangedMetadata): Promise<void> {
 *     const { user, changedBy, sessionsRevoked } = metadata;
 *     await this.emailService.sendPasswordChangedEmail(
 *       user.email,
 *       { changedBy, sessionsRevoked }
 *     );
 *   }
 * }
 * ```
 */
export interface IPasswordChangedHook {
  /**
   * Execute password changed actions
   *
   * @param metadata - Password change context with user and change details
   */
  execute(metadata: PasswordChangedMetadata): Promise<void>;
}

// ============================================================================
// MFA Device Removed Hook
// ============================================================================

/**
 * MFA device removed metadata
 *
 * Provides context about MFA device removal events.
 */
export interface MFADeviceRemovedMetadata {
  /**
   * User whose MFA device was removed
   */
  user: IUser;

  /**
   * Type of MFA device that was removed
   */
  deviceType: import('../enums/mfa-method.enum').MFADeviceMethod;

  /**
   * Device name (optional, user-provided label)
   */
  deviceName?: string;

  /**
   * Who removed the device
   *
   * - 'user': User removed their own device
   * - 'system': System removed device (e.g., after email/phone change)
   */
  removedBy: 'user' | 'system';

  /**
   * Reason for removal
   *
   * - 'email_changed': Email changed, email MFA device removed
   * - 'phone_changed': Phone changed, SMS MFA device removed
   * - 'user_request': User requested removal
   * - 'admin_action': Admin removed device
   */
  reason?: string;

  /**
   * Number of MFA devices remaining after removal
   */
  remainingDeviceCount: number;

  /**
   * Client information (IP address, user agent, location)
   */
  clientInfo?: import('./client-info.interface').ClientInfo;
}

/**
 * MFA device removed hook interface
 *
 * Executes actions after MFA device is removed (non-blocking).
 * Errors are logged but do not affect the removal operation.
 *
 * @remarks
 * This hook is triggered when:
 * - User removes MFA device via `removeDevices()`
 * - System removes device due to email/phone change via `updateUserAttributes()`
 *
 * The hook is non-blocking. If it throws an error, the error is logged
 * but the device has already been removed when the hook is called.
 *
 * Use cases:
 * - Send security alert email
 * - Log to SIEM
 * - Warn if last device removed
 * - Update external systems
 *
 * @example
 * ```typescript
 * export class MFADeviceRemovedAlertHook implements IMFADeviceRemovedHook {
 *   async execute(metadata: MFADeviceRemovedMetadata): Promise<void> {
 *     const { user, deviceType, remainingDeviceCount } = metadata;
 *     if (remainingDeviceCount === 0) {
 *       await this.emailService.sendMFADeviceRemovedEmail(
 *         user.email,
 *         { deviceType, warning: 'No MFA devices remaining' }
 *       );
 *     }
 *   }
 * }
 * ```
 */
export interface IMFADeviceRemovedHook {
  /**
   * Execute MFA device removed actions
   *
   * @param metadata - Device removal context with user and device details
   */
  execute(metadata: MFADeviceRemovedMetadata): Promise<void>;
}

// ============================================================================
// Adaptive MFA Risk Detected Hook
// ============================================================================

/**
 * Adaptive MFA risk detected metadata
 *
 * Provides context about adaptive MFA risk evaluation events.
 */
export interface AdaptiveMFARiskDetectedMetadata {
  /**
   * User being authenticated
   */
  user: IUser;

  /**
   * Risk score (0-100)
   */
  riskScore: number;

  /**
   * Risk level classification
   */
  riskLevel: 'low' | 'medium' | 'high';

  /**
   * Detected risk factors
   */
  riskFactors: import('../enums/risk-factor.enum').RiskFactor[];

  /**
   * Action taken based on risk level
   *
   * - 'allow': No MFA required
   * - 'require_mfa': MFA verification required
   * - 'block_signin': Sign-in blocked
   */
  action: 'allow' | 'require_mfa' | 'block_signin';

  /**
   * Authentication method used
   */
  authMethod: string;

  /**
   * Client information (IP address, user agent, location)
   */
  clientInfo: import('./client-info.interface').ClientInfo;

  /**
   * Event timestamp
   */
  timestamp: Date;
}

/**
 * Adaptive MFA risk detected hook interface
 *
 * Executes actions when adaptive MFA evaluates risk (non-blocking).
 * Only triggered when notifyUser is true in risk level config.
 * Errors are logged but do not affect authentication flow.
 *
 * @remarks
 * This hook is triggered when:
 * - Adaptive MFA evaluates login and detects risk factors
 * - Risk level configuration has `notifyUser: true`
 *
 * The hook is non-blocking. If it throws an error, the error is logged
 * but authentication flow continues normally.
 *
 * Use cases:
 * - Send risk alert email
 * - Log to SIEM
 * - Trigger additional verification
 * - Update fraud detection systems
 *
 * @example
 * ```typescript
 * export class AdaptiveMFARiskAlertHook implements IAdaptiveMFARiskDetectedHook {
 *   async execute(metadata: AdaptiveMFARiskDetectedMetadata): Promise<void> {
 *     const { user, riskScore, riskLevel, riskFactors } = metadata;
 *     if (riskLevel === 'high') {
 *       await this.emailService.sendRiskAlertEmail(
 *         user.email,
 *         { riskScore, riskFactors }
 *       );
 *     }
 *   }
 * }
 * ```
 */
export interface IAdaptiveMFARiskDetectedHook {
  /**
   * Execute adaptive MFA risk detected actions
   *
   * @param metadata - Risk evaluation context with user and risk details
   */
  execute(metadata: AdaptiveMFARiskDetectedMetadata): Promise<void>;
}

// ============================================================================
// Account Status Changed Hook
// ============================================================================

/**
 * Account status changed metadata
 *
 * Provides context about account enable/disable events.
 */
export interface AccountStatusChangedMetadata {
  /**
   * User whose account status changed
   */
  user: IUser;

  /**
   * New account status
   *
   * - 'disabled': Account was disabled
   * - 'enabled': Account was enabled
   */
  status: 'disabled' | 'enabled';

  /**
   * Reason for status change
   */
  reason?: string;

  /**
   * Admin who performed the action (admin sub)
   */
  performedBy?: string;

  /**
   * Number of sessions revoked (for disable action)
   */
  revokedSessions?: number;

  /**
   * Client information (IP address, user agent, location)
   */
  clientInfo?: import('./client-info.interface').ClientInfo;
}

/**
 * Account status changed hook interface
 *
 * Executes actions after account is enabled or disabled (non-blocking).
 * Errors are logged but do not affect the status change operation.
 *
 * @remarks
 * This hook is triggered when:
 * - Admin disables user account via `disableUser()`
 * - Admin enables user account via `enableUser()`
 *
 * The hook is non-blocking. If it throws an error, the error is logged
 * but the account status has already been changed when the hook is called.
 *
 * Use cases:
 * - Notify user of account status change
 * - Log to compliance system
 * - Trigger CRM/support workflows
 * - Update external systems
 *
 * @example
 * ```typescript
 * export class AccountStatusNotificationHook implements IAccountStatusChangedHook {
 *   async execute(metadata: AccountStatusChangedMetadata): Promise<void> {
 *     const { user, status, reason } = metadata;
 *     if (status === 'disabled') {
 *       await this.emailService.sendAccountDisabledEmail(
 *         user.email,
 *         { reason }
 *       );
 *     }
 *   }
 * }
 * ```
 */
export interface IAccountStatusChangedHook {
  /**
   * Execute account status changed actions
   *
   * @param metadata - Status change context with user and change details
   */
  execute(metadata: AccountStatusChangedMetadata): Promise<void>;
}

// ============================================================================
// Email Changed Hook
// ============================================================================

/**
 * Email changed metadata
 *
 * Provides context about email change events.
 */
export interface EmailChangedMetadata {
  /**
   * User whose email was changed
   */
  user: IUser;

  /**
   * Old email address (before change)
   */
  oldEmail: string;

  /**
   * New email address (after change)
   */
  newEmail: string;

  /**
   * Source of the email change
   */
  updateSource: UserProfileUpdateSource;

  /**
   * Number of MFA devices deactivated due to email change
   */
  deactivatedMFADevices?: number;

  /**
   * Client information (IP address, user agent, location)
   */
  clientInfo?: import('./client-info.interface').ClientInfo;
}

/**
 * Email changed hook interface
 *
 * Executes actions after email address is changed (non-blocking).
 * Errors are logged but do not affect the email change operation.
 *
 * @remarks
 * This hook is triggered when:
 * - User changes email via `updateUserAttributes()`
 *
 * The hook is non-blocking. If it throws an error, the error is logged
 * but the email has already been changed when the hook is called.
 *
 * **Important:** This hook triggers TWO emails for security:
 * 1. Alert to OLD email address (security notification)
 * 2. Confirmation to NEW email address
 *
 * Use cases:
 * - Send security alert to old email
 * - Send confirmation to new email
 * - Log to audit system
 * - Update external systems
 *
 * @example
 * ```typescript
 * export class EmailChangedNotificationHook implements IEmailChangedHook {
 *   async execute(metadata: EmailChangedMetadata): Promise<void> {
 *     const { oldEmail, newEmail, deactivatedMFADevices } = metadata;
 *
 *     // Alert to old email
 *     await this.emailService.sendEmailChangedAlertEmail(
 *       oldEmail,
 *       { newEmail, deactivatedMFADevices }
 *     );
 *
 *     // Confirmation to new email
 *     await this.emailService.sendEmailChangedConfirmationEmail(
 *       newEmail
 *     );
 *   }
 * }
 * ```
 */
export interface IEmailChangedHook {
  /**
   * Execute email changed actions
   *
   * @param metadata - Email change context with old and new addresses
   */
  execute(metadata: EmailChangedMetadata): Promise<void>;
}

// ============================================================================
// Account Locked Hook
// ============================================================================

/**
 * Account locked metadata
 *
 * Provides context about account lockout events.
 */
export interface AccountLockedMetadata {
  /**
   * User whose account was locked
   */
  user: IUser;

  /**
   * Reason for lockout
   */
  reason: string;

  /**
   * Type of lock
   *
   * - 'temporary': Temporary lockout (auto-unlocks)
   * - 'permanent': Permanent lock (requires admin intervention)
   */
  lockType: 'temporary' | 'permanent';

  /**
   * Lock duration in seconds (for temporary locks)
   */
  lockDuration?: number;

  /**
   * When the lock expires (for temporary locks)
   */
  lockedUntil?: Date;

  /**
   * IP address that triggered the lockout
   */
  ipAddress?: string;

  /**
   * Number of failed attempts that triggered lockout
   */
  failedAttempts?: number;
}

/**
 * Account locked hook interface
 *
 * Executes actions after account is locked (non-blocking).
 * Errors are logged but do not affect the lockout operation.
 *
 * @remarks
 * This hook is triggered when:
 * - Account lockout threshold is reached via `handleFailedLogin()`
 *
 * The hook is non-blocking. If it throws an error, the error is logged
 * but the account has already been locked when the hook is called.
 *
 * Use cases:
 * - Notify user of lockout
 * - Log to security system
 * - Trigger fraud detection
 * - Alert admins for high-risk lockouts
 *
 * @example
 * ```typescript
 * export class AccountLockedNotificationHook implements IAccountLockedHook {
 *   async execute(metadata: AccountLockedMetadata): Promise<void> {
 *     const { user, reason, lockDuration } = metadata;
 *     await this.emailService.sendAccountLockedEmail(
 *       user.email,
 *       { reason, lockDuration }
 *     );
 *   }
 * }
 * ```
 */
export interface IAccountLockedHook {
  /**
   * Execute account locked actions
   *
   * @param metadata - Lockout context with user and lock details
   */
  execute(metadata: AccountLockedMetadata): Promise<void>;
}

// ============================================================================
// Sessions Revoked Hook
// ============================================================================

/**
 * Sessions revoked metadata
 *
 * Provides context about session revocation events.
 */
export interface SessionsRevokedMetadata {
  /**
   * User whose sessions were revoked
   */
  user: IUser;

  /**
   * Number of sessions revoked
   */
  revokedCount: number;

  /**
   * Reason for revocation
   */
  reason: string;

  /**
   * Who initiated the revocation
   *
   * - 'user': User revoked their own sessions
   * - 'admin': Admin revoked sessions
   * - 'system': System revoked sessions (e.g., password change)
   */
  initiatedBy: 'user' | 'admin' | 'system';

  /**
   * Trigger event (optional)
   *
   * - 'password_changed': Password change triggered revocation
   * - 'account_disabled': Account disable triggered revocation
   * - 'user_request': User manually revoked sessions
   */
  triggerEvent?: string;
}

/**
 * Sessions revoked hook interface
 *
 * Executes actions after sessions are revoked (non-blocking).
 * Errors are logged but do not affect the revocation operation.
 *
 * @remarks
 * This hook is triggered when:
 * - Sessions are revoked via `revokeAllUserSessions()` when NOT user-initiated
 *
 * The hook is non-blocking. If it throws an error, the error is logged
 * but the sessions have already been revoked when the hook is called.
 *
 * **Note:** Hook is NOT triggered for user-initiated revocations (when user
 * explicitly logs out or revokes sessions) to avoid notification spam.
 *
 * Use cases:
 * - Send security alert about forced logout
 * - Log to security system
 * - Update external systems
 *
 * @example
 * ```typescript
 * export class SessionsRevokedAlertHook implements ISessionsRevokedHook {
 *   async execute(metadata: SessionsRevokedMetadata): Promise<void> {
 *     const { user, revokedCount, reason } = metadata;
 *     if (reason === 'password_changed') {
 *       await this.emailService.sendSessionsRevokedEmail(
 *         user.email,
 *         { revokedCount, reason }
 *       );
 *     }
 *   }
 * }
 * ```
 */
export interface ISessionsRevokedHook {
  /**
   * Execute sessions revoked actions
   *
   * @param metadata - Revocation context with user and session details
   */
  execute(metadata: SessionsRevokedMetadata): Promise<void>;
}

// ============================================================================
// MFA First Enabled Hook
// ============================================================================

/**
 * MFA first enabled metadata
 *
 * Provides context about first MFA device enrollment.
 */
export interface MFAFirstEnabledMetadata {
  /**
   * User who enabled their first MFA device
   */
  user: IUser;

  /**
   * Type of first MFA device
   */
  firstMethod: import('../enums/mfa-method.enum').MFADeviceMethod;

  /**
   * Device name (optional, user-provided label)
   */
  deviceName?: string;

  /**
   * When MFA was first enforced for this user
   */
  enforcedAt: Date;

  /**
   * Client information (IP address, user agent, location)
   */
  clientInfo?: import('./client-info.interface').ClientInfo;
}

/**
 * MFA first enabled hook interface
 *
 * Executes actions when user enables their first MFA device (non-blocking).
 * Errors are logged but do not affect the MFA enrollment operation.
 *
 * @remarks
 * This hook is triggered when:
 * - User enables their first MFA device via `enableMFAForUser()` when `isFirstDevice = true`
 *
 * The hook is non-blocking. If it throws an error, the error is logged
 * but the MFA device has already been enabled when the hook is called.
 *
 * Use cases:
 * - Send confirmation email
 * - Log to audit system
 * - Update onboarding status
 * - Update external systems
 *
 * @example
 * ```typescript
 * export class MFAFirstEnabledConfirmationHook implements IMFAFirstEnabledHook {
 *   async execute(metadata: MFAFirstEnabledMetadata): Promise<void> {
 *     const { user, firstMethod } = metadata;
 *     await this.emailService.sendMFAFirstEnabledEmail(
 *       user.email,
 *       { method: firstMethod }
 *     );
 *   }
 * }
 * ```
 */
export interface IMFAFirstEnabledHook {
  /**
   * Execute MFA first enabled actions
   *
   * @param metadata - MFA enrollment context with user and device details
   */
  execute(metadata: MFAFirstEnabledMetadata): Promise<void>;
}

// ============================================================================
// MFA Method Added Hook
// ============================================================================

/**
 * MFA method added metadata
 *
 * Provides context when a user adds an additional MFA method (e.g., adding Passkey
 * after already having TOTP enabled).
 */
export interface MFAMethodAddedMetadata {
  /**
   * User who added an MFA method
   */
  user: IUser;

  /**
   * MFA method that was added
   */
  method: import('../enums/mfa-method.enum').MFADeviceMethod;

  /**
   * Device name (optional, user-provided label)
   */
  deviceName?: string;

  /**
   * Whether this method addition is also the user's first MFA method
   */
  isFirstMethod: boolean;

  /**
   * Enabled MFA methods after the change
   */
  enabledMethods: import('../enums/mfa-method.enum').MFADeviceMethod[];

  /**
   * Event timestamp
   */
  timestamp: Date;

  /**
   * Client information (IP address, user agent, location)
   */
  clientInfo?: import('./client-info.interface').ClientInfo;
}

/**
 * MFA method added hook interface
 *
 * Executes actions after a user adds an MFA method (non-blocking).
 * Errors are logged but do not affect the MFA enrollment operation.
 *
 * @example
 * ```typescript
 * export class MFAMethodAddedNotificationHook implements IMFAMethodAddedHook {
 *   async execute(metadata: MFAMethodAddedMetadata): Promise<void> {
 *     const { user, method, enabledMethods } = metadata;
 *     await this.emailService.sendMFAMethodAddedEmail(user.email, {
 *       method,
 *       enabledMethods,
 *     });
 *   }
 * }
 * ```
 */
export interface IMFAMethodAddedHook {
  /**
   * Execute MFA method added actions
   *
   * @param metadata - MFA method addition context
   */
  execute(metadata: MFAMethodAddedMetadata): Promise<void>;
}
