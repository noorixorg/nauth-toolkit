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
}
