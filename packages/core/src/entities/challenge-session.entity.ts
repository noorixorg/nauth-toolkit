/**
 * Base Challenge Session Entity
 *
 * Stores temporary authentication challenge sessions.
 * These are short-lived sessions used to track pending challenges
 * that must be completed before full authentication is granted.
 * Database adapters extend this class and add ORM-specific decorators.
 *
 * @remarks
 * Similar to AWS Cognito's challenge sessions, these are NOT full JWT tokens.
 * They expire quickly (typically 15 minutes) and are deleted after completion.
 * This class is database-agnostic. TypeORM, Prisma, or other ORMs
 * extend this class in their respective packages.
 *
 * @example
 * ```typescript
 * // Creating a challenge session after signup
 * const challengeSession = new ChallengeSession();
 * challengeSession.userId = user.id;
 * challengeSession.challengeName = 'VERIFY_EMAIL';
 * challengeSession.sessionToken = randomUUID();
 * challengeSession.expiresAt = new Date(Date.now() + 15 * 60 * 1000);
 * challengeSession.metadata = { email: user.email };
 * ```
 */
export class BaseChallengeSession {
  /**
   * Primary key
   */
  id!: number;

  /**
   * User ID foreign key
   * References the user this challenge session belongs to
   */
  userId!: number;

  /**
   * Challenge type that must be completed
   *
   * @example 'VERIFY_EMAIL', 'VERIFY_PHONE', 'MFA_REQUIRED', 'FORCE_CHANGE_PASSWORD'
   */
  challengeName!: string;

  /**
   * Temporary session token (UUID)
   * This is returned to the client and must be submitted when responding to challenge
   */
  sessionToken!: string;

  /**
   * Session expiration time
   * Challenge sessions are short-lived (typically 15 minutes)
   */
  expiresAt!: Date;

  /**
   * Whether this challenge has been consumed/used
   * Consumed sessions cannot be reused
   */
  isConsumed!: boolean;

  /**
   * When the challenge was consumed
   * NULL if not yet consumed
   */
  consumedAt?: Date | null;

  /**
   * Whether this challenge has been completed successfully
   * Completed challenges cannot be attempted again
   */
  isCompleted?: boolean;

  /**
   * When the challenge was completed successfully
   * NULL if not yet completed
   */
  completedAt?: Date | null;

  /**
   * Number of failed attempts to complete this challenge
   * Used to prevent brute-force attacks on verification codes
   */
  attempts!: number;

  /**
   * Maximum allowed attempts before session is invalidated
   */
  maxAttempts!: number;

  /**
   * Challenge-specific metadata
   * Stores information needed for challenge completion
   *
   * @example
   * ```typescript
   * {
   *   email: 'user@example.com',
   *   phone: '+1234567890',
   *   verificationTokenId: 123
   * }
   * ```
   */
  challengeParameters?: Record<string, unknown> | null;

  /**
   * Additional metadata (alias for challengeParameters for backwards compatibility)
   */
  metadata?: Record<string, unknown> | null;

  /**
   * IP address where the challenge session was created
   * For security auditing
   */
  ipAddress?: string | null;

  /**
   * User agent where the challenge session was created
   * For security auditing
   */
  userAgent?: string | null;

  /**
   * Creation timestamp
   */
  createdAt!: Date;
}
