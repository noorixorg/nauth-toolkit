import { ISession } from '../interfaces/entities.interface';
import { Repository, LessThan, MoreThan, In } from 'typeorm';
import { BaseSession } from '../entities';
import { StorageAdapter } from '../interfaces/storage-adapter.interface';
import { InternalAuthAuditService as AuthAuditService } from './auth-audit.service';
import { AuthAuditEventType } from '../enums/auth-audit-event-type.enum';
import { ClientInfoService } from './client-info.service';
import { NAuthLogger } from '../utils/nauth-logger';
import { NAuthConfig } from '../interfaces/config.interface';

/**
 * Session Service
 *
 * Manages user sessions and device tracking including:
 * - Creating new sessions with device information
 * - Finding sessions by ID or refresh token
 * - Updating session activity and tokens (rotation)
 * - Revoking individual or all user sessions
 * - Token family management for reuse detection
 * - Token reuse detection with storage tracking
 * - Cleanup of expired sessions
 *
 * Security Features:
 * - Token family tracking for reuse detection
 * - Used refresh token tracking (prevents reuse attacks)
 * - Session expiration management
 * - Device fingerprinting support
 * - Revocation with reason tracking
 * - Activity timestamp updates
 *
 * @example
 * ```typescript
 * // Create session
 * const session = await sessionService.createSession({
 *   userId: user.id, // Internal ID (integer)
 *   accessTokenHash: 'hash1',
 *   refreshTokenHash: 'hash2',
 *   tokenFamily: 'family-abc',
 *   // Client info (ipAddress, userAgent, etc.) automatically extracted from ClientInfoService
 *   expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
 * });
 *
 * // Revoke all user sessions (global signout)
 * const revokedCount = await sessionService.revokeAllUserSessions(
 *   user.id, // Internal ID (integer)
 *   'User requested global signout'
 * );
 * ```
 */
export class SessionService {
  constructor(
    private readonly sessionRepository: Repository<BaseSession>,
    private readonly storageAdapter: StorageAdapter,
    private readonly clientInfoService: ClientInfoService,
    private readonly config: NAuthConfig,
    private readonly logger: NAuthLogger,
    private readonly auditService?: AuthAuditService, // Optional - audit trail service (enabled via config.auditLogs.enabled)
  ) {}

  /**
   * Calculate session expiration date from config
   *
   * Parses session.maxLifetime config (e.g., '30d', '7d', '5h') and returns
   * the expiration Date. Defaults to 30 days if not configured.
   *
   * @returns Session expiration date
   */
  getSessionExpirationDate(): Date {
    const maxLifetime = this.config.session?.maxLifetime || '30d';
    const expiresInSeconds = this.parseMaxLifetime(maxLifetime);
    return new Date(Date.now() + expiresInSeconds * 1000);
  }

  /**
   * Parse maxLifetime from string or number
   *
   * @param maxLifetime - Max lifetime (e.g., '30d', '7d', '5h', 2592000)
   * @returns Max lifetime in seconds
   * @private
   */
  private parseMaxLifetime(maxLifetime: string | number): number {
    if (typeof maxLifetime === 'number') {
      return maxLifetime;
    }

    // Parse time strings (e.g., '15m', '1h', '30d')
    const units: Record<string, number> = {
      s: 1,
      m: 60,
      h: 3600,
      d: 86400,
    };

    const match = maxLifetime.match(/^(\d+)([smhd])$/);
    if (!match) {
      this.logger?.warn?.(`Invalid session.maxLifetime format: ${maxLifetime}. Using default 30 days.`);
      return 30 * 86400; // Default to 30 days in seconds
    }

    const [, value, unit] = match;
    return parseInt(value, 10) * units[unit];
  }

