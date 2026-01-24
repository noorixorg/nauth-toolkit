import { IUser, IChallengeSession } from '../interfaces/entities.interface';
import { Repository, LessThan } from 'typeorm';
import { BaseChallengeSession } from '../entities';
import { randomUUID } from 'crypto';
import { AuthChallenge } from '../dto/auth-challenge.dto';
import { NAuthLogger } from '../utils/nauth-logger';
import { InternalAuthAuditService as AuthAuditService } from './auth-audit.service';
import { AuthAuditEventType } from '../enums/auth-audit-event-type.enum';
import { NAuthException } from '../exceptions/nauth.exception';
import { AuthErrorCode } from '../enums/error-codes.enum';
import { ClientInfoService } from './client-info.service';
import { NAuthConfig } from '../interfaces/config.interface';

/**
 * Challenge Session Service
 *
 * Manages authentication challenge sessions for the challenge-response flow.
 * Challenge sessions are temporary, short-lived sessions (typically 15 minutes)
 * that track pending authentication challenges similar to AWS Cognito.
 *
 * Handles:
 * - Challenge session creation and validation
 * - Session expiration and cleanup
 * - Attempt tracking and rate limiting
 * - Secure session token generation
 *
 * @example
 * ```typescript
 * // Create a challenge session
 * const session = await challengeService.createChallengeSession(
 *   user,
 *   AuthChallenge.VERIFY_EMAIL,
 *   { email: user.email }
 * );
 *
 * // Validate and consume a challenge session
 * const validSession = await challengeService.validateAndConsumeSession(
 *   sessionToken,
 *   AuthChallenge.VERIFY_EMAIL
 * );
 * ```
 */
export class ChallengeService {
  /**
   * Default challenge session expiration time (15 minutes)
   */
  private readonly DEFAULT_EXPIRATION_MINUTES = 15;

  /**
   * Default maximum attempts per challenge session
   */
  private readonly DEFAULT_MAX_ATTEMPTS = 3;

  constructor(
    private readonly challengeSessionRepository: Repository<BaseChallengeSession>,
    private readonly clientInfoService: ClientInfoService,
    private readonly logger: NAuthLogger,
    private readonly auditService?: AuthAuditService, // Optional - audit trail service (enabled via config.auditLogs.enabled)
    private readonly config?: NAuthConfig, // Optional - config for maxAttempts
  ) {}

  /**
   * Per-user cleanup throttle map to avoid frequent cleanup writes
   */
  private readonly lastCleanupByUserId: Map<number, number> = new Map();

  // ============================================================================
  // Challenge Session Creation
  // ============================================================================

