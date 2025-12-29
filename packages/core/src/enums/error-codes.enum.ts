/**
 * Authentication Error Codes
 *
 * Standardized error codes for all nauth-toolkit errors.
 * Organized by category for easy navigation and maintenance.
 *
 * **Benefits:**
 * - Programmatic error handling (no string parsing)
 * - Internationalization support
 * - Better analytics and monitoring
 * - Type-safe error checking
 *
 * @example
 * ```typescript
 * // Backend
 * throw new NAuthException(
 *   AuthErrorCode.RATE_LIMIT_SMS,
 *   'Too many SMS sent',
 *   HttpStatus.TOO_MANY_REQUESTS,
 *   { retryAfter: 3600 }
 * );
 *
 * // Frontend
 * if (error.code === AuthErrorCode.RATE_LIMIT_SMS) {
 *   showRetryTimer(error.details.retryAfter);
 * }
 * ```
 */
export enum AuthErrorCode {
  // ============================================================================
  // Authentication Errors (AUTH_*)
  // ============================================================================

  /**
   * Invalid username/email or password
   *
   * Used when credentials don't match any user or password is incorrect.
   */
  INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS',

  /**
   * Account has been locked due to too many failed attempts
   *
   * Temporary lockout for security. Includes lockout duration in details.
   */
  ACCOUNT_LOCKED = 'AUTH_ACCOUNT_LOCKED',

  /**
   * Account is inactive or disabled
   *
   * Account exists but has been deactivated by admin or user.
   */
  ACCOUNT_INACTIVE = 'AUTH_ACCOUNT_INACTIVE',

  /**
   * Access token has expired
   *
   * Client should attempt token refresh.
   */
  TOKEN_EXPIRED = 'AUTH_TOKEN_EXPIRED',

  /**
   * Token is invalid or malformed
   *
   * Token signature verification failed or token format is invalid.
   */
  TOKEN_INVALID = 'AUTH_TOKEN_INVALID',

  /**
   * Bearer tokens are not allowed in the current delivery mode
   *
   * Used when tokenDelivery.method is 'cookies' and an Authorization header
   * (Bearer token) is provided, which would bypass httpOnly protections.
   */
  BEARER_NOT_ALLOWED = 'AUTH_BEARER_NOT_ALLOWED',

  /**
   * Cookie-based tokens are not allowed in the current delivery mode
   *
   * Used when tokenDelivery.method is 'json' and cookie tokens are present.
   */
  COOKIES_NOT_ALLOWED = 'AUTH_COOKIES_NOT_ALLOWED',

  /**
   * CSRF token is invalid or missing
   *
   * Used when CSRF protection is enabled and token validation fails.
   */
  CSRF_TOKEN_INVALID = 'AUTH_CSRF_TOKEN_INVALID',

  /**
   * CSRF token is missing from request
   *
   * Used when CSRF protection is enabled but no token is provided.
   */
  CSRF_TOKEN_MISSING = 'AUTH_CSRF_TOKEN_MISSING',

  /**
   * Refresh token reuse detected - security violation
   *
   * All sessions have been revoked. User must login again.
   */
  TOKEN_REUSE_DETECTED = 'AUTH_TOKEN_REUSE_DETECTED',

  /**
   * Session not found or has been revoked
   */
  SESSION_NOT_FOUND = 'AUTH_SESSION_NOT_FOUND',

  /**
   * Session has expired
   */
  SESSION_EXPIRED = 'AUTH_SESSION_EXPIRED',

  // ============================================================================
  // Signup Errors (SIGNUP_*)
  // ============================================================================

  /**
   * User signup is currently disabled
   *
   * Signups are administratively disabled.
   */
  SIGNUP_DISABLED = 'SIGNUP_DISABLED',

  /**
   * Email address is already registered
   *
   * Another user account exists with this email.
   */
  EMAIL_EXISTS = 'SIGNUP_EMAIL_EXISTS',

  /**
   * Username is already taken
   *
   * Another user has registered this username.
   */
  USERNAME_EXISTS = 'SIGNUP_USERNAME_EXISTS',

  /**
   * Phone number is already registered
   *
   * Another user account exists with this phone number.
   */
  PHONE_EXISTS = 'SIGNUP_PHONE_EXISTS',

  /**
   * Password doesn't meet security requirements
   *
   * Details include which requirements failed (length, complexity, etc.)
   */
  WEAK_PASSWORD = 'SIGNUP_WEAK_PASSWORD',