  /**
   * Create a new session
   *
   * Creates a session record with token hashes, device information,
   * and expiration time. Used during login and signup.
   *
   * @param data - Session creation data
   * @param data.userId - Internal user ID (integer, not sub)
   * @param data.accessTokenHash - SHA-256 hash of access token
   * @param data.refreshTokenHash - SHA-256 hash of refresh token
   * @param data.tokenFamily - Token family ID for rotation detection
   * @param data.deviceId - Optional device identifier (UUID). Auto-generated if not provided.
   * @param data.deviceName - Optional device name. Falls back to parsed value from ClientInfoService if not provided.
   * @param data.deviceType - Optional device type (mobile, desktop, tablet). Falls back to parsed value from ClientInfoService if not provided.
   * @param data.expiresAt - Session expiration date
   * @remarks Client info (ipAddress, ipCountry, ipCity, userAgent, platform, browser) is automatically extracted from ClientInfoService context
   * @param data.isRemembered - Whether session is from "remember me"
   * @param data.authMethod - Authentication method: 'password', 'google', 'facebook', 'github', etc.
   * @returns Created session
   *
   * @example
   * ```typescript
   * const session = await sessionService.createSession({
   *   userId: user.id, // Internal ID (integer)
   *   accessTokenHash: jwtService.hashToken(accessToken),
   *   refreshTokenHash: jwtService.hashToken(refreshToken),
   *   tokenFamily: jwtService.generateTokenFamily(),
   *   // Client info (ipAddress, userAgent, etc.) automatically extracted from ClientInfoService
   *   expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
   * });
   * ```
   */
  async createSession(data: {
    userId: number; // Internal user ID (integer)
    accessTokenHash: string;
    refreshTokenHash: string;
    tokenFamily: string;
    deviceId?: string;
    deviceName?: string; // Optional - falls back to parsed value from ClientInfoService
    deviceType?: string; // Optional - falls back to parsed value from ClientInfoService
    // Client info (ipAddress, ipCountry, ipCity, userAgent) automatically extracted from ClientInfoService
    expiresAt: Date;
    isRemembered?: boolean;
    authMethod?: string; // Authentication method: 'password', 'google', 'facebook', etc.
  }): Promise<ISession> {
    // ============================================================================
    // Session Limit Enforcement (maxConcurrent)
    // ============================================================================
    const maxConcurrent = this.config.session?.maxConcurrent;
    if (maxConcurrent && maxConcurrent > 0) {
      // Count active sessions for this user (not revoked and not expired)
      const now = new Date();
      // Fetch only IDs of active sessions ordered by oldest activity
      const activeIds: Array<{ id: number }> = (await this.sessionRepository.find({
        select: ['id'],
        where: { userId: data.userId, isRevoked: false, expiresAt: MoreThan(now) },
        order: { lastActivityAt: 'ASC' },
      })) as unknown as Array<{ id: number }>;

      if (activeIds.length >= maxConcurrent) {
        // Revoke oldest sessions to make room for new one (bulk update)
        const toRevokeCount = activeIds.length - maxConcurrent + 1;
        const idsToRevoke = activeIds.slice(0, toRevokeCount).map((s) => s.id);

        if (idsToRevoke.length > 0) {
          const nowTs = new Date();
          const result = await this.sessionRepository.update(
            { id: In(idsToRevoke) },
            { isRevoked: true, revokedAt: nowTs, revokeReason: 'Max concurrent sessions exceeded' },
          );

          const affected = result.affected || idsToRevoke.length;
          if (affected > 0) {
            // Single summary audit event
            try {
              await this.auditService?.recordEvent({
                userId: data.userId,
                eventType: AuthAuditEventType.SESSION_REVOKED,
                eventStatus: 'INFO',
                reason: 'Max concurrent sessions exceeded',
                description: `Revoked ${affected} session(s) due to max concurrent sessions limit`,
                metadata: {
                  revokedCount: affected,
                  sessionIds: idsToRevoke,
                },
              });
            } catch (auditError) {
              const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
              this.logger?.error?.(`Failed to record SESSION_REVOKED summary event: ${errorMessage}`, {
                error: auditError,
                userId: data.userId,
              });
            }
          }
        }
      }
    }
    // ============================================================================
    // Get client info from context (transparent access - no parameters needed)
    // ============================================================================
    // Client info is automatically extracted by ClientInfoInterceptor and stored in context
    // This includes parsed user agent info (platform, browser, deviceType, deviceName)
    // This allows SessionService to access IP, userAgent, etc. without requiring them as parameters
    const clientInfo = this.clientInfoService.get();

    // ============================================================================
    // Use parsed device information from ClientInfoService (already parsed by interceptor)
    // ============================================================================
    // ClientInfoService already parsed the user agent in the interceptor
    // Use provided values or fall back to parsed values from context
    const deviceType = data.deviceType || clientInfo.deviceType || null;
    const deviceName = data.deviceName || clientInfo.deviceName || null;
    const platform = clientInfo.platform || null;
    const browser = clientInfo.browser || null;

    // ============================================================================
    // Generate deviceId if not provided
    // ============================================================================
    // DeviceId is a unique UUID that identifies a specific browser/device
    // It's used for trusted device tracking and MFA "remember device" features
    // In browser contexts, this should be stored in localStorage/sessionStorage
    // and sent with each login request to maintain continuity
    let deviceId = data.deviceId;
    if (!deviceId) {
      const crypto = await import('crypto');
      deviceId = crypto.randomUUID();
    }

    const session = this.sessionRepository.create({
      userId: data.userId,
      accessTokenHash: data.accessTokenHash,
      refreshTokenHash: data.refreshTokenHash,
      tokenFamily: data.tokenFamily,
      deviceId,
      deviceName,
      deviceType,
      // Client info automatically extracted from ClientInfoService (transparent access)
      ipAddress: clientInfo.ipAddress || null,
      ipCountry: clientInfo.ipCountry || null,
      ipCity: clientInfo.ipCity || null,
      userAgent: clientInfo.userAgent || null,
      platform,
      browser,
      authMethod: data.authMethod || null,
      expiresAt: data.expiresAt,
      isRemembered: data.isRemembered || false,
      lastActivityAt: new Date(),
    });

    return (await this.sessionRepository.save(session)) as unknown as ISession;
  }

