/**
 * Authentication Audit Event Types
 *
 * Comprehensive enumeration of all authentication and security events
 * that are recorded in the audit trail.
 *
 * **Organization:**
 * - Login events (success, failure, blocked)
 * - Session management events
 * - Password operations
 * - Multi-Factor Authentication (MFA) events
 * - Adaptive MFA events (risk-based)
 * - Verification events (email, phone)
 * - Account management events
 * - Profile update events
 * - Social authentication events
 * - Challenge flow events
 * - Security violation events
 *
 * **Note:** TOKEN_REFRESHED is intentionally excluded as it occurs too
 * frequently and would create excessive audit noise. Only security-relevant
 * token operations are audited.
 *
 * @example
 * ```typescript
 * await auditService.recordEvent({
 *   userId: user.id,
 *   eventType: AuthAuditEventType.LOGIN_SUCCESS,
 *   eventStatus: 'SUCCESS',
 *   authMethod: 'password',
 *   ipAddress: '1.2.3.4',
 * });
 * ```
 */
export enum AuthAuditEventType {
  // ============================================================================
  // Login Events
  // ============================================================================

  /**
   * Login attempt initiated (credentials validated, risk assessed, MFA evaluated)
   *
   * This event is recorded when:
   * - User credentials are validated successfully
   * - Adaptive MFA risk evaluation is performed
   * - Risk factors and MFA requirement status are recorded
   *
   * Note: This is logged before the final login outcome (success/failure/challenge).
   * Use LOGIN_SUCCESS for successful completions, LOGIN_FAILED for failures.
   */
  LOGIN_ATTEMPT = 'LOGIN_ATTEMPT',

  /**
   * User successfully authenticated
   */
  LOGIN_SUCCESS = 'LOGIN_SUCCESS',

  /**
   * Login attempt failed (invalid credentials, account locked, etc.)
   */
  LOGIN_FAILED = 'LOGIN_FAILED',

  /**
   * Login attempt blocked (account locked, IP blocked, etc.)
   *
   * Note: This should only be used for actual blocks (IP lockout, account locked).
   * Do not use for MFA/challenge flows - use LOGIN_ATTEMPT + CHALLENGE_CREATED instead.
   */
  LOGIN_BLOCKED = 'LOGIN_BLOCKED',

  // ============================================================================
  // Session Events
  // ============================================================================

  /**
   * New session created (after successful authentication)
   */
  SESSION_CREATED = 'SESSION_CREATED',

  /**
   * Session revoked (logout, security violation, admin action)
   */
  SESSION_REVOKED = 'SESSION_REVOKED',

  /**
   * Global signout performed (all sessions revoked)
   *
   * This event is recorded once when a user performs global signout.
   * Individual SESSION_REVOKED events are also recorded for each revoked session.
   */
  GLOBAL_SIGNOUT = 'GLOBAL_SIGNOUT',

  // ============================================================================
  // Password Events
  // ============================================================================

  /**
   * User changed their password
   */
  PASSWORD_CHANGED = 'PASSWORD_CHANGED',

  /**
   * Password reset requested (email/SMS sent)
   */
  PASSWORD_RESET_REQUESTED = 'PASSWORD_RESET_REQUESTED',

  /**
   * Password reset completed successfully
   */
  PASSWORD_RESET_COMPLETED = 'PASSWORD_RESET_COMPLETED',

  /**
   * Force password change requirement set (by admin or policy)
   */
  PASSWORD_FORCE_CHANGE_SET = 'PASSWORD_FORCE_CHANGE_SET',

  /**
   * Force password change completed
   */
  PASSWORD_FORCE_CHANGE_COMPLETED = 'PASSWORD_FORCE_CHANGE_COMPLETED',

  /**
   * Admin initiated password reset (code sent to user)
   */
  ADMIN_PASSWORD_RESET_INITIATED = 'ADMIN_PASSWORD_RESET_INITIATED',

