/**
 * Base User Entity
 *
 * Core user authentication record with all fields and business logic.
 * Database adapters extend this class and add ORM-specific decorators.
 *
 * @remarks
 * This class is database-agnostic. TypeORM, Prisma, or other ORMs
 * extend this class in their respective packages.
 */
export class BaseUser {
  /**
   * Internal database ID (auto-increment integer)
   * Used for foreign key relationships and internal queries
   * NOT exposed externally
   */
  id!: number;

  /**
   * External user identifier (UUID)
   * Exposed in API responses and JWT tokens as 'sub' (subject)
   * This is what consuming applications should use
   */
  sub!: string;

  /**
   * User's username (optional, unique if set)
   */
  username!: string | null;

  /**
   * User's first name
   */
  firstName!: string | null;

  /**
   * User's last name
   */
  lastName!: string | null;

  /**
   * User's email address (required, unique)
   */
  email!: string;

  /**
   * User's phone number in E.164 format (optional)
   */
  phone!: string | null;

  /**
   * Hashed password (Argon2)
   * NULL for social-only accounts
   * SECURITY: This field should be excluded from select queries when returning user objects.
   * Use hasPasswordHash boolean flag instead.
   */
  passwordHash!: string | null;

  /**
   * Whether this user has a password set
   * Computed field - derived from passwordHash at runtime via @AfterLoad hook
   * Never expose passwordHash directly; use this boolean flag instead
   */
  hasPasswordHash?: boolean;

  /**
   * When password was last changed
   * Used for password expiry policies
   */
  passwordChangedAt!: Date | null;

  /**
   * Password history (hashed)
   * Used to prevent password reuse
   */
  passwordHistory!: string[] | null;

  /**
   * Flag to force password change on next login
   * When true, user must complete FORCE_CHANGE_PASSWORD challenge
   * Can be set by admin or by password expiration policy
   */
  mustChangePassword!: boolean;

  /**
   * Email verification status
   */
  isEmailVerified!: boolean;

  /**
   * Phone verification status
   */
  isPhoneVerified!: boolean;

  /**
   * Account active status
   *
   * Admin-controlled flag for account lifecycle management.
   * - false = Account deactivated (soft disable, manual toggle)
   * - true = Account enabled (default for new signups)
   *
   * Use case: Administrative account management, account lifecycle control
   */
  isActive!: boolean;

  /**
   * Account lock status
   *
   * Security lock mechanism for temporary or permanent restrictions.
   * - false = Account unlocked (default)
   * - true = Account locked (blocks login)
   *
   * Lock types:
   * - Permanent: lockedUntil = null (admin disableUser, requires manual unlock)
   * - Temporary: lockedUntil = future date (rate limiting, auto-unlocks when expired)
   *
   * Use case: Security restrictions, rate limiting, failed login attempts
   *
   * See also: lockReason, lockedAt, lockedUntil
   */
  isLocked!: boolean;

  /**
   * Reason for account lock
   */
  lockReason!: string | null;

  /**
   * When account was locked
   */
  lockedAt!: Date | null;

  /**
   * When account lock expires (NULL = permanent)
   */
  lockedUntil!: Date | null;

  /**
   * Number of consecutive failed login attempts
   */
  failedLoginAttempts!: number;

  /**
   * When last failed login occurred
   */
  lastFailedLoginAt!: Date | null;

  /**
   * When user last successfully logged in
   */
  lastLoginAt!: Date | null;

  /**
   * IP address of last successful login
   */
  lastLoginIp!: string | null;

  /**
   * MFA enabled status
   */
  mfaEnabled!: boolean;

  /**
   * List of enabled MFA methods
   * Examples: ['totp', 'sms', 'passkey']
   */
  mfaMethods!: string[] | null;

  /**
   * When MFA was enforced for this user
   */
  mfaEnforcedAt?: Date | null;

  /**
   * TOTP secret (encrypted)
   * DEPRECATED: Use MFADevice entity instead
   */
  totpSecret?: string | null;

  /**
   * Backup recovery codes (hashed)
   * Single-use codes for account recovery
   */
  backupCodes!: string[] | null;

  /**
   * User's preferred MFA method
   * Used to pre-select MFA method during authentication
   */
  preferredMfaMethod!: string | null;

  /**
   * MFA exemption status
   *
   * When true, user is exempt from MFA requirements (both setup and verification).
   * This is an admin-only field and should only be set through admin functions.
   *
   * SECURITY: Exemption only affects MFA - other security measures (account lock,
   * email verification, password change) still apply normally.
   *
   * @default false
   */
  mfaExempt?: boolean;

  /**
   * Reason for MFA exemption (optional, for audit trail)
   *
   * Admin should provide reason when granting exemption (e.g., "Internal service account",
   * "Legacy system integration", "Special access approval")
   *
   * @default null
   */
  mfaExemptReason?: string | null;

  /**
   * When MFA exemption was granted
   *
   * Used for audit trail and potentially for expiration logic in future.
   *
   * @default null
   */
  mfaExemptGrantedAt?: Date | null;

  /**
   * Who granted the MFA exemption (optional, admin identifier)
   *
   * For audit trail - store admin user ID or identifier who granted exemption.
   *
   * @default null
   */
  mfaExemptGrantedBy?: string | null;

  /**
   * Optimization flag: indicates if user has any social authentication methods
   * Prevents unnecessary joins for password-only users (80%+ of users)
   * Updated automatically when social accounts are linked/unlinked
   */
  hasSocialAuth!: boolean;

  /**
   * Array of social providers linked to this account
   * Examples: ['google', 'apple', 'facebook']
   * Updated automatically when social accounts are linked/unlinked
   */
  socialProviders!: string[] | null;

  /**
   * Additional user metadata (JSON)
   * For custom application-specific data
   */
  metadata!: Record<string, unknown> | null;

  /**
   * Account creation timestamp
   */
  createdAt!: Date;

  /**
   * Last account update timestamp
   */
  updatedAt!: Date;

  /**
   * Soft delete timestamp
   * NULL if account is not deleted
   */
  deletedAt!: Date | null;
}