  /**
   * Find session by ID
   * @param sessionId - Session ID (can be string from JWT or number)
   */
  async findById(sessionId: string | number): Promise<ISession | null> {
    return (await this.sessionRepository.findOne({
      where: { id: typeof sessionId === 'string' ? parseInt(sessionId, 10) : sessionId },
    })) as ISession | null;
  }

  /**
   * Find session by ID with minimal fields (hot-path)
   * @param sessionId - Session ID (string or number)
   */
  async findByIdLight(
    sessionId: string | number,
  ): Promise<Pick<ISession, 'id' | 'version' | 'isRevoked' | 'expiresAt' | 'userId'> | null> {
    const id = typeof sessionId === 'string' ? parseInt(sessionId, 10) : sessionId;
    // Select minimal session fields to reduce DB payload
    const record = (await this.sessionRepository.findOne({
      select: ['id', 'version', 'isRevoked', 'expiresAt', 'userId'],
      where: { id },
    })) as unknown as ISession | null;

    if (!record) return null;
    const versionValue = (record as unknown as { version?: number }).version ?? (undefined as unknown as number);
    const light = {
      id: record.id,
      version: versionValue,
      isRevoked: record.isRevoked,
      expiresAt: record.expiresAt,
      userId: record.userId,
    } as unknown as Pick<ISession, 'id' | 'version' | 'isRevoked' | 'expiresAt' | 'userId'>;
    return light;
  }

  /**
   * Find session by refresh token hash
   */
  async findByRefreshToken(refreshTokenHash: string): Promise<ISession | null> {
    return (await this.sessionRepository.findOne({
      select: ['id', 'userId', 'isRevoked', 'tokenFamily', 'expiresAt'],
      where: { refreshTokenHash, isRevoked: false },
    })) as ISession | null;
  }

  /**
   * Find all active sessions for a user
   * @param userId - Internal user ID (integer)
   * @returns Array of active sessions
   */
  async findUserSessions(userId: number): Promise<ISession[]> {
    return (await this.sessionRepository.find({
      where: { userId, isRevoked: false },
      order: { createdAt: 'DESC' },
    })) as unknown as ISession[];
  }