  /**
   * Create a new challenge session
   *
   * Generates a unique session token and stores challenge metadata.
   * The session token is returned to the client and must be submitted
   * when responding to the challenge.
   *
   * **Deduplication:**
   * If an active (non-completed, non-expired) session already exists for the same user
   * and challenge type, this method returns the existing session instead of creating
   * a duplicate. This prevents:
   * - Excessive `CHALLENGE_CREATED` audit events
   * - Database bloat from duplicate sessions
   * - User confusion from multiple active sessions for the same challenge
   *
   * @param user - User the challenge session belongs to
   * @param challengeName - Type of challenge (VERIFY_EMAIL, VERIFY_PHONE, etc.)
   * @param metadata - Challenge-specific data
   * @returns Challenge session with session token (new or existing)
   * @remarks Client info (ipAddress, userAgent) is automatically extracted from ClientInfoService context
   *
   * @example
   * ```typescript
   * const session = await challengeService.createChallengeSession(
   *   user,
   *   AuthChallenge.VERIFY_EMAIL,
   *   { email: user.email, verificationTokenId: tokenId }
   * );
   * // Returns: { sessionToken: 'uuid-here', expiresAt: Date, ... }
   * // If called again before completion, returns same session (no duplicate audit event)
   * ```
   */
  async createChallengeSession(
    user: IUser,
    challengeName: AuthChallenge,
    metadata?: Record<string, unknown>,
  ): Promise<IChallengeSession> {
    // Get client info from context (transparent access)
    const clientInfo = this.clientInfoService.get();

    // ============================================================================
    // DEDUPLICATION: Check for existing active challenge session
    // ============================================================================
    // If an active (non-completed, non-expired) session already exists for this
    // user and challenge type, return it instead of creating a duplicate.
    // This prevents excessive audit logging and database bloat.
    const existingSession = await this.challengeSessionRepository.findOne({
      where: {
        userId: user.id,
        challengeName,
        isCompleted: false,
      },
      order: { createdAt: 'DESC' },
      relations: ['user'],
    });

    if (existingSession) {
      const session = existingSession as unknown as IChallengeSession;
      // Get current maxAttempts from config
      const currentMaxAttempts = this.config?.challenge?.maxAttempts ?? this.DEFAULT_MAX_ATTEMPTS;

      // Check if session is still valid (not expired and not max attempts exceeded)
      const isExpired = session.expiresAt <= new Date();
      const isMaxAttemptsExceeded = session.attempts >= session.maxAttempts;

      if (!isExpired && !isMaxAttemptsExceeded) {
        // Update maxAttempts to match current config if different
        // This ensures sessions created with old config values are updated
        if (session.maxAttempts !== currentMaxAttempts) {
          session.maxAttempts = currentMaxAttempts;
          await this.challengeSessionRepository.save(session);
          this.logger?.debug?.(
            `Updated maxAttempts for existing session: user=${user.sub}, old=${session.maxAttempts}, new=${currentMaxAttempts}`,
          );
        }
        this.logger?.debug?.(
          `Reusing existing challenge session: user=${user.sub}, challenge=${challengeName}, session=${session.sessionToken}`,
        );

        // ============================================================================
        // Audit: Record challenge reuse for complete audit trail
        // ============================================================================
        try {
          await this.auditService?.recordEvent({
            userId: user.id,
            eventType: AuthAuditEventType.CHALLENGE_CREATED,
            eventStatus: 'INFO',
            challengeSessionId: session.id,
            metadata: {
              challengeName,
              reused: true, // Indicate this was an existing session
            },
          });
        } catch (auditError) {
          // Non-blocking: Log but continue
          const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
          this.logger?.error?.(`Failed to record CHALLENGE_CREATED (reused) audit event: ${errorMessage}`, {
            error: auditError,
            userId: user.id,
            challengeName,
          });
        }

        return session;
      }
      // If expired or max attempts exceeded, delete it and create a new one
      const reason = isExpired ? 'expired' : 'max attempts exceeded';
      this.logger?.debug?.(
        `Existing challenge session ${reason}, creating new one: user=${user.sub}, challenge=${challengeName}`,
      );
      await this.challengeSessionRepository.delete({ id: session.id });
    }

    // Clean up any expired or completed sessions for this user (throttled)
    const now = Date.now();
    const lastCleanup = this.lastCleanupByUserId.get(user.id) || 0;
    // Run at most once per 5 minutes per user to reduce write load
    if (now - lastCleanup > 5 * 60 * 1000) {
      await this.cleanupExpiredSessions(user.id);
      this.lastCleanupByUserId.set(user.id, now);
    }

    const sessionToken = randomUUID();
    const expiresAt = new Date(Date.now() + this.DEFAULT_EXPIRATION_MINUTES * 60 * 1000);

    // Get maxAttempts from config or use default
    const maxAttempts = this.config?.challenge?.maxAttempts ?? this.DEFAULT_MAX_ATTEMPTS;

    const challengeSession = this.challengeSessionRepository.create({
      userId: user.id,
      challengeName,
      sessionToken,
      expiresAt,
      metadata,
      // Client info automatically extracted from ClientInfoService (transparent access)
      ipAddress: clientInfo.ipAddress || null,
      userAgent: clientInfo.userAgent || null,
      attempts: 0, // Explicitly initialize attempts to 0
      maxAttempts,
    });

    await this.challengeSessionRepository.save(challengeSession);

    this.logger?.log?.(
      `Challenge session created: user=${user.sub}, challenge=${challengeName}, maxAttempts=${maxAttempts}`,
    );

    // ============================================================================
    // Audit: Record challenge creation
    // ============================================================================
    try {
      await this.auditService?.recordEvent({
        userId: user.id,
        eventType: AuthAuditEventType.CHALLENGE_CREATED,
        eventStatus: 'INFO',
        challengeSessionId: (challengeSession as unknown as IChallengeSession).id,
        metadata: {
          challengeName,
        },
        // Client info automatically included from context
      });
    } catch (auditError) {
      // Non-blocking: Log but continue
      const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
      this.logger?.error?.(`Failed to record CHALLENGE_CREATED audit event: ${errorMessage}`, {
        error: auditError,
        userId: user.id,
        challengeName,
      });
    }

    return challengeSession as unknown as IChallengeSession;
  }