  /**
   * Phone number is required for signup
   *
   * Configuration requires phone verification.
   */
  PHONE_REQUIRED = 'SIGNUP_PHONE_REQUIRED',

  /**
   * Signup not allowed by hook or policy
   */
  SIGNUP_NOT_ALLOWED = 'SIGNUP_NOT_ALLOWED',

  // ============================================================================
  // Verification Errors (VERIFY_*)
  // ============================================================================

  /**
   * Verification code is invalid
   *
   * Code doesn't match or has incorrect format.
   */
  VERIFICATION_CODE_INVALID = 'VERIFY_CODE_INVALID',

  /**
   * Verification code has expired
   *
   * User needs to request a new code.
   */
  VERIFICATION_CODE_EXPIRED = 'VERIFY_CODE_EXPIRED',

  /**
   * Too many failed verification attempts
   *
   * User exceeded max attempts. Must request new code.
   */
  VERIFICATION_TOO_MANY_ATTEMPTS = 'VERIFY_TOO_MANY_ATTEMPTS',

  /**
   * Email or phone is already verified
   *
   * No action needed.
   */
  ALREADY_VERIFIED = 'VERIFY_ALREADY_VERIFIED',

  // ============================================================================
  // MFA Errors (MFA_*)
  // ============================================================================

  /**
   * MFA setup is required before login
   *
   * User must set up multi-factor authentication before being allowed to login.
   * This occurs when enforcement is 'REQUIRED' and grace period has expired (or is disabled).
   * Details include allowedMethods array.
   */
  MFA_SETUP_REQUIRED = 'MFA_SETUP_REQUIRED',

  // ============================================================================
  // Rate Limit Errors (RATE_LIMIT_*)
  // ============================================================================

  /**
   * Too many SMS verification requests
   *
   * Details include retryAfter (seconds) and resetAt (timestamp).
   */
  RATE_LIMIT_SMS = 'RATE_LIMIT_SMS',

  /**
   * Too many email verification requests
   *
   * Details include retryAfter (seconds) and resetAt (timestamp).
   */
  RATE_LIMIT_EMAIL = 'RATE_LIMIT_EMAIL',

  /**
   * Too many login attempts
   *
   * Account may be locked. Details include retryAfter.
   */
  RATE_LIMIT_LOGIN = 'RATE_LIMIT_LOGIN',

  /**
   * Too many resend code requests
   *
   * User must wait before requesting another code.
   */
  RATE_LIMIT_RESEND = 'RATE_LIMIT_RESEND',

  /**
   * Too many password reset requests
   *
   * Used for forgot-password flows to prevent abuse.
   * Details should include retryAfter (seconds).
   */
  RATE_LIMIT_PASSWORD_RESET = 'RATE_LIMIT_PASSWORD_RESET',

  // ============================================================================
  // Social Auth Errors (SOCIAL_*)
  // ============================================================================

  /**
   * Social provider token is invalid or expired
   *
   * Token verification failed with provider.
   */
  SOCIAL_TOKEN_INVALID = 'SOCIAL_TOKEN_INVALID',

  /**
   * Social account is already linked to another user
   *
   * This social account cannot be linked because it's in use.
   */
  SOCIAL_ACCOUNT_LINKED = 'SOCIAL_ACCOUNT_LINKED',

  /**
   * Social provider is not configured
   *
   * Provider credentials or settings are missing.
   */
  SOCIAL_CONFIG_MISSING = 'SOCIAL_CONFIG_MISSING',

  /**
   * Email is required from social provider
   *
   * Social provider didn't return email or email is not verified.
   */
  SOCIAL_EMAIL_REQUIRED = 'SOCIAL_EMAIL_REQUIRED',

  /**
   * Social account not found for this user
   *
   * User doesn't have this social provider linked.
   */
  SOCIAL_ACCOUNT_NOT_FOUND = 'SOCIAL_ACCOUNT_NOT_FOUND',

  /**
   * Social account already exists
   *
   * This provider+providerId combination is already registered.
   * Used during admin social signup when importing duplicate social accounts.
   */
  SOCIAL_ACCOUNT_EXISTS = 'SOCIAL_ACCOUNT_EXISTS',

  // ============================================================================
  // Challenge Errors (CHALLENGE_*)
  // ============================================================================

