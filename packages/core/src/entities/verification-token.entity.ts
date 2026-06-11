/**
 * Base Verification Token Entity
 *
 * Stores email/phone verification codes and password reset tokens.
 * Supports multiple verification types with expiry and attempt tracking.
 * Database adapters extend this class and add ORM-specific decorators.
 *
 * @remarks
 * This class is database-agnostic. TypeORM, Prisma, or other ORMs
 * extend this class in their respective packages.
 */
export class BaseVerificationToken {
  /**
   * Internal verification token ID (auto-increment integer)
   */
  id!: number;

  /**
   * Internal user ID (foreign key to users table)
   * Uses integer for optimal performance
   */
  userId!: number;

  /**
   * Challenge session ID (foreign key to challenge sessions table)
   * Links verification token to specific challenge session for security.
   * Prevents old tokens from being used with new challenge sessions.
   * NULL for password reset tokens (not tied to challenges)
   */
  challengeSessionId?: number | null;

  /**
   * Token type
   * - 'email': Email verification
   * - 'phone': Phone verification
   * - 'password_reset': Password reset (user-initiated)
   * - 'admin_password_reset': Password reset (admin-initiated)
   */
  type!: 'email' | 'phone' | 'password_reset' | 'admin_password_reset';

  /**
   * Verification token (hashed for security)
   * Used for magic links and password reset
   */
  token!: string;

  /**
   * Verification code (for email/SMS OTP)
   * Usually 6 digits, stored as string for flexibility
   */
  code?: string | null;

  /**
   * Token expiration timestamp
   * After this time, token/code is invalid
   */
  expiresAt!: Date;

  /**
   * Number of failed verification attempts
   * Used to prevent brute force attacks
   */
  attempts!: number;

  /**
   * When token was successfully used
   * NULL if not yet used
   */
  usedAt?: Date | null;

  /**
   * IP address when token was created
   * For security auditing
   */
  ipAddress?: string | null;

  /**
   * User agent when token was created
   * For security auditing
   */
  userAgent?: string | null;

  /**
   * Additional metadata (JSON)
   * For storing additional verification-specific data
   */
  metadata?: Record<string, unknown> | null;

  /**
   * Creation timestamp
   */
  createdAt!: Date;

  /**
   * Check if token is expired
   *
   * @returns true if token is expired
   *
   * @example
   * ```typescript
   * if (token.isExpired()) {
   *   throw new Error('Verification code has expired');
   * }
   * ```
   */
  isExpired(): boolean {
    return new Date() > this.expiresAt;
  }

  /**
   * Check if token has been used
   *
   * @returns true if token has been used
   *
   * @example
   * ```typescript
   * if (token.isUsed()) {
   *   throw new Error('Verification code has already been used');
   * }
   * ```
   */
  isUsed(): boolean {
    return this.usedAt !== null && this.usedAt !== undefined;
  }

  /**
   * Check if max attempts exceeded
   *
   * @param maxAttempts - Maximum allowed attempts
   * @returns true if max attempts exceeded
   *
   * @example
   * ```typescript
   * if (token.maxAttemptsExceeded(3)) {
   *   throw new Error('Too many failed attempts');
   * }
   * ```
   */
  maxAttemptsExceeded(maxAttempts: number): boolean {
    return this.attempts >= maxAttempts;
  }
}