  // ============================================================================
  // Challenge Session Validation
  // ============================================================================

  /**
   * Validate a challenge session token for code requests
   *
   * Validates session for requesting new verification codes (SMS, email, etc.).
   * Skips max attempts check since requesting a new code is not a verification attempt.
   * This method is used internally by nauth when sending verification codes.
   *
   * @param sessionToken - Session token to validate
   * @param expectedChallenge - Expected challenge type (optional, for additional verification)
   * @returns Valid challenge session
   * @throws {UnauthorizedException} If session is invalid, expired, or already completed
   *
   * @example
   * ```typescript
   * // Used internally by nauth when sending verification codes
   * const session = await challengeService.validateSessionForCodeRequest(
   *   'session-token-123',
   *   AuthChallenge.MFA_REQUIRED
   * );
   * ```
   */
  async validateSessionForCodeRequest(
    sessionToken: string,
    expectedChallenge?: AuthChallenge,
  ): Promise<IChallengeSession> {
    return this.validateSessionInternal(sessionToken, expectedChallenge, true);
  }

  /**
   * Validate a challenge session token
   *
   * Checks if the session token is valid, not expired, not completed,
   * and matches the expected challenge type. Does NOT consume the session.
   * Enforces max attempts check for verification attempts.
   *
   * @param sessionToken - Session token to validate
   * @param expectedChallenge - Expected challenge type (optional, for additional verification)
   * @returns Valid challenge session
   * @throws {UnauthorizedException} If session is invalid, expired, or already completed
   *
   * @example
   * ```typescript
   * try {
   *   const session = await challengeService.validateSession(
   *     'session-token-123',
   *     AuthChallenge.VERIFY_EMAIL
   *   );
   *   // Session is valid, proceed with verification
   * } catch (error) {
   *   // Session is invalid
   * }
   * ```
   */
  async validateSession(sessionToken: string, expectedChallenge?: AuthChallenge): Promise<IChallengeSession> {
    return this.validateSessionInternal(sessionToken, expectedChallenge, false);
  }