  /**
   * Update session activity timestamp
   * @param sessionId - Session ID (can be string from JWT or number)
   */
  async updateActivity(sessionId: string | number): Promise<void> {
    const id = typeof sessionId === 'string' ? parseInt(sessionId, 10) : sessionId;
    await this.sessionRepository.update(id, {
      lastActivityAt: new Date(),
    });
  }

  /**
   * Update session with new tokens (for rotation)
   * @param sessionId - Session ID (can be string from JWT or number)
   */
  async updateTokens(sessionId: string | number, accessTokenHash: string, refreshTokenHash: string): Promise<void> {
    const id = typeof sessionId === 'string' ? parseInt(sessionId, 10) : sessionId;
    await this.sessionRepository.update(id, {
      accessTokenHash,
      refreshTokenHash,
      lastActivityAt: new Date(),
    });
  }

  /**
   * Create a session and update token hashes atomically within one transaction
   *
   * Uses a callback to generate token hashes after obtaining the session ID.
   * This allows callers to embed sessionId in JWTs, then persist hashes atomically.
   */
  async createSessionAtomic<T>(
    data: {
      userId: number;
      tokenFamily: string;
      deviceId?: string;
      deviceName?: string; // Optional - falls back to parsed value from ClientInfoService
      deviceType?: string; // Optional - falls back to parsed value from ClientInfoService
      // Client info (ipAddress, ipCountry, ipCity, userAgent) automatically extracted from ClientInfoService
      expiresAt: Date;
      isRemembered?: boolean;
      authMethod?: string;
    },
    generateHashes: (sessionId: number) => Promise<{ accessTokenHash: string; refreshTokenHash: string; extra?: T }>,
  ): Promise<{ session: ISession; extra?: T }> {
    // Get client info from context (transparent access)
    // ClientInfoService already parsed the user agent in the interceptor
    const clientInfo = this.clientInfoService.get();

    const result = await this.sessionRepository.manager.transaction(async (trx) => {
      // Use parsed device information from ClientInfoService (already parsed by interceptor)
      // Use provided values or fall back to parsed values from context
      const deviceType = data.deviceType || clientInfo.deviceType || null;
      const deviceName = data.deviceName || clientInfo.deviceName || null;
      const platform = clientInfo.platform || null;
      const browser = clientInfo.browser || null;

      // Generate deviceId if missing
      let deviceId = data.deviceId;
      if (!deviceId) {
        const crypto = await import('crypto');
        deviceId = crypto.randomUUID();
      }

      // Create with placeholder hashes (non-nullable columns)
      const sessionEntity = this.sessionRepository.create({
        userId: data.userId,
        accessTokenHash: '',
        refreshTokenHash: '',
        tokenFamily: data.tokenFamily,
        deviceId,
        deviceName,
        deviceType,
        // Client info automatically extracted from ClientInfoService (transparent access)
        ipAddress: clientInfo.ipAddress || null,
        ipCountry: clientInfo.ipCountry || null,
        ipCity: clientInfo.ipCity || null,
        userAgent: clientInfo.userAgent || null,
        platform,
        browser,
        authMethod: data.authMethod || null,
        expiresAt: data.expiresAt,
        isRemembered: data.isRemembered || false,
        lastActivityAt: new Date(),
      });

      const saved = await trx.save(sessionEntity);
      const savedId = saved.id as number;

      const { accessTokenHash, refreshTokenHash, extra } = await generateHashes(savedId);

      await trx
        .createQueryBuilder()
        .update(this.sessionRepository.target)
        .set({ accessTokenHash, refreshTokenHash, lastActivityAt: new Date() })
        .where({ id: savedId })
        .execute();

      // Re-fetch minimal session fields to return
      const sessionLight = (await trx.findOne(this.sessionRepository.target, {
        where: { id: savedId },
      })) as unknown as ISession | null;

      if (!sessionLight) {
        throw new Error('Failed to load session after creation');
      }

      return { session: sessionLight, extra } as { session: ISession; extra?: T };
    });

    return result;
  }