  /**
   * Admin-initiated password reset completed successfully
   */
  ADMIN_PASSWORD_RESET_COMPLETED = 'ADMIN_PASSWORD_RESET_COMPLETED',

  /**
   * Admin-initiated password reset failed (invalid code, expired, etc.)
   */
  ADMIN_PASSWORD_RESET_FAILED = 'ADMIN_PASSWORD_RESET_FAILED',

  // ============================================================================
  // Multi-Factor Authentication (MFA) Events
  // ============================================================================

  /**
   * MFA enabled for user account
   */
  MFA_ENABLED = 'MFA_ENABLED',

  /**
   * MFA disabled for user account
   */
  MFA_DISABLED = 'MFA_DISABLED',

  /**
   * New MFA device registered (TOTP, SMS, Passkey)
   */
  MFA_DEVICE_ADDED = 'MFA_DEVICE_ADDED',

  /**
   * MFA device removed from account
   */
  MFA_DEVICE_REMOVED = 'MFA_DEVICE_REMOVED',

  /**
   * MFA device updated (name changed, primary flag changed, etc.)
   */
  MFA_DEVICE_UPDATED = 'MFA_DEVICE_UPDATED',

  /**
   * MFA verification succeeded
   */
  MFA_VERIFICATION_SUCCESS = 'MFA_VERIFICATION_SUCCESS',

  /**
   * MFA verification failed (invalid code, expired, etc.)
   */
  MFA_VERIFICATION_FAILED = 'MFA_VERIFICATION_FAILED',

  /**
   * MFA exemption granted (admin action)
   */
  MFA_EXEMPTION_GRANTED = 'MFA_EXEMPTION_GRANTED',

  /**
   * MFA exemption revoked (admin action)
   */
  MFA_EXEMPTION_REVOKED = 'MFA_EXEMPTION_REVOKED',

  /**
   * Backup codes generated for MFA recovery
   */
  MFA_BACKUP_CODES_GENERATED = 'MFA_BACKUP_CODES_GENERATED',

  /**
   * Backup code used for MFA verification
   */
  MFA_BACKUP_CODE_USED = 'MFA_BACKUP_CODE_USED',

  /**
   * User's preferred MFA method updated
   */
  MFA_PREFERRED_METHOD_UPDATED = 'MFA_PREFERRED_METHOD_UPDATED',

  /**
   * Device trusted by user (user opt-in for remember device feature)
   */
  DEVICE_TRUSTED = 'DEVICE_TRUSTED',

  /**
   * Trusted device revoked (user untrusted device or device expired)
   */
  DEVICE_UNTRUSTED = 'DEVICE_UNTRUSTED',

  // ============================================================================
  // Adaptive MFA Events (Risk-Based)
  // ============================================================================

  /**
   * Risk assessment completed (for future adaptive MFA implementation)
   *
   * Note: This is infrastructure for future adaptive MFA. The audit service
   * records risk data but does not calculate risk scores.
   */
  ADAPTIVE_MFA_RISK_ASSESSED = 'ADAPTIVE_MFA_RISK_ASSESSED',

  /**
   * Adaptive MFA triggered due to risk factors (for future implementation)
   *
   * Note: This is infrastructure for future adaptive MFA.
   */
  ADAPTIVE_MFA_TRIGGERED = 'ADAPTIVE_MFA_TRIGGERED',

  /**
   * Adaptive MFA bypassed due to low risk (for future implementation)
   *
   * Note: This is infrastructure for future adaptive MFA.
   */
  ADAPTIVE_MFA_BYPASSED = 'ADAPTIVE_MFA_BYPASSED',

  // ============================================================================
  // Verification Events
  // ============================================================================

  /**
   * Email address verified successfully
   */
  EMAIL_VERIFIED = 'EMAIL_VERIFIED',

  /**
   * Email verification code/link requested
   */
  EMAIL_VERIFICATION_REQUESTED = 'EMAIL_VERIFICATION_REQUESTED',