  /**
   * Internal method to validate challenge session
   *
   * @param sessionToken - Session token to validate
   * @param expectedChallenge - Expected challenge type (optional)
   * @param skipMaxAttemptsCheck - If true, skip max attempts check (for code requests)
   * @returns Valid challenge session
   * @private
   */
  private async validateSessionInternal(
    sessionToken: string,
    expectedChallenge?: AuthChallenge,
    skipMaxAttemptsCheck = false,
  ): Promise<IChallengeSession> {
    // Load session with ALL user fields (needed for challenge determination and MFA setup)
    const session = await this.challengeSessionRepository.findOne({
      where: { sessionToken },
      relations: ['user'],
    });

    if (!session) {
      this.logger?.warn?.('Invalid challenge session token');
      throw new NAuthException(AuthErrorCode.CHALLENGE_INVALID, 'Invalid or expired challenge session');
    }

    // Check expiration
    const challengeSession = session as unknown as IChallengeSession;
    if (challengeSession.expiresAt < new Date()) {
      this.logger?.warn?.(`Expired challenge session: user=${challengeSession.user?.sub}`);
      throw new NAuthException(AuthErrorCode.CHALLENGE_EXPIRED, 'Challenge session has expired');
    }

    // Check if already completed
    if (session.isCompleted) {
      this.logger?.warn?.(`Already completed challenge session: user=${challengeSession.user?.sub}`);
      throw new NAuthException(AuthErrorCode.CHALLENGE_ALREADY_COMPLETED, 'Challenge has already been completed');
    }

    // Check max attempts (skip if requesting new code, but enforce for verification attempts)
    // Ensure attempts is initialized (should be 0, but handle edge cases)
    const currentAttempts = challengeSession.attempts ?? 0;
    if (!skipMaxAttemptsCheck && currentAttempts >= challengeSession.maxAttempts) {
      this.logger?.warn?.(
        `Max attempts exceeded for challenge session: user=${challengeSession.user?.sub}, attempts=${currentAttempts}/${challengeSession.maxAttempts}`,
      );
      throw new NAuthException(AuthErrorCode.CHALLENGE_MAX_ATTEMPTS, 'Maximum challenge attempts exceeded');
    }

    // Verify challenge type if specified
    if (expectedChallenge && session.challengeName !== expectedChallenge) {
      this.logger?.warn?.(`Challenge type mismatch: expected=${expectedChallenge}, actual=${session.challengeName}`);
      throw new NAuthException(AuthErrorCode.CHALLENGE_TYPE_MISMATCH, 'Invalid challenge type');
    }

    return session as unknown as IChallengeSession;
  }

  /**
   * Increment attempt counter for a challenge session
   *
   * Tracks failed attempts to complete a challenge.
   * Used to prevent brute-force attacks on verification codes.
   *
   * @param session - Challenge session to increment
   * @returns Updated session
   *
   * @example
   * ```typescript
   * await challengeService.incrementAttempts(session);
   * ```
   */
  async incrementAttempts(session: IChallengeSession): Promise<IChallengeSession> {
    // ============================================================================
    // CRITICAL: Atomic Increment to Prevent Race Conditions
    // ============================================================================
    // Use TypeORM's increment() for atomic UPDATE attempts = attempts + 1
    // This is concurrency-safe even under high load:
    // - Database executes: UPDATE challenge_session SET attempts = attempts + 1 WHERE id = ?
    // - No read-modify-write race condition
    // - Single database round-trip (better performance than SELECT + UPDATE)
    // - Works across all databases (MySQL, PostgreSQL, SQLite)
    await this.challengeSessionRepository.increment({ id: session.id }, 'attempts', 1);

    // Reload session to get updated attempts count and user for audit logging
    const freshSession = await this.challengeSessionRepository.findOne({
      where: { id: session.id },
      relations: ['user'],
    });

    if (!freshSession) {
      this.logger?.warn?.(`Session not found after increment: id=${session.id}`);
      throw new NAuthException(AuthErrorCode.CHALLENGE_INVALID, 'Challenge session not found');
    }

    const freshChallengeSession = freshSession as unknown as IChallengeSession;

    this.logger?.debug?.(
      `Challenge attempt incremented: session=${freshChallengeSession.sessionToken}, attempts=${freshChallengeSession.attempts}/${freshChallengeSession.maxAttempts}`,
    );

    // ============================================================================
    // Audit: Record challenge attempt failure if max attempts exceeded
    // ============================================================================
    if (freshChallengeSession.attempts >= freshChallengeSession.maxAttempts) {
      try {
        const user = freshChallengeSession.user;
        if (user) {
          await this.auditService?.recordEvent({
            userId: user.id,
            eventType: AuthAuditEventType.CHALLENGE_ATTEMPT_FAILED,
            eventStatus: 'FAILURE',
            challengeSessionId: freshChallengeSession.id,
            reason: 'max_attempts_exceeded',
            // Client info (ipAddress, userAgent, etc.) automatically included from context
            description: `Challenge attempt failed - maximum attempts (${freshChallengeSession.maxAttempts}) exceeded`,
            metadata: {
              challengeName: freshChallengeSession.challengeName,
              attempts: freshChallengeSession.attempts,
              maxAttempts: freshChallengeSession.maxAttempts,
            },
          });
        }
      } catch (auditError) {
        // Non-blocking: Log but continue
        const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
        const sessionUser = freshChallengeSession.user;
        this.logger?.error?.(`Failed to record CHALLENGE_ATTEMPT_FAILED audit event: ${errorMessage}`, {
          error: auditError,
          userId: sessionUser?.id,
          challengeName: freshChallengeSession.challengeName,
        });
      }
    }

    return freshChallengeSession;
  }

