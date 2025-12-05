/**
 * Verified Token Profile - Google OAuth
 *
 * Standardized return type for Google token verification.
 * This is provider-specific and should not be in core.
 */
export interface VerifiedGoogleTokenProfile {
  /**
   * Google user ID (sub claim)
   */
  sub: string;

  /**
   * User's email address
   */
  email: string;

  /**
   * Whether the email is verified by Google
   */
  email_verified: boolean;

  /**
   * User's first name (given name)
   */
  given_name?: string;

  /**
   * User's last name (family name)
   */
  family_name?: string;

  /**
   * User's profile picture URL
   */
  picture?: string;
}