  /**
   * Email verification failed (invalid code, expired, etc.)
   */
  EMAIL_VERIFICATION_FAILED = 'EMAIL_VERIFICATION_FAILED',

  /**
   * Phone number verified successfully
   */
  PHONE_VERIFIED = 'PHONE_VERIFIED',

  /**
   * Phone verification code requested
   */
  PHONE_VERIFICATION_REQUESTED = 'PHONE_VERIFICATION_REQUESTED',

  /**
   * Phone verification failed (invalid code, expired, etc.)
   */
  PHONE_VERIFICATION_FAILED = 'PHONE_VERIFICATION_FAILED',

  // ============================================================================
  // Account Management Events
  // ============================================================================

  /**
   * New user account created (signup)
   */
  ACCOUNT_CREATED = 'ACCOUNT_CREATED',

  /**
   * User account activated
   */
  ACCOUNT_ACTIVATED = 'ACCOUNT_ACTIVATED',

  /**
   * User account deactivated
   */
  ACCOUNT_DEACTIVATED = 'ACCOUNT_DEACTIVATED',

  /**
   * User account locked (security measure)
   */
  ACCOUNT_LOCKED = 'ACCOUNT_LOCKED',

  /**
   * User account unlocked (admin action or auto-unlock)
   */
  ACCOUNT_UNLOCKED = 'ACCOUNT_UNLOCKED',

  /**
   * User account disabled by admin (permanent lock)
   */
  ACCOUNT_DISABLED = 'ACCOUNT_DISABLED',
  ACCOUNT_ENABLED = 'ACCOUNT_ENABLED',

  /**
   * User account deleted
   */
  ACCOUNT_DELETED = 'ACCOUNT_DELETED',

  // ============================================================================
  // Profile Update Events
  // ============================================================================

  /**
   * User profile updated (general update)
   */
  PROFILE_UPDATED = 'PROFILE_UPDATED',

  /**
   * User email address changed
   */
  EMAIL_CHANGED = 'EMAIL_CHANGED',

  /**
   * User phone number changed
   */
  PHONE_CHANGED = 'PHONE_CHANGED',

  /**
   * User username changed
   */
  USERNAME_CHANGED = 'USERNAME_CHANGED',

  /**
   * Email verification status updated by admin
   */
  EMAIL_VERIFICATION_STATUS_UPDATED = 'EMAIL_VERIFICATION_STATUS_UPDATED',

  /**
   * Phone verification status updated by admin
   */
  PHONE_VERIFICATION_STATUS_UPDATED = 'PHONE_VERIFICATION_STATUS_UPDATED',

  // ============================================================================
  // Social Authentication Events
  // ============================================================================

  /**
   * User authenticated via social provider (Google, Apple, Facebook, etc.)
   */
  SOCIAL_LOGIN = 'SOCIAL_LOGIN',

  /**
   * Social account linked to user account
   */
  SOCIAL_ACCOUNT_LINKED = 'SOCIAL_ACCOUNT_LINKED',

  /**
   * Social account unlinked from user account
   */
  SOCIAL_ACCOUNT_UNLINKED = 'SOCIAL_ACCOUNT_UNLINKED',

  // ============================================================================
  // Challenge Flow Events
  // ============================================================================

  /**
   * Challenge session created (email verification, phone verification, MFA setup, etc.)
   */
  CHALLENGE_CREATED = 'CHALLENGE_CREATED',

  /**
   * Challenge completed successfully
   */
  CHALLENGE_COMPLETED = 'CHALLENGE_COMPLETED',

  /**
   * Challenge attempt failed (max attempts exceeded)
   */
  CHALLENGE_ATTEMPT_FAILED = 'CHALLENGE_ATTEMPT_FAILED',

  // ============================================================================
  // Security Events
  // ============================================================================

  /**
   * Suspicious activity detected (token reuse, impossible travel, etc.)
   */
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
}
