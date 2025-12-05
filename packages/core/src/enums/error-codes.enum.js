"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthErrorCode = void 0;
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
var AuthErrorCode;
(function (AuthErrorCode) {
    // ============================================================================
    // Authentication Errors (AUTH_*)
    // ============================================================================
    /**
     * Invalid username/email or password
     *
     * Used when credentials don't match any user or password is incorrect.
     */
    AuthErrorCode["INVALID_CREDENTIALS"] = "AUTH_INVALID_CREDENTIALS";
    /**
     * Account has been locked due to too many failed attempts
     *
     * Temporary lockout for security. Includes lockout duration in details.
     */
    AuthErrorCode["ACCOUNT_LOCKED"] = "AUTH_ACCOUNT_LOCKED";
    /**
     * Account is inactive or disabled
     *
     * Account exists but has been deactivated by admin or user.
     */
    AuthErrorCode["ACCOUNT_INACTIVE"] = "AUTH_ACCOUNT_INACTIVE";
    /**
     * Access token has expired
     *
     * Client should attempt token refresh.
     */
    AuthErrorCode["TOKEN_EXPIRED"] = "AUTH_TOKEN_EXPIRED";
    /**
     * Token is invalid or malformed
     *
     * Token signature verification failed or token format is invalid.
     */
    AuthErrorCode["TOKEN_INVALID"] = "AUTH_TOKEN_INVALID";
    /**
     * Bearer tokens are not allowed in the current delivery mode
     *
     * Used when tokenDelivery.method is 'cookies' and an Authorization header
     * (Bearer token) is provided, which would bypass httpOnly protections.
     */
    AuthErrorCode["BEARER_NOT_ALLOWED"] = "AUTH_BEARER_NOT_ALLOWED";
    /**
     * Cookie-based tokens are not allowed in the current delivery mode
     *
     * Used when tokenDelivery.method is 'json' and cookie tokens are present.
     */
    AuthErrorCode["COOKIES_NOT_ALLOWED"] = "AUTH_COOKIES_NOT_ALLOWED";
    /**
     * CSRF token is invalid or missing
     *
     * Used when CSRF protection is enabled and token validation fails.
     */
    AuthErrorCode["CSRF_TOKEN_INVALID"] = "AUTH_CSRF_TOKEN_INVALID";
    /**
     * CSRF token is missing from request
     *
     * Used when CSRF protection is enabled but no token is provided.
     */
    AuthErrorCode["CSRF_TOKEN_MISSING"] = "AUTH_CSRF_TOKEN_MISSING";
    /**
     * Refresh token reuse detected - security violation
     *
     * All sessions have been revoked. User must login again.
     */
    AuthErrorCode["TOKEN_REUSE_DETECTED"] = "AUTH_TOKEN_REUSE_DETECTED";
    /**
     * Session not found or has been revoked
     */
    AuthErrorCode["SESSION_NOT_FOUND"] = "AUTH_SESSION_NOT_FOUND";
    /**
     * Session has expired
     */
    AuthErrorCode["SESSION_EXPIRED"] = "AUTH_SESSION_EXPIRED";
    // ============================================================================
    // Signup Errors (SIGNUP_*)
    // ============================================================================
    /**
     * User signup is currently disabled
     *
     * Signups are administratively disabled.
     */
    AuthErrorCode["SIGNUP_DISABLED"] = "SIGNUP_DISABLED";
    /**
     * Email address is already registered
     *
     * Another user account exists with this email.
     */
    AuthErrorCode["EMAIL_EXISTS"] = "SIGNUP_EMAIL_EXISTS";
    /**
     * Username is already taken
     *
     * Another user has registered this username.
     */
    AuthErrorCode["USERNAME_EXISTS"] = "SIGNUP_USERNAME_EXISTS";
    /**
     * Phone number is already registered
     *
     * Another user account exists with this phone number.
     */
    AuthErrorCode["PHONE_EXISTS"] = "SIGNUP_PHONE_EXISTS";
    /**
     * Password doesn't meet security requirements
     *
     * Details include which requirements failed (length, complexity, etc.)
     */
    AuthErrorCode["WEAK_PASSWORD"] = "SIGNUP_WEAK_PASSWORD";
    /**
     * Phone number is required for signup
     *
     * Configuration requires phone verification.
     */
    AuthErrorCode["PHONE_REQUIRED"] = "SIGNUP_PHONE_REQUIRED";
    /**
     * Signup not allowed by hook or policy
     */
    AuthErrorCode["SIGNUP_NOT_ALLOWED"] = "SIGNUP_NOT_ALLOWED";
    // ============================================================================
    // Verification Errors (VERIFY_*)
    // ============================================================================
    /**
     * Verification code is invalid
     *
     * Code doesn't match or has incorrect format.
     */
    AuthErrorCode["VERIFICATION_CODE_INVALID"] = "VERIFY_CODE_INVALID";
    /**
     * Verification code has expired
     *
     * User needs to request a new code.
     */
    AuthErrorCode["VERIFICATION_CODE_EXPIRED"] = "VERIFY_CODE_EXPIRED";
    /**
     * Too many failed verification attempts
     *
     * User exceeded max attempts. Must request new code.
     */
    AuthErrorCode["VERIFICATION_TOO_MANY_ATTEMPTS"] = "VERIFY_TOO_MANY_ATTEMPTS";
    /**
     * Email or phone is already verified
     *
     * No action needed.
     */
    AuthErrorCode["ALREADY_VERIFIED"] = "VERIFY_ALREADY_VERIFIED";
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
    AuthErrorCode["MFA_SETUP_REQUIRED"] = "MFA_SETUP_REQUIRED";
    // ============================================================================
    // Rate Limit Errors (RATE_LIMIT_*)
    // ============================================================================
    /**
     * Too many SMS verification requests
     *
     * Details include retryAfter (seconds) and resetAt (timestamp).
     */
    AuthErrorCode["RATE_LIMIT_SMS"] = "RATE_LIMIT_SMS";
    /**
     * Too many email verification requests
     *
     * Details include retryAfter (seconds) and resetAt (timestamp).
     */
    AuthErrorCode["RATE_LIMIT_EMAIL"] = "RATE_LIMIT_EMAIL";
    /**
     * Too many login attempts
     *
     * Account may be locked. Details include retryAfter.
     */
    AuthErrorCode["RATE_LIMIT_LOGIN"] = "RATE_LIMIT_LOGIN";
    /**
     * Too many resend code requests
     *
     * User must wait before requesting another code.
     */
    AuthErrorCode["RATE_LIMIT_RESEND"] = "RATE_LIMIT_RESEND";
    // ============================================================================
    // Social Auth Errors (SOCIAL_*)
    // ============================================================================
    /**
     * Social provider token is invalid or expired
     *
     * Token verification failed with provider.
     */
    AuthErrorCode["SOCIAL_TOKEN_INVALID"] = "SOCIAL_TOKEN_INVALID";
    /**
     * Social account is already linked to another user
     *
     * This social account cannot be linked because it's in use.
     */
    AuthErrorCode["SOCIAL_ACCOUNT_LINKED"] = "SOCIAL_ACCOUNT_LINKED";
    /**
     * Social provider is not configured
     *
     * Provider credentials or settings are missing.
     */
    AuthErrorCode["SOCIAL_CONFIG_MISSING"] = "SOCIAL_CONFIG_MISSING";
    /**
     * Email is required from social provider
     *
     * Social provider didn't return email or email is not verified.
     */
    AuthErrorCode["SOCIAL_EMAIL_REQUIRED"] = "SOCIAL_EMAIL_REQUIRED";
    /**
     * Social account not found for this user
     *
     * User doesn't have this social provider linked.
     */
    AuthErrorCode["SOCIAL_ACCOUNT_NOT_FOUND"] = "SOCIAL_ACCOUNT_NOT_FOUND";
    // ============================================================================
    // Challenge Errors (CHALLENGE_*)
    // ============================================================================
    /**
     * Challenge session has expired
     *
     * User must restart authentication flow.
     */
    AuthErrorCode["CHALLENGE_EXPIRED"] = "CHALLENGE_EXPIRED";
    /**
     * Challenge session is invalid
     *
     * Session token is malformed or not found.
     */
    AuthErrorCode["CHALLENGE_INVALID"] = "CHALLENGE_INVALID";
    /**
     * Challenge type mismatch
     *
     * Client sent wrong challenge type for this session.
     */
    AuthErrorCode["CHALLENGE_TYPE_MISMATCH"] = "CHALLENGE_TYPE_MISMATCH";
    /**
     * Max challenge attempts exceeded
     *
     * User must request new challenge session.
     */
    AuthErrorCode["CHALLENGE_MAX_ATTEMPTS"] = "CHALLENGE_MAX_ATTEMPTS";
    /**
     * Challenge has already been completed
     */
    AuthErrorCode["CHALLENGE_ALREADY_COMPLETED"] = "CHALLENGE_ALREADY_COMPLETED";
    // ============================================================================
    // Validation Errors (VALIDATION_*)
    // ============================================================================
    /**
     * Request validation failed
     *
     * Details include field-specific validation errors.
     */
    AuthErrorCode["VALIDATION_FAILED"] = "VALIDATION_FAILED";
    /**
     * Phone number format is invalid
     *
     * Must be in E.164 format (e.g., +1234567890).
     */
    AuthErrorCode["INVALID_PHONE_FORMAT"] = "VALIDATION_INVALID_PHONE";
    /**
     * Email format is invalid
     */
    AuthErrorCode["INVALID_EMAIL_FORMAT"] = "VALIDATION_INVALID_EMAIL";
    /**
     * Password format is invalid
     *
     * Details include specific requirements that failed.
     */
    AuthErrorCode["INVALID_PASSWORD_FORMAT"] = "VALIDATION_INVALID_PASSWORD";
    // ============================================================================
    // Password Errors (PASSWORD_*)
    // ============================================================================
    /**
     * Current password is incorrect
     *
     * Used when changing password.
     */
    AuthErrorCode["PASSWORD_INCORRECT"] = "PASSWORD_INCORRECT";
    /**
     * Cannot reuse recent passwords
     *
     * New password matches one of the recent passwords.
     */
    AuthErrorCode["PASSWORD_REUSED"] = "PASSWORD_REUSED";
    /**
     * Password change is not allowed
     *
     * Social-only users cannot change password.
     */
    AuthErrorCode["PASSWORD_CHANGE_NOT_ALLOWED"] = "PASSWORD_CHANGE_NOT_ALLOWED";
    // ============================================================================
    // General Errors (*)
    // ============================================================================
    /**
     * Requested resource not found
     */
    AuthErrorCode["NOT_FOUND"] = "RESOURCE_NOT_FOUND";
    /**
     * Internal server error
     *
     * Unexpected error occurred. Details may include correlation ID.
     */
    AuthErrorCode["INTERNAL_ERROR"] = "INTERNAL_ERROR";
    /**
     * Access forbidden
     *
     * User doesn't have permission for this action.
     */
    AuthErrorCode["FORBIDDEN"] = "FORBIDDEN";
    /**
     * Service temporarily unavailable
     *
     * May include retryAfter in details.
     */
    AuthErrorCode["SERVICE_UNAVAILABLE"] = "SERVICE_UNAVAILABLE";
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
    AuthErrorCode["SIGNIN_BLOCKED_HIGH_RISK"] = "SIGNIN_BLOCKED_HIGH_RISK";
})(AuthErrorCode || (exports.AuthErrorCode = AuthErrorCode = {}));
