/**
 * Verified Token Profile - Apple OAuth
 *
 * Standardized return type for Apple token verification.
 * This is provider-specific and should not be in core.
 */
export interface VerifiedAppleTokenProfile {
  /**
   * Apple user ID (sub claim)
   */
  sub: string;

  /**
   * User's email address
   * May be empty string if not provided or using private relay
   */
  email: string;

  /**
   * Whether the email is verified by Apple
   */
  email_verified: boolean;

  /**
   * Whether the email is a private relay email (iCloud Private Relay)
   */
  is_private_email?: boolean;
}
