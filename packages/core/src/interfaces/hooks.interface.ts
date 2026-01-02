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
   * Client information (IP address, user agent)
   */
  clientInfo?: {
    ipAddress?: string;
    userAgent?: string;
    ipCountry?: string;
    ipCity?: string;
  };
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