  /**
   * Revoke a single session
   * @param sessionId - Session ID (can be string from JWT or number)
   * @param reason - Optional reason for revocation
   * @param metadata - Optional metadata to include in audit trail
   */
  async revokeSession(sessionId: string | number, reason?: string, metadata?: Record<string, unknown>): Promise<void> {
    const id = typeof sessionId === 'string' ? parseInt(sessionId, 10) : sessionId;

    // Get session to retrieve userId for audit logging
    const session = await this.findById(id);
    if (!session) {
      return; // Session doesn't exist, nothing to revoke
    }

    await this.sessionRepository.update(id, {
      isRevoked: true,
      revokedAt: new Date(),
      revokeReason: reason,
    });

    // ============================================================================
    // Audit: Record session revocation
    // ============================================================================
    try {
      await this.auditService?.recordEvent({
        userId: session.userId,
        eventType: AuthAuditEventType.SESSION_REVOKED,
        eventStatus: 'INFO',
        sessionId: id,
        reason: reason || 'User logout',
        description: `Session revoked: ${reason || 'User logout'}`,
        // Client info automatically included from context
        metadata: metadata || undefined,
      });
    } catch (auditError) {
      // Non-blocking: Log but continue
      const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
      this.logger?.error?.(`Failed to record SESSION_REVOKED audit event: ${errorMessage}`, {
        error: auditError,
        userId: session.userId,
        sessionId: id,
      });
    }
  }

  /**
   * Revoke all sessions for a user (global signout)
   * @param userId - Internal user ID (integer)
   * @param reason - Optional reason for revocation
   * @returns Number of sessions revoked
   */
  async revokeAllUserSessions(userId: number, reason?: string): Promise<number> {
    // Get sessions before revoking for audit logging
    const sessions = await this.findUserSessions(userId);

    const result = await this.sessionRepository.update(
      { userId, isRevoked: false },
      {
        isRevoked: true,
        revokedAt: new Date(),
        revokeReason: reason,
      },
    );

    const revokedCount = result.affected || 0;

    // ============================================================================
    // Audit: Record session revocations (one event per session)
    // ============================================================================
    if (revokedCount > 0) {
      try {
        // Log one audit event summarizing all revoked sessions
        await this.auditService?.recordEvent({
          userId,
          eventType: AuthAuditEventType.SESSION_REVOKED,
          eventStatus: 'INFO',
          reason: reason || 'Global signout',
          description: `All user sessions revoked (${revokedCount} session(s))`,
          // Client info automatically included from context
          metadata: {
            revokedCount,
            sessionIds: sessions.map((s) => s.id),
          },
        });
      } catch (auditError) {
        // Non-blocking: Log but continue
        const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
        this.logger?.error?.(`Failed to record SESSION_REVOKED audit event (all sessions): ${errorMessage}`, {
          error: auditError,
          userId,
          revokedCount,
        });
      }
    }

    return revokedCount;
  }

  /**
   * Revoke all sessions in a token family (for reuse detection)
   */
  async revokeTokenFamily(tokenFamily: string, reason?: string): Promise<number> {
    const result = await this.sessionRepository.update(
      { tokenFamily, isRevoked: false },
      {
        isRevoked: true,
        revokedAt: new Date(),
        revokeReason: reason || 'Token reuse detected',
      },
    );

    return result.affected || 0;
  }

  /**
   * Cleanup expired sessions
   */
  async cleanupExpiredSessions(): Promise<number> {
    const result = await this.sessionRepository.delete({
      expiresAt: LessThan(new Date()),
    });

    return result.affected || 0;
  }

  /**
   * Count active sessions for a user
   * @param userId - Internal user ID (integer)
   * @returns Number of active sessions
   */
  async countUserSessions(userId: number): Promise<number> {
    return await this.sessionRepository.count({
      where: { userId, isRevoked: false },
    });
  }

  // ============================================================================
  // Token Reuse Detection (Security Feature)
  // ============================================================================

