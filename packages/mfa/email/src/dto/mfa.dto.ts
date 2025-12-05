/**
 * MFA (Multi-Factor Authentication) DTOs
 *
 * Request and response types for Email MFA operations including:
 * - Email MFA setup and verification
 */

// ============================================================================
// Email MFA Setup
// ============================================================================

/**
 * Setup Email MFA DTO
 *
 * Configure Email as MFA method.
 * Sends verification code to email address.
 *
 * @example
 * ```typescript
 * {
 *   email: 'user@example.com',
 *   deviceName: 'My Email'
 * }
 * ```
 */
export interface SetupEmailMFADTO {
  /**
   * Email address for Email MFA
   * Must be a valid email address format
   * @example 'user@example.com'
   */
  email: string;

  /**
   * User-friendly device name
   * @example 'My Email', 'Work Email'
   */
  deviceName?: string;
}

/**
 * Verify Email MFA Setup DTO
 *
 * Submit code to complete Email MFA setup.
 *
 * @example
 * ```typescript
 * {
 *   email: 'user@example.com',
 *   code: '123456'
 * }
 * ```
 */
export interface VerifyEmailMFASetupDTO {
  /**
   * Email address receiving the code
   */
  email: string;

  /**
   * Email verification code
   */
  code: string;
}

/**
 * Send Email MFA Code DTO
 *
 * Request Email code during MFA challenge.
 *
 * @example
 * ```typescript
 * {
 *   session: 'challenge-session-token'
 * }
 * ```
 */
export interface SendEmailMFACodeDTO {
  /**
   * Challenge session token
   */
  session: string;
}