  /**
   * Validate and consume a challenge session
   *
   * Validates the session and marks it as completed if validation succeeds.
   * This method should be called only after successful challenge completion.
   *
   * @param sessionToken - Session token to validate and consume
   * @param expectedChallenge - Expected challenge type
   * @returns Valid, completed challenge session with user
   * @throws {UnauthorizedException} If session is invalid
   *
   * @example
   * ```typescript
   * const session = await challengeService.validateAndConsumeSession(
   *   'session-token-123',
   *   AuthChallenge.VERIFY_EMAIL
   * );
   * // Session is now marked complete and cannot be reused
   * ```
   */
  async validateAndConsumeSession(sessionToken: string, expectedChallenge: AuthChallenge): Promise<IChallengeSession> {
    const session = await this.validateSession(sessionToken, expectedChallenge);

    // Mark session as completed
    session.isCompleted = true;
    session.completedAt = new Date();
    await this.challengeSessionRepository.save(session);

    const user = session.user;
    if (!user) {
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'User not found in challenge session');
    }
    this.logger?.log?.(`Challenge session completed: user=${user.sub}, challenge=${session.challengeName}`);

    // ============================================================================
    // Audit: Record challenge completion
    // ============================================================================
    try {
      // Build metadata with challenge name and MFA method (if applicable)
      const auditMetadata: Record<string, unknown> = {
        // Client info automatically included from context
        challengeName: session.challengeName,
      };

      // For MFA challenges, include the MFA method used
      if (
        (session.challengeName === AuthChallenge.MFA_REQUIRED ||
          session.challengeName === AuthChallenge.MFA_SETUP_REQUIRED) &&
        session.metadata?.mfaMethod
      ) {
        auditMetadata.mfaMethod = session.metadata.mfaMethod;
      }

      await this.auditService?.recordEvent({
        userId: user.id,
        eventType: AuthAuditEventType.CHALLENGE_COMPLETED,
        eventStatus: 'SUCCESS',
        challengeSessionId: session.id,
        // Client info (ipAddress, userAgent, etc.) automatically included from context
        metadata: auditMetadata,
      });
    } catch (auditError) {
      // Non-blocking: Log but continue
      const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
      this.logger?.error?.(`Failed to record CHALLENGE_COMPLETED audit event: ${errorMessage}`, {
        error: auditError,
        userId: user.id,
        challengeName: session.challengeName,
      });
    }