  /**
   * Challenge session has expired
   *
   * User must restart authentication flow.
   */
  CHALLENGE_EXPIRED = 'CHALLENGE_EXPIRED',

  /**
   * Challenge session is invalid
   *
   * Session token is malformed or not found.
   */
  CHALLENGE_INVALID = 'CHALLENGE_INVALID',

  /**
   * Challenge type mismatch
   *
   * Client sent wrong challenge type for this session.
   */
  CHALLENGE_TYPE_MISMATCH = 'CHALLENGE_TYPE_MISMATCH',

  /**
   * Max challenge attempts exceeded
   *
   * User must request new challenge session.
   */
  CHALLENGE_MAX_ATTEMPTS = 'CHALLENGE_MAX_ATTEMPTS',

  /**
   * Challenge has already been completed
   */
  CHALLENGE_ALREADY_COMPLETED = 'CHALLENGE_ALREADY_COMPLETED',

  // ============================================================================
  // Validation Errors (VALIDATION_*)
  // ============================================================================

  /**
   * Request validation failed
   *
   * Details include field-specific validation errors.
   */
  VALIDATION_FAILED = 'VALIDATION_FAILED',

  /**
   * Phone number format is invalid
   *
   * Must be in E.164 format (e.g., +1234567890).
   */
  INVALID_PHONE_FORMAT = 'VALIDATION_INVALID_PHONE',

  /**
   * Email format is invalid
   */
  INVALID_EMAIL_FORMAT = 'VALIDATION_INVALID_EMAIL',

  /**
   * Password format is invalid
   *
   * Details include specific requirements that failed.
   */
  INVALID_PASSWORD_FORMAT = 'VALIDATION_INVALID_PASSWORD',

  // ============================================================================
  // Password Errors (PASSWORD_*)
  // ============================================================================

  /**
   * Current password is incorrect
   *
   * Used when changing password.
   */
  PASSWORD_INCORRECT = 'PASSWORD_INCORRECT',

  /**
   * Cannot reuse recent passwords
   *
   * New password matches one of the recent passwords.
   */
  PASSWORD_REUSED = 'PASSWORD_REUSED',

  /**
   * Password change is not allowed
   *
   * Social-only users cannot change password.
   */
  PASSWORD_CHANGE_NOT_ALLOWED = 'PASSWORD_CHANGE_NOT_ALLOWED',

  // ============================================================================
  // Password Reset Errors (PASSWORD_RESET_*)
  // ============================================================================

  /**
   * Password reset verification code is invalid
   *
   * Used when confirming a forgot-password code.
   */
  PASSWORD_RESET_CODE_INVALID = 'PASSWORD_RESET_CODE_INVALID',

  /**
   * Password reset verification code has expired
   *
   * Used when confirming a forgot-password code after TTL.
   */
  PASSWORD_RESET_CODE_EXPIRED = 'PASSWORD_RESET_CODE_EXPIRED',

  /**
   * Too many failed password reset code attempts
   *
   * Used when confirming a forgot-password code exceeds max attempts.
   */
  PASSWORD_RESET_MAX_ATTEMPTS = 'PASSWORD_RESET_MAX_ATTEMPTS',

  // ============================================================================
  // General Errors (*)
  // ============================================================================

  /**
   * Requested resource not found
   */
  NOT_FOUND = 'RESOURCE_NOT_FOUND',

  /**
   * Internal server error
   *
   * Unexpected error occurred. Details may include correlation ID.
   */
  INTERNAL_ERROR = 'INTERNAL_ERROR',

  /**
   * Access forbidden
   *
   * User doesn't have permission for this action.
   */
  FORBIDDEN = 'FORBIDDEN',

  /**
   * Service temporarily unavailable
   *
   * May include retryAfter in details.
   */
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',

  // ============================================================================
  // Adaptive MFA Errors (ADAPTIVE_*)
  // ============================================================================

  /**
   * Sign-in blocked due to high risk score
   *
   * Adaptive MFA evaluated the login attempt and determined it exceeds
   * the high-risk threshold. Sign-in is blocked for security.
   *
   * Details may include:
   * - riskScore: The calculated risk score (0-100)
   * - riskFactors: Array of detected risk factors
   * - expiresAt: When the block expires (if temporary)
   */
  SIGNIN_BLOCKED_HIGH_RISK = 'SIGNIN_BLOCKED_HIGH_RISK',
}
