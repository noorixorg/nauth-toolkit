/**
 * Verified Token Profile - Facebook OAuth
 *
 * Standardized return type for Facebook token verification.
 * This is provider-specific and should not be in core.
 */
export interface VerifiedFacebookTokenProfile {
  /**
   * Facebook user ID
   */
  id: string;

  /**
   * User's email address
   */
  email?: string;

  /**
   * User's first name
   */
  first_name?: string;

  /**
   * User's last name
   */
  last_name?: string;

  /**
   * User's profile picture data
   */
  picture?: {
    data: {
      url: string;
    };
  };
}
