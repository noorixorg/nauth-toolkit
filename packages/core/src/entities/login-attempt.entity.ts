/**
 * Base Login Attempt Entity
 *
 * Failed login tracking for security auditing and rate limiting.
 * Database adapters extend this class and add ORM-specific decorators.
 *
 * @remarks
 * This class is database-agnostic. TypeORM, Prisma, or other ORMs
 * extend this class in their respective packages.
 */
export class BaseLoginAttempt {
  /**
   * Internal login attempt ID
   */
  id!: number;

  /**
   * Email/username used in login attempt
   * May be NULL for malformed requests
   */
  email?: string | null;

  /**
   * Internal user ID (foreign key to users table)
   * Nullable since login attempt might be for non-existent user
   */
  userId?: number | null;

  /**
   * IP address of login attempt
   */
  ipAddress?: string | null;

  /**
   * User agent string
   */
  userAgent?: string | null;

  /**
   * Whether login was successful
   */
  success!: boolean;

  /**
   * Reason for login failure
   * Examples: "invalid_credentials", "account_locked", "mfa_required"
   */
  failureReason?: string | null;

  /**
   * Whether MFA was required for this attempt
   */
  mfaRequired!: boolean;

  /**
   * Additional metadata (JSON)
   */
  metadata?: Record<string, unknown> | null;

  /**
   * Login attempt timestamp
   */
  createdAt!: Date;
}