    return session;
  }

  /**
   * Update challenge session metadata
   *
   * Updates the metadata field of an existing challenge session.
   * Used to store additional challenge-specific data (e.g., passkey challenge).
   *
   * @param sessionToken - Session token to update
   * @param metadata - Metadata to merge into existing metadata
   * @returns Updated challenge session
   * @throws {NAuthException} If session not found or invalid
   *
   * @example
   * ```typescript
   * await challengeService.updateMetadata('session-token-123', {
   *   passkeyChallenge: 'base64-challenge-string'
   * });
   * ```
   */
  async updateMetadata(sessionToken: string, metadata: Record<string, unknown>): Promise<IChallengeSession> {
    const session = await this.validateSession(sessionToken);

    // Merge new metadata with existing metadata
    const existingMetadata = session.metadata || {};
    const updatedMetadata = { ...existingMetadata, ...metadata };

    // Update session metadata
    await this.challengeSessionRepository.update({ sessionToken }, { metadata: updatedMetadata } as Record<
      string,
      unknown
    >);

    // Return updated session
    const updatedSession = await this.challengeSessionRepository.findOne({
      where: { sessionToken },
      relations: ['user'],
    });

    if (!updatedSession) {
      throw new NAuthException(AuthErrorCode.CHALLENGE_INVALID, 'Failed to update challenge session metadata');
    }

    return updatedSession as unknown as IChallengeSession;
  }

  // ============================================================================
  // Challenge Session Cleanup
  // ============================================================================

  /**
   * Clean up expired or completed challenge sessions for a user
   *
   * Removes old sessions to prevent database bloat.
   * Called automatically when creating new challenge sessions.
   *
   * @param userId - User ID to clean up sessions for
   *
   * @example
   * ```typescript
   * await challengeService.cleanupExpiredSessions(user.id);
   * ```
   */
  async cleanupExpiredSessions(userId: number): Promise<void> {
    await this.challengeSessionRepository.delete({
      userId,
      expiresAt: LessThan(new Date()),
    });

    await this.challengeSessionRepository.delete({
      userId,
      isCompleted: true,
    });
  }

  /**
   * Clean up all expired challenge sessions (for all users)
   *
   * Should be called periodically (e.g., via cron job) to maintain
   * database health.
   *
   * @returns Number of sessions deleted
   *
   * @example
   * ```typescript
   * // In a scheduled job
   * const deleted = await challengeService.cleanupAllExpiredSessions();
   * logger.log(`Cleaned up ${deleted} expired challenge sessions`);
   * ```
   */
  async cleanupAllExpiredSessions(): Promise<number> {
    const result = await this.challengeSessionRepository.delete({
      expiresAt: LessThan(new Date()),
    });

    const deletedCount = result.affected || 0;
    this.logger?.log?.(`Cleaned up ${deletedCount} expired challenge sessions`);

    return deletedCount;
  }

  /**
   * Delete challenge sessions by challenge name for a user
   *
   * Removes all active (not completed, not expired) challenge sessions
   * of the specified type for a user. Used to clean up phantom challenges
   * when user completes the requirement (e.g., sets up MFA).
   *
   * @param userId - Internal user ID
   * @param challengeName - Challenge type to delete
   * @returns Number of sessions deleted
   *
   * @example
   * ```typescript
   * // Clear MFA_SETUP_REQUIRED challenge when user sets up MFA
   * const deleted = await challengeService.deleteUserChallengeSessions(
   *   user.id,
   *   AuthChallenge.MFA_SETUP_REQUIRED
   * );
   * ```
   */
  async deleteUserChallengeSessions(userId: number, challengeName: AuthChallenge): Promise<number> {
    const result = await this.challengeSessionRepository.delete({
      userId,
      challengeName,
      isCompleted: false,
    });

    const deletedCount = result.affected || 0;
    if (deletedCount > 0) {
      this.logger?.log?.(`Deleted ${deletedCount} ${challengeName} challenge session(s) for user ID ${userId}`);
    }

    return deletedCount;
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  /**
   * Mask email address for display in challenge parameters
   *
   * Shows first character and domain, hides the rest.
   *
   * @param email - Email to mask
   * @returns Masked email
   *
   * @example
   * ```typescript
   * maskEmail('john.doe@example.com')
   * // Returns: 'j***@example.com'
   * ```
   */
  maskEmail(email: string): string {
    const [localPart, domain] = email.split('@');
    if (!domain) return email;
    return `${localPart[0]}***@${domain}`;
  }

  /**
   * Mask phone number for display in challenge parameters
   *
   * Shows last 4 digits, hides the rest.
   *
   * @param phone - Phone to mask
   * @returns Masked phone
   *
   * @example
   * ```typescript
   * maskPhone('+1234567890')
   * // Returns: '***-***-7890'
   * ```
   */
  maskPhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 4) return phone;
    return `***-***-${digits.slice(-4)}`;
  }
}
