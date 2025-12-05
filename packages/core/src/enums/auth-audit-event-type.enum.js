"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthAuditEventType = void 0;
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
var AuthAuditEventType;
(function (AuthAuditEventType) {
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
    AuthAuditEventType["LOGIN_ATTEMPT"] = "LOGIN_ATTEMPT";
    /**
     * User successfully authenticated
     */
    AuthAuditEventType["LOGIN_SUCCESS"] = "LOGIN_SUCCESS";
    /**
     * Login attempt failed (invalid credentials, account locked, etc.)
     */
    AuthAuditEventType["LOGIN_FAILED"] = "LOGIN_FAILED";
    /**
     * Login attempt blocked (account locked, IP blocked, etc.)
     *
     * Note: This should only be used for actual blocks (IP lockout, account locked).
     * Do not use for MFA/challenge flows - use LOGIN_ATTEMPT + CHALLENGE_CREATED instead.
     */
    AuthAuditEventType["LOGIN_BLOCKED"] = "LOGIN_BLOCKED";
    // ============================================================================
    // Session Events
    // ============================================================================
    /**
     * New session created (after successful authentication)
     */
    AuthAuditEventType["SESSION_CREATED"] = "SESSION_CREATED";
    /**
     * Session revoked (logout, security violation, admin action)
     */
    AuthAuditEventType["SESSION_REVOKED"] = "SESSION_REVOKED";
    // ============================================================================
    // Password Events
    // ============================================================================
    /**
     * User changed their password
     */
    AuthAuditEventType["PASSWORD_CHANGED"] = "PASSWORD_CHANGED";
    /**
     * Password reset requested (email/SMS sent)
     */
    AuthAuditEventType["PASSWORD_RESET_REQUESTED"] = "PASSWORD_RESET_REQUESTED";
    /**
     * Password reset completed successfully
     */
    AuthAuditEventType["PASSWORD_RESET_COMPLETED"] = "PASSWORD_RESET_COMPLETED";
    /**
     * Force password change requirement set (by admin or policy)
     */
    AuthAuditEventType["PASSWORD_FORCE_CHANGE_SET"] = "PASSWORD_FORCE_CHANGE_SET";
    /**
     * Force password change completed
     */
    AuthAuditEventType["PASSWORD_FORCE_CHANGE_COMPLETED"] = "PASSWORD_FORCE_CHANGE_COMPLETED";
    // ============================================================================
    // Multi-Factor Authentication (MFA) Events
    // ============================================================================
    /**
     * MFA enabled for user account
     */
    AuthAuditEventType["MFA_ENABLED"] = "MFA_ENABLED";
    /**
     * MFA disabled for user account
     */
    AuthAuditEventType["MFA_DISABLED"] = "MFA_DISABLED";
    /**
     * New MFA device registered (TOTP, SMS, Passkey)
     */
    AuthAuditEventType["MFA_DEVICE_ADDED"] = "MFA_DEVICE_ADDED";
    /**
     * MFA device removed from account
     */
    AuthAuditEventType["MFA_DEVICE_REMOVED"] = "MFA_DEVICE_REMOVED";
    /**
     * MFA device updated (name changed, primary flag changed, etc.)
     */
    AuthAuditEventType["MFA_DEVICE_UPDATED"] = "MFA_DEVICE_UPDATED";
    /**
     * MFA verification succeeded
     */
    AuthAuditEventType["MFA_VERIFICATION_SUCCESS"] = "MFA_VERIFICATION_SUCCESS";
    /**
     * MFA verification failed (invalid code, expired, etc.)
     */
    AuthAuditEventType["MFA_VERIFICATION_FAILED"] = "MFA_VERIFICATION_FAILED";
    /**
     * MFA exemption granted (admin action)
     */
    AuthAuditEventType["MFA_EXEMPTION_GRANTED"] = "MFA_EXEMPTION_GRANTED";
    /**
     * MFA exemption revoked (admin action)
     */
    AuthAuditEventType["MFA_EXEMPTION_REVOKED"] = "MFA_EXEMPTION_REVOKED";
    /**
     * Backup codes generated for MFA recovery
     */
    AuthAuditEventType["MFA_BACKUP_CODES_GENERATED"] = "MFA_BACKUP_CODES_GENERATED";
    /**
     * Backup code used for MFA verification
     */
    AuthAuditEventType["MFA_BACKUP_CODE_USED"] = "MFA_BACKUP_CODE_USED";
    /**
     * User's preferred MFA method updated
     */
    AuthAuditEventType["MFA_PREFERRED_METHOD_UPDATED"] = "MFA_PREFERRED_METHOD_UPDATED";
    /**
     * Device trusted by user (user opt-in for remember device feature)
     */
    AuthAuditEventType["DEVICE_TRUSTED"] = "DEVICE_TRUSTED";
    /**
     * Trusted device revoked (user untrusted device or device expired)
     */
    AuthAuditEventType["DEVICE_UNTRUSTED"] = "DEVICE_UNTRUSTED";
    // ============================================================================
    // Adaptive MFA Events (Risk-Based)
    // ============================================================================
    /**
     * Risk assessment completed (for future adaptive MFA implementation)
     *
     * Note: This is infrastructure for future adaptive MFA. The audit service
     * records risk data but does not calculate risk scores.
     */
    AuthAuditEventType["ADAPTIVE_MFA_RISK_ASSESSED"] = "ADAPTIVE_MFA_RISK_ASSESSED";
    /**
     * Adaptive MFA triggered due to risk factors (for future implementation)
     *
     * Note: This is infrastructure for future adaptive MFA.
     */
    AuthAuditEventType["ADAPTIVE_MFA_TRIGGERED"] = "ADAPTIVE_MFA_TRIGGERED";
    /**
     * Adaptive MFA bypassed due to low risk (for future implementation)
     *
     * Note: This is infrastructure for future adaptive MFA.
     */
    AuthAuditEventType["ADAPTIVE_MFA_BYPASSED"] = "ADAPTIVE_MFA_BYPASSED";
    // ============================================================================
    // Verification Events
    // ============================================================================
    /**
     * Email address verified successfully
     */
    AuthAuditEventType["EMAIL_VERIFIED"] = "EMAIL_VERIFIED";
    /**
     * Email verification code/link requested
     */
    AuthAuditEventType["EMAIL_VERIFICATION_REQUESTED"] = "EMAIL_VERIFICATION_REQUESTED";
    /**
     * Email verification failed (invalid code, expired, etc.)
     */
    AuthAuditEventType["EMAIL_VERIFICATION_FAILED"] = "EMAIL_VERIFICATION_FAILED";
    /**
     * Phone number verified successfully
     */
    AuthAuditEventType["PHONE_VERIFIED"] = "PHONE_VERIFIED";
    /**
     * Phone verification code requested
     */
    AuthAuditEventType["PHONE_VERIFICATION_REQUESTED"] = "PHONE_VERIFICATION_REQUESTED";
    /**
     * Phone verification failed (invalid code, expired, etc.)
     */
    AuthAuditEventType["PHONE_VERIFICATION_FAILED"] = "PHONE_VERIFICATION_FAILED";
    // ============================================================================
    // Account Management Events
    // ============================================================================
    /**
     * New user account created (signup)
     */
    AuthAuditEventType["ACCOUNT_CREATED"] = "ACCOUNT_CREATED";
    /**
     * User account activated
     */
    AuthAuditEventType["ACCOUNT_ACTIVATED"] = "ACCOUNT_ACTIVATED";
    /**
     * User account deactivated
     */
    AuthAuditEventType["ACCOUNT_DEACTIVATED"] = "ACCOUNT_DEACTIVATED";
    /**
     * User account locked (security measure)
     */
    AuthAuditEventType["ACCOUNT_LOCKED"] = "ACCOUNT_LOCKED";
    /**
     * User account unlocked (admin action or auto-unlock)
     */
    AuthAuditEventType["ACCOUNT_UNLOCKED"] = "ACCOUNT_UNLOCKED";
    /**
     * User account deleted
     */
    AuthAuditEventType["ACCOUNT_DELETED"] = "ACCOUNT_DELETED";
    // ============================================================================
    // Profile Update Events
    // ============================================================================
    /**
     * User profile updated (general update)
     */
    AuthAuditEventType["PROFILE_UPDATED"] = "PROFILE_UPDATED";
    /**
     * User email address changed
     */
    AuthAuditEventType["EMAIL_CHANGED"] = "EMAIL_CHANGED";
    /**
     * User phone number changed
     */
    AuthAuditEventType["PHONE_CHANGED"] = "PHONE_CHANGED";
    /**
     * User username changed
     */
    AuthAuditEventType["USERNAME_CHANGED"] = "USERNAME_CHANGED";
    // ============================================================================
    // Social Authentication Events
    // ============================================================================
    /**
     * User authenticated via social provider (Google, Apple, Facebook, etc.)
     */
    AuthAuditEventType["SOCIAL_LOGIN"] = "SOCIAL_LOGIN";
    /**
     * Social account linked to user account
     */
    AuthAuditEventType["SOCIAL_ACCOUNT_LINKED"] = "SOCIAL_ACCOUNT_LINKED";
    /**
     * Social account unlinked from user account
     */
    AuthAuditEventType["SOCIAL_ACCOUNT_UNLINKED"] = "SOCIAL_ACCOUNT_UNLINKED";
    // ============================================================================
    // Challenge Flow Events
    // ============================================================================
    /**
     * Challenge session created (email verification, phone verification, MFA setup, etc.)
     */
    AuthAuditEventType["CHALLENGE_CREATED"] = "CHALLENGE_CREATED";
    /**
     * Challenge completed successfully
     */
    AuthAuditEventType["CHALLENGE_COMPLETED"] = "CHALLENGE_COMPLETED";
    /**
     * Challenge attempt failed (max attempts exceeded)
     */
    AuthAuditEventType["CHALLENGE_ATTEMPT_FAILED"] = "CHALLENGE_ATTEMPT_FAILED";
    // ============================================================================
    // Security Events
    // ============================================================================
    /**
     * Suspicious activity detected (token reuse, impossible travel, etc.)
     */
    AuthAuditEventType["SUSPICIOUS_ACTIVITY"] = "SUSPICIOUS_ACTIVITY";
})(AuthAuditEventType || (exports.AuthAuditEventType = AuthAuditEventType = {}));