  /**
   * Mark a refresh token as used
   *
   * Stores the token hash in cache with expiration matching the refresh token TTL.
   * Used to detect token reuse attacks where stolen tokens are reused multiple times.
   *
   * ⚠️ SECURITY CRITICAL: This prevents token replay attacks
   *
   * @param tokenHash - SHA-256 hash of the refresh token
   * @param ttlSeconds - Time to live in seconds (should match refresh token expiry)
   *
   * @example
   * ```typescript
   * // Mark token as used during refresh
   * await sessionService.markRefreshTokenAsUsed(tokenHash, 30 * 24 * 60 * 60);
   * ```
   */
  async markRefreshTokenAsUsed(tokenHash: string, ttlSeconds: number): Promise<boolean> {
    const key = `used-token:${tokenHash}`;

    // Use atomic set-if-not-exists operation
    // Returns null if key already exists (NX failed), string if key was set
    const result = await this.storageAdapter.set(key, 'true', ttlSeconds, { nx: true });

    return result !== null; // True if successfully set, false if already existed
  }

  /**
   * Check if a refresh token has been used before
   *
   * If token has been used, it indicates a token reuse attack and the entire
   * token family should be revoked immediately.
   *
   * @param tokenHash - SHA-256 hash of the refresh token
   * @returns True if token has been used before, false otherwise
   *
   * @example
   * ```typescript
   * const isReused = await sessionService.isRefreshTokenUsed(tokenHash);
   * if (isReused) {
   *   // TOKEN REUSE DETECTED - SECURITY BREACH!
   *   await sessionService.revokeTokenFamily(session.tokenFamily);
   *   throw new UnauthorizedException('Token reuse detected');
   * }
   * ```
   */
  async isRefreshTokenUsed(tokenHash: string): Promise<boolean> {
    const key = `used-token:${tokenHash}`;
    return await this.storageAdapter.exists(key);
  }

  /**
   * Acquire a distributed lock for token refresh
   *
   * Uses atomic set-if-not-exists (NX) operation to prevent concurrent refresh attempts.
   * Lock is automatically released after TTL expires, or manually via releaseRefreshLock.
   *
   * @param lockKey - Lock key (e.g., `session-refresh:${sessionId}` or `refresh-lock:${tokenHash}`)
   * @param ttlMs - Lock TTL in milliseconds (default: 10000ms)
   * @returns True if lock was acquired, false if already locked by another request
   *
   * @example
   * ```typescript
   * const lockKey = `session-refresh:${sessionId}`;
   * const lockAcquired = await sessionService.acquireRefreshLock(lockKey, 10000);
   * if (!lockAcquired) {
   *   throw new Error('Refresh already in progress');
   * }
   * try {
   *   // ... perform refresh ...
   * } finally {
   *   await sessionService.releaseRefreshLock(lockKey);
   * }
   * ```
   */
  async acquireRefreshLock(lockKey: string, ttlMs: number = 10000): Promise<boolean> {
    // ============================================================================
    // CRITICAL FIX: Use atomic set-if-not-exists (NX) for lock acquisition
    // ============================================================================
    // The set() method with nx: true uses a transaction with pessimistic locking
    // to atomically check and insert. This ensures only one request can acquire
    // the lock even when multiple requests arrive simultaneously.
    // Increased default TTL to 10 seconds to handle slower database operations
    // Add small jitter (±5%) to reduce synchronized expirations under load
    const baseTtlSeconds = Math.max(1, Math.ceil(ttlMs / 1000));
    const jitterMax = Math.max(1, Math.floor(baseTtlSeconds * 0.05));
    const jitter = Math.floor(Math.random() * (jitterMax * 2 + 1)) - jitterMax; // [-jitterMax, +jitterMax]
    const ttlWithJitter = Math.max(1, baseTtlSeconds + jitter);

    const result = await this.storageAdapter.set(lockKey, 'locked', ttlWithJitter, { nx: true });

    const acquired = result !== null;

    // Debug logging to help diagnose lock issues
    if (!acquired) {
      // Lock acquisition failed - another request has it
      // This is expected behavior when multiple requests try to refresh simultaneously
    }

    return acquired;
  }

  /**
   * Release a distributed lock for token refresh
   *
   * @param lockKey - Lock key (must match the key used in acquireRefreshLock)
   */
  async releaseRefreshLock(lockKey: string): Promise<void> {
    await this.storageAdapter.del(lockKey);
  }
}
