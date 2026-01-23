import { Repository, In } from 'typeorm';
import { SessionService } from './session.service';
import { ISession } from '../interfaces/entities.interface';
import { BaseSession } from '../entities';
import { StorageAdapter } from '../interfaces/storage-adapter.interface';
import { NAuthLogger } from '../utils/nauth-logger';
import { NAuthConfig } from '../interfaces/config.interface';
import { InternalAuthAuditService as AuthAuditService } from './auth-audit.service';
import { AuthAuditEventType } from '../enums/auth-audit-event-type.enum';
import { ClientInfoService } from './client-info.service';
import { AuthErrorCode } from '../enums/error-codes.enum';

/**
 * SessionService Unit Tests
 *
 * Platform-agnostic: Uses direct instantiation, no NestJS dependencies.
 *
 * Covers:
 * - Session creation with maxConcurrent limit
 * - User agent parsing and device detection
 * - Finding sessions (by ID, refresh token, user ID)
 * - Updating session activity and tokens (rotation)
 * - Atomic session creation
 * - Session revocation (single, all, token family) with audit logging
 * - Cleanup operations
 * - Session counting
 * - Token reuse detection
 * - Distributed locking
 */
describe('SessionService', () => {
  let service: SessionService;
  let mockSessionRepository: jest.Mocked<Repository<BaseSession>>;
  let mockStorageAdapter: jest.Mocked<StorageAdapter>;
  let mockClientInfoService: jest.Mocked<ClientInfoService>;
  let mockConfig: NAuthConfig;
  let mockLogger: jest.Mocked<NAuthLogger>;
  let mockAuditService: jest.Mocked<AuthAuditService>;

  const mockSession: ISession = {
    id: 123,
    version: 1,
    userId: 123,
    accessTokenHash: 'access-hash-123',
    refreshTokenHash: 'refresh-hash-123',
    tokenFamily: 'family-abc',
    deviceId: 'device-123',
    deviceName: 'iPhone 13',
    deviceType: 'mobile',
    deviceFingerprint: 'fingerprint-123',
    ipAddress: '192.168.1.1',
    ipCountry: 'US',
    ipCity: 'New York',
    ipIsp: 'ISP Inc',
    userAgent: 'Mozilla/5.0...',
    platform: 'iOS',
    browser: 'Safari',
    authMethod: 'password',
    isTrustedDevice: false,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    lastActivityAt: new Date(),
    isRevoked: false,
    revokedAt: null,
    revokeReason: null,
    metadata: null,
    createdAt: new Date(),
  };

  beforeEach(() => {
    mockSessionRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      createQueryBuilder: jest.fn(),
      manager: {
        transaction: jest.fn(),
      } as any,
    } as any;

    mockStorageAdapter = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      incr: jest.fn(),
      decr: jest.fn(),
      expire: jest.fn(),
      ttl: jest.fn(),
      hget: jest.fn(),
      hset: jest.fn(),
      hgetall: jest.fn(),
      hdel: jest.fn(),
      lpush: jest.fn(),
      lrange: jest.fn(),
      llen: jest.fn(),
      keys: jest.fn(),
      scan: jest.fn(),
      initialize: jest.fn(),
      isHealthy: jest.fn().mockResolvedValue(true),
      cleanup: jest.fn(),
      disconnect: jest.fn(),
    } as any;

    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    } as any;

    mockAuditService = {
      recordEvent: jest.fn(),
    } as any;

    mockConfig = {
      jwt: {
        accessToken: { secret: 'test-secret', expiresIn: '15m' },
        refreshToken: { secret: 'test-refresh-secret', expiresIn: '7d' },
      },
    };

    mockClientInfoService = {
      get: jest.fn().mockReturnValue({
        ipAddress: '1.2.3.4',
        userAgent: 'test-agent',
        deviceToken: undefined,
        ipCountry: undefined,
        ipCity: undefined,
        platform: undefined,
        browser: undefined,
      }),
    } as any;

    // Instantiate service directly
    service = new SessionService(
      mockSessionRepository,
      mockStorageAdapter,
      mockClientInfoService,
      mockConfig,
      mockLogger,
      mockAuditService,
    );
  });

  // ============================================================================
  // findAuthContextBySessionId (hot-path)
  // ============================================================================

  describe('findAuthContextBySessionId', () => {
    it('should return null when session not found', async () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      };
      (mockSessionRepository.createQueryBuilder as unknown as jest.Mock).mockReturnValue(qb);

      const result = await service.findAuthContextBySessionId('123');
      expect(result).toBeNull();
    });

    it('should throw when user is inactive', async () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          id: 1,
          version: 1,
          isRevoked: false,
          expiresAt: new Date(Date.now() + 60_000),
          userId: 1,
          authMethod: 'password',
          user: { id: 1, sub: 'sub-1', isActive: false, passwordHash: null },
        }),
      };
      (mockSessionRepository.createQueryBuilder as unknown as jest.Mock).mockReturnValue(qb);

      await expect(service.findAuthContextBySessionId(1)).rejects.toMatchObject({ code: AuthErrorCode.ACCOUNT_INACTIVE });
    });

    it('should return safe user without passwordHash', async () => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          id: 1,
          version: 2,
          isRevoked: false,
          expiresAt: new Date(Date.now() + 60_000),
          userId: 1,
          authMethod: 'google',
          user: { id: 1, sub: 'sub-1', email: 'test@example.com', isActive: true, passwordHash: 'hashed' },
        }),
      };
      (mockSessionRepository.createQueryBuilder as unknown as jest.Mock).mockReturnValue(qb);

      const result = await service.findAuthContextBySessionId('1');
      expect(result).toBeDefined();
      expect(result?.session.version).toBe(2);
      expect(result?.user.sub).toBe('sub-1');
      expect((result?.user as unknown as { passwordHash?: string }).passwordHash).toBeUndefined();
      expect(result?.user.hasPasswordHash).toBe(true);
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Service Initialization
  // ============================================================================

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ============================================================================
  // Session Creation
  // ============================================================================

  describe('createSession', () => {
    it('should create a new session with all fields', async () => {
      // Set up client info mock to return test values
      mockClientInfoService.get.mockReturnValue({
        ipAddress: '192.168.1.1',
        ipCountry: 'US',
        ipCity: 'New York',
        userAgent: 'Mozilla/5.0...',
        platform: 'iOS',
        browser: 'Safari',
        deviceType: 'mobile',
        deviceName: 'Safari on iOS',
      });

      const sessionData = {
        userId: 123,
        accessTokenHash: 'access-hash',
        refreshTokenHash: 'refresh-hash',
        tokenFamily: 'family-abc',
        deviceId: 'device-123',
        deviceName: 'iPhone 13',
        deviceType: 'mobile',
        // Client info (ipAddress, ipCountry, ipCity, userAgent) automatically extracted from ClientInfoService
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isTrustedDevice: true,
        authMethod: 'password',
      };

      mockSessionRepository.create.mockReturnValue(mockSession as any);
      mockSessionRepository.save.mockResolvedValue(mockSession as any);

      const result = await service.createSession(sessionData);

      expect(mockSessionRepository.create).toHaveBeenCalledWith(
        (expect as any).objectContaining({
          userId: sessionData.userId,
          accessTokenHash: sessionData.accessTokenHash,
          refreshTokenHash: sessionData.refreshTokenHash,
          tokenFamily: sessionData.tokenFamily,
          deviceId: sessionData.deviceId,
          deviceName: sessionData.deviceName,
          deviceType: sessionData.deviceType,
          // Client info comes from ClientInfoService mock
          ipAddress: '192.168.1.1',
          ipCountry: 'US',
          ipCity: 'New York',
          userAgent: 'Mozilla/5.0...',
          authMethod: sessionData.authMethod,
          isTrustedDevice: true,
        }),
      );
      expect(mockSessionRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockSession);
    });

    it('should create session with minimal required fields', async () => {
      const sessionData = {
        userId: 123,
        accessTokenHash: 'access-hash',
        refreshTokenHash: 'refresh-hash',
        tokenFamily: 'family-abc',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };

      mockSessionRepository.create.mockReturnValue(mockSession as any);
      mockSessionRepository.save.mockResolvedValue(mockSession as any);

      const result = await service.createSession(sessionData);

      expect(mockSessionRepository.create).toHaveBeenCalled();
      expect(mockSessionRepository.save).toHaveBeenCalled();
      expect(result).toEqual(mockSession);
    });

    it('should set isTrustedDevice to false by default', async () => {
      const sessionData = {
        userId: 123,
        accessTokenHash: 'access-hash',
        refreshTokenHash: 'refresh-hash',
        tokenFamily: 'family-abc',
        expiresAt: new Date(),
      };

      mockSessionRepository.create.mockReturnValue(mockSession as any);
      mockSessionRepository.save.mockResolvedValue(mockSession as any);

      await service.createSession(sessionData);

      expect(mockSessionRepository.create).toHaveBeenCalledWith(
        (expect as any).objectContaining({
          isTrustedDevice: false,
        }),
      );
    });

    it('should auto-generate deviceId if not provided', async () => {
      const sessionData = {
        userId: 123,
        accessTokenHash: 'access-hash',
        refreshTokenHash: 'refresh-hash',
        tokenFamily: 'family-abc',
        expiresAt: new Date(),
      };

      const createdSession = { ...mockSession, deviceId: 'auto-generated-uuid' };
      mockSessionRepository.create.mockReturnValue(createdSession as any);
      mockSessionRepository.save.mockResolvedValue(createdSession as any);

      await service.createSession(sessionData);

      // DeviceId should be generated (UUID format)
      const createCall = mockSessionRepository.create.mock.calls[0][0];
      expect(createCall.deviceId).toBeDefined();
      expect(typeof createCall.deviceId).toBe('string');
      if (createCall.deviceId) {
        expect(createCall.deviceId.length).toBeGreaterThan(0);
      }
    });

    it('should parse user agent for device information', async () => {
      const sessionData = {
        userId: 123,
        accessTokenHash: 'access-hash',
        refreshTokenHash: 'refresh-hash',
        tokenFamily: 'family-abc',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
        expiresAt: new Date(),
      };

      mockSessionRepository.create.mockReturnValue(mockSession as any);
      mockSessionRepository.save.mockResolvedValue(mockSession as any);

      await service.createSession(sessionData);

      // User agent parsing should be attempted
      expect(mockSessionRepository.create).toHaveBeenCalled();
    });

    it('should enforce maxConcurrent session limit', async () => {
      mockConfig.session = { maxConcurrent: 2 };
      service = new SessionService(
        mockSessionRepository,
        mockStorageAdapter,
        mockClientInfoService,
        mockConfig,
        mockLogger,
        mockAuditService,
      );

      // Mock 3 active sessions (exceeds limit of 2)
      const activeSessions = [{ id: 1 }, { id: 2 }, { id: 3 }];
      mockSessionRepository.find.mockResolvedValueOnce(activeSessions as any);
      mockSessionRepository.update.mockResolvedValueOnce({ affected: 2 } as any);
      mockSessionRepository.create.mockReturnValue(mockSession as any);
      mockSessionRepository.save.mockResolvedValue(mockSession as any);

      const sessionData = {
        userId: 123,
        accessTokenHash: 'access-hash',
        refreshTokenHash: 'refresh-hash',
        tokenFamily: 'family-abc',
        expiresAt: new Date(),
      };

      await service.createSession(sessionData);

      // Should revoke oldest 2 sessions (3 - 2 + 1 = 2)
      expect(mockSessionRepository.update).toHaveBeenCalledWith(
        { id: In([1, 2]) } as any,
        (expect as any).objectContaining({
          isRevoked: true,
          revokeReason: 'Max concurrent sessions exceeded',
        }),
      );
    });

    it('should not revoke sessions if under maxConcurrent limit', async () => {
      mockConfig.session = { maxConcurrent: 5 };
      service = new SessionService(
        mockSessionRepository,
        mockStorageAdapter,
        mockClientInfoService,
        mockConfig,
        mockLogger,
        mockAuditService,
      );

      // Mock 2 active sessions (under limit of 5)
      mockSessionRepository.find.mockResolvedValueOnce([{ id: 1 }, { id: 2 }] as any);
      mockSessionRepository.create.mockReturnValue(mockSession as any);
      mockSessionRepository.save.mockResolvedValue(mockSession as any);

      const sessionData = {
        userId: 123,
        accessTokenHash: 'access-hash',
        refreshTokenHash: 'refresh-hash',
        tokenFamily: 'family-abc',
        expiresAt: new Date(),
      };

      await service.createSession(sessionData);

      // Should not call update for revocation
      expect(mockSessionRepository.update).not.toHaveBeenCalled();
    });

    it('should audit log when sessions are revoked due to maxConcurrent', async () => {
      mockConfig.session = { maxConcurrent: 1 };
      service = new SessionService(
        mockSessionRepository,
        mockStorageAdapter,
        mockClientInfoService,
        mockConfig,
        mockLogger,
        mockAuditService,
      );

      mockSessionRepository.find.mockResolvedValueOnce([{ id: 1 }, { id: 2 }] as any);
      mockSessionRepository.update.mockResolvedValueOnce({ affected: 2 } as any);
      mockSessionRepository.create.mockReturnValue(mockSession as any);
      mockSessionRepository.save.mockResolvedValue(mockSession as any);
      mockAuditService.recordEvent.mockResolvedValue(null);

      const sessionData = {
        userId: 123,
        accessTokenHash: 'access-hash',
        refreshTokenHash: 'refresh-hash',
        tokenFamily: 'family-abc',
        expiresAt: new Date(),
      };

      await service.createSession(sessionData);

      expect(mockAuditService.recordEvent).toHaveBeenCalledWith(
        (expect as any).objectContaining({
          userId: 123,
          eventType: AuthAuditEventType.SESSION_REVOKED,
          eventStatus: 'INFO',
          reason: 'Max concurrent sessions exceeded',
        }),
      );
    });

    it('should handle audit logging errors gracefully', async () => {
      mockConfig.session = { maxConcurrent: 1 };
      service = new SessionService(
        mockSessionRepository,
        mockStorageAdapter,
        mockClientInfoService,
        mockConfig,
        mockLogger,
        mockAuditService,
      );

      mockSessionRepository.find.mockResolvedValueOnce([{ id: 1 }] as any);
      mockSessionRepository.update.mockResolvedValueOnce({ affected: 1 } as any);
      mockSessionRepository.create.mockReturnValue(mockSession as any);
      mockSessionRepository.save.mockResolvedValue(mockSession as any);
      mockAuditService.recordEvent.mockRejectedValue(new Error('Audit service error'));

      const sessionData = {
        userId: 123,
        accessTokenHash: 'access-hash',
        refreshTokenHash: 'refresh-hash',
        tokenFamily: 'family-abc',
        expiresAt: new Date(),
      };

      await service.createSession(sessionData);

      expect(mockLogger.error).toHaveBeenCalled();
      // Session should still be created despite audit error
      expect(mockSessionRepository.save).toHaveBeenCalled();
    });

    it('should handle missing affected property in update result', async () => {
      mockConfig.session = { maxConcurrent: 1 };
      service = new SessionService(
        mockSessionRepository,
        mockStorageAdapter,
        mockClientInfoService,
        mockConfig,
        mockLogger,
        mockAuditService,
      );

      mockSessionRepository.find.mockResolvedValueOnce([{ id: 1 }] as any);
      mockSessionRepository.update.mockResolvedValueOnce({} as any); // No affected property
      mockSessionRepository.create.mockReturnValue(mockSession as any);
      mockSessionRepository.save.mockResolvedValue(mockSession as any);

      const sessionData = {
        userId: 123,
        accessTokenHash: 'access-hash',
        refreshTokenHash: 'refresh-hash',
        tokenFamily: 'family-abc',
        expiresAt: new Date(),
      };

      await service.createSession(sessionData);

      // Should handle gracefully without throwing
      expect(mockSessionRepository.save).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Finding Sessions
  // ============================================================================

  describe('findById', () => {
    it('should find session by numeric ID', async () => {
      mockSessionRepository.findOne.mockResolvedValue(mockSession as any);

      const result = await service.findById(123);

      expect(mockSessionRepository.findOne).toHaveBeenCalledWith({
        where: { id: 123 },
      });
      expect(result).toEqual(mockSession);
    });

    it('should find session by string ID', async () => {
      mockSessionRepository.findOne.mockResolvedValue(mockSession as any);

      const result = await service.findById('123');

      expect(mockSessionRepository.findOne).toHaveBeenCalledWith({
        where: { id: 123 },
      });
      expect(result).toEqual(mockSession);
    });

    it('should return null if session not found', async () => {
      mockSessionRepository.findOne.mockResolvedValue(null);

      const result = await service.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('findByIdLight', () => {
    it('should find session with minimal fields', async () => {
      const lightSession = {
        id: 123,
        version: 1,
        isRevoked: false,
        expiresAt: new Date(),
        userId: 123,
        authMethod: null,
      };
      mockSessionRepository.findOne.mockResolvedValue(lightSession as any);

      const result = await service.findByIdLight(123);

      expect(mockSessionRepository.findOne).toHaveBeenCalledWith({
        select: ['id', 'version', 'isRevoked', 'expiresAt', 'userId', 'authMethod'],
        where: { id: 123 },
      });
      expect(result).toEqual(lightSession);
    });

    it('should return null if session not found', async () => {
      mockSessionRepository.findOne.mockResolvedValue(null);

      const result = await service.findByIdLight(999);

      expect(result).toBeNull();
    });

    it('should handle string ID', async () => {
      const lightSession = {
        id: 123,
        version: 1,
        isRevoked: false,
        expiresAt: new Date(),
        userId: 123,
        authMethod: null,
      };
      mockSessionRepository.findOne.mockResolvedValue(lightSession as any);

      const result = await service.findByIdLight('123');

      expect(mockSessionRepository.findOne).toHaveBeenCalledWith({
        select: ['id', 'version', 'isRevoked', 'expiresAt', 'userId', 'authMethod'],
        where: { id: 123 },
      });
      expect(result).toEqual(lightSession);
    });

    it('should handle missing version field', async () => {
      const lightSessionWithoutVersion = {
        id: 123,
        isRevoked: false,
        expiresAt: new Date(),
        userId: 123,
      };
      mockSessionRepository.findOne.mockResolvedValue(lightSessionWithoutVersion as any);

      const result = await service.findByIdLight(123);

      expect(result).toBeDefined();
    });
  });

  describe('findByRefreshToken', () => {
    it('should find session by refresh token hash', async () => {
      mockSessionRepository.findOne.mockResolvedValue(mockSession as any);

      const result = await service.findByRefreshToken('refresh-hash-123');

      expect(mockSessionRepository.findOne).toHaveBeenCalledWith({
        select: ['id', 'userId', 'isRevoked', 'tokenFamily', 'expiresAt'],
        where: { refreshTokenHash: 'refresh-hash-123', isRevoked: false },
      });
      expect(result).toEqual(mockSession);
    });

    it('should return null if session not found', async () => {
      mockSessionRepository.findOne.mockResolvedValue(null);

      const result = await service.findByRefreshToken('invalid-hash');

      expect(result).toBeNull();
    });
  });

  describe('findUserSessions', () => {
    it('should find all active sessions for a user', async () => {
      const sessions = [mockSession, { ...mockSession, id: 456 }];
      mockSessionRepository.find.mockResolvedValue(sessions as any);

      const result = await service.findUserSessions(123);

      expect(mockSessionRepository.find).toHaveBeenCalledWith({
        where: { userId: 123, isRevoked: false },
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(sessions);
    });

    it('should return empty array if no sessions found', async () => {
      mockSessionRepository.find.mockResolvedValue([]);

      const result = await service.findUserSessions(999);

      expect(result).toEqual([]);
    });
  });

  // ============================================================================
  // Updating Sessions
  // ============================================================================

  describe('updateActivity', () => {
    it('should update session activity timestamp with numeric ID', async () => {
      mockSessionRepository.update.mockResolvedValue({ affected: 1 } as any);

      await service.updateActivity(123);

      expect(mockSessionRepository.update).toHaveBeenCalledWith(
        123,
        (expect as any).objectContaining({
          lastActivityAt: (expect as any).any(Date),
        }),
      );
    });

    it('should update session activity timestamp with string ID', async () => {
      mockSessionRepository.update.mockResolvedValue({ affected: 1 } as any);

      await service.updateActivity('123');

      expect(mockSessionRepository.update).toHaveBeenCalledWith(
        123,
        (expect as any).objectContaining({
          lastActivityAt: (expect as any).any(Date),
        }),
      );
    });
  });

  describe('updateTokens', () => {
    it('should update session with new token hashes', async () => {
      mockSessionRepository.update.mockResolvedValue({ affected: 1 } as any);

      await service.updateTokens(123, 'new-access-hash', 'new-refresh-hash');

      expect(mockSessionRepository.update).toHaveBeenCalledWith(123, {
        accessTokenHash: 'new-access-hash',
        refreshTokenHash: 'new-refresh-hash',
        lastActivityAt: (expect as any).any(Date),
      });
    });

    it('should handle string session ID', async () => {
      mockSessionRepository.update.mockResolvedValue({ affected: 1 } as any);

      await service.updateTokens('123', 'new-access-hash', 'new-refresh-hash');

      expect(mockSessionRepository.update).toHaveBeenCalledWith(
        123,
        (expect as any).objectContaining({
          accessTokenHash: 'new-access-hash',
        }),
      );
    });
  });

  // ============================================================================
  // Atomic Session Creation
  // ============================================================================

  describe('createSessionAtomic', () => {
    it('should create session atomically with hash generation', async () => {
      const sessionData = {
        userId: 123,
        tokenFamily: 'family-abc',
        expiresAt: new Date(),
      };

      const mockTransaction = jest.fn(async (callback) => {
        const mockTrx = {
          save: jest.fn().mockResolvedValue({ id: 123 } as any),
          createQueryBuilder: jest.fn().mockReturnValue({
            update: jest.fn().mockReturnValue({
              set: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue({
                  execute: jest.fn().mockResolvedValue(undefined),
                }),
              }),
            }),
          }),
          findOne: jest.fn().mockResolvedValue(mockSession as any),
        };
        return await callback(mockTrx);
      });

      mockSessionRepository.manager.transaction = mockTransaction as any;

      const generateHashes = jest.fn().mockResolvedValue({
        accessTokenHash: 'access-hash',
        refreshTokenHash: 'refresh-hash',
      });

      const result = await service.createSessionAtomic(sessionData, generateHashes);

      expect(mockTransaction).toHaveBeenCalled();
      expect(generateHashes).toHaveBeenCalledWith(123);
      expect(result.session).toBeDefined();
    });

    it('should handle extra data from hash generation', async () => {
      const sessionData = {
        userId: 123,
        tokenFamily: 'family-abc',
        expiresAt: new Date(),
      };

      const mockTransaction = jest.fn(async (callback) => {
        const mockTrx = {
          save: jest.fn().mockResolvedValue({ id: 123 } as any),
          createQueryBuilder: jest.fn().mockReturnValue({
            update: jest.fn().mockReturnValue({
              set: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue({
                  execute: jest.fn().mockResolvedValue(undefined),
                }),
              }),
            }),
          }),
          findOne: jest.fn().mockResolvedValue(mockSession as any),
        };
        return await callback(mockTrx);
      });

      mockSessionRepository.manager.transaction = mockTransaction as any;

      const generateHashes = jest.fn().mockResolvedValue({
        accessTokenHash: 'access-hash',
        refreshTokenHash: 'refresh-hash',
        extra: { customField: 'value' },
      });

      const result = await service.createSessionAtomic(sessionData, generateHashes);

      expect(result.extra).toEqual({ customField: 'value' });
    });

    it('should throw error if session not found after creation', async () => {
      const sessionData = {
        userId: 123,
        tokenFamily: 'family-abc',
        expiresAt: new Date(),
      };

      const mockTransaction = jest.fn(async (callback) => {
        const mockTrx = {
          save: jest.fn().mockResolvedValue({ id: 123 } as any),
          createQueryBuilder: jest.fn().mockReturnValue({
            update: jest.fn().mockReturnValue({
              set: jest.fn().mockReturnValue({
                where: jest.fn().mockReturnValue({
                  execute: jest.fn().mockResolvedValue(undefined),
                }),
              }),
            }),
          }),
          findOne: jest.fn().mockResolvedValue(null), // Session not found
        };
        return await callback(mockTrx);
      });

      mockSessionRepository.manager.transaction = mockTransaction as any;

      const generateHashes = jest.fn().mockResolvedValue({
        accessTokenHash: 'access-hash',
        refreshTokenHash: 'refresh-hash',
      });

      try {
        await service.createSessionAtomic(sessionData, generateHashes);
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Failed to load session after creation');
      }
    });
  });

  // ============================================================================
  // Session Revocation
  // ============================================================================

  describe('revokeSession', () => {
    it('should revoke a single session with reason', async () => {
      mockSessionRepository.findOne.mockResolvedValue(mockSession as any);
      mockSessionRepository.update.mockResolvedValue({ affected: 1 } as any);
      mockAuditService.recordEvent.mockResolvedValue(null);

      await service.revokeSession(123, 'User logout');

      expect(mockSessionRepository.findOne).toHaveBeenCalledWith({
        where: { id: 123 },
      });
      expect(mockSessionRepository.update).toHaveBeenCalledWith(123, {
        isRevoked: true,
        revokedAt: (expect as any).any(Date),
        revokeReason: 'User logout',
      });
      expect(mockAuditService.recordEvent).toHaveBeenCalledWith(
        (expect as any).objectContaining({
          userId: 123,
          eventType: AuthAuditEventType.SESSION_REVOKED,
          sessionId: 123,
          reason: 'User logout',
        }),
      );
    });

    it('should revoke session without reason', async () => {
      mockSessionRepository.findOne.mockResolvedValue(mockSession as any);
      mockSessionRepository.update.mockResolvedValue({ affected: 1 } as any);
      mockAuditService.recordEvent.mockResolvedValue(null);

      await service.revokeSession(123);

      expect(mockAuditService.recordEvent).toHaveBeenCalledWith(
        (expect as any).objectContaining({
          reason: 'User logout',
        }),
      );
    });

    it('should handle string session ID', async () => {
      mockSessionRepository.findOne.mockResolvedValue(mockSession as any);
      mockSessionRepository.update.mockResolvedValue({ affected: 1 } as any);
      mockAuditService.recordEvent.mockResolvedValue(null);

      await service.revokeSession('123', 'User logout');

      expect(mockSessionRepository.findOne).toHaveBeenCalledWith({
        where: { id: 123 },
      });
    });

    it('should return early if session not found', async () => {
      mockSessionRepository.findOne.mockResolvedValue(null);

      await service.revokeSession(999);

      expect(mockSessionRepository.update).not.toHaveBeenCalled();
      expect(mockAuditService.recordEvent).not.toHaveBeenCalled();
    });

    it('should handle audit logging errors gracefully', async () => {
      mockSessionRepository.findOne.mockResolvedValue(mockSession as any);
      mockSessionRepository.update.mockResolvedValue({ affected: 1 } as any);
      mockAuditService.recordEvent.mockRejectedValue(new Error('Audit error'));

      await service.revokeSession(123, 'User logout');

      expect(mockLogger.error).toHaveBeenCalled();
      // Session should still be revoked despite audit error
      expect(mockSessionRepository.update).toHaveBeenCalled();
    });

    it('should include metadata in audit log', async () => {
      mockSessionRepository.findOne.mockResolvedValue(mockSession as any);
      mockSessionRepository.update.mockResolvedValue({ affected: 1 } as any);
      mockAuditService.recordEvent.mockResolvedValue(null);

      const metadata = { customField: 'value' };
      await service.revokeSession(123, 'User logout', metadata);

      expect(mockAuditService.recordEvent).toHaveBeenCalledWith(
        (expect as any).objectContaining({
          metadata,
        }),
      );
    });
  });

  describe('revokeAllUserSessions', () => {
    it('should revoke all user sessions (global signout)', async () => {
      const sessions = [
        { ...mockSession, id: 123 },
        { ...mockSession, id: 456 },
        { ...mockSession, id: 789 },
      ];
      mockSessionRepository.find.mockResolvedValue(sessions as any);
      mockSessionRepository.update.mockResolvedValue({ affected: 3 } as any);
      mockAuditService.recordEvent.mockResolvedValue(null);

      const count = await service.revokeAllUserSessions(123, 'Global signout');

      expect(mockSessionRepository.find).toHaveBeenCalledWith({
        where: { userId: 123, isRevoked: false },
        order: { createdAt: 'DESC' },
      });
      expect(mockSessionRepository.update).toHaveBeenCalledWith(
        { userId: 123, isRevoked: false },
        {
          isRevoked: true,
          revokedAt: (expect as any).any(Date),
          revokeReason: 'Global signout',
        },
      );
      expect(count).toBe(3);
      // For global signout, should record individual SESSION_REVOKED event for each session
      expect(mockAuditService.recordEvent).toHaveBeenCalledTimes(3);
      // Should record individual SESSION_REVOKED event for each session
      expect(mockAuditService.recordEvent).toHaveBeenCalledTimes(3);
      sessions.forEach((session) => {
        expect(mockAuditService.recordEvent).toHaveBeenCalledWith(
          (expect as any).objectContaining({
            userId: 123,
            eventType: AuthAuditEventType.SESSION_REVOKED,
            reason: 'Global signout',
            description: 'Session revoked by global signout',
            sessionId: session.id,
          }),
        );
      });
    });

    it('should return 0 if no sessions to revoke', async () => {
      mockSessionRepository.find.mockResolvedValue([]);
      mockSessionRepository.update.mockResolvedValue({ affected: 0 } as any);

      const count = await service.revokeAllUserSessions(999);

      expect(count).toBe(0);
      expect(mockAuditService.recordEvent).not.toHaveBeenCalled();
    });

    it('should use default reason if not provided', async () => {
      mockSessionRepository.find.mockResolvedValue([mockSession] as any);
      mockSessionRepository.update.mockResolvedValue({ affected: 1 } as any);
      mockAuditService.recordEvent.mockResolvedValue(null);

      await service.revokeAllUserSessions(123);

      // When reason is not "Global signout", should record one summary event
      expect(mockAuditService.recordEvent).toHaveBeenCalledTimes(1);
      expect(mockAuditService.recordEvent).toHaveBeenCalledWith(
        (expect as any).objectContaining({
          eventType: AuthAuditEventType.SESSION_REVOKED,
          eventStatus: 'INFO',
          reason: 'Session revocation',
          description: 'All user sessions revoked (1 session(s))',
          userId: 123,
          metadata: expect.objectContaining({
            revokedCount: 1,
            sessionIds: [123],
          }),
        }),
      );
    });

    it('should handle audit logging errors gracefully', async () => {
      mockSessionRepository.find.mockResolvedValue([mockSession] as any);
      mockSessionRepository.update.mockResolvedValue({ affected: 1 } as any);
      (mockAuditService.recordEvent as jest.Mock).mockRejectedValue(new Error('Audit error'));

      const count = await service.revokeAllUserSessions(123);

      expect(count).toBe(1);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should include session IDs in audit metadata (non-global signout)', async () => {
      const sessions = [
        { ...mockSession, id: 1 },
        { ...mockSession, id: 2 },
      ];
      mockSessionRepository.find.mockResolvedValue(sessions as any);
      mockSessionRepository.update.mockResolvedValue({ affected: 2 } as any);
      (mockAuditService.recordEvent as jest.Mock).mockResolvedValue(null);

      await service.revokeAllUserSessions(123, 'Login from new session');

      // For non-global signout, should record one summary event
      expect(mockAuditService.recordEvent).toHaveBeenCalledTimes(1);
      expect(mockAuditService.recordEvent).toHaveBeenCalledWith(
        (expect as any).objectContaining({
          metadata: {
            revokedCount: 2,
            sessionIds: [1, 2],
          },
        }),
      );
    });
  });

  describe('revokeTokenFamily', () => {
    it('should revoke all sessions in token family (reuse detection)', async () => {
      mockSessionRepository.update.mockResolvedValue({ affected: 2 } as any);

      const count = await service.revokeTokenFamily('family-abc', 'Token reuse detected');

      expect(mockSessionRepository.update).toHaveBeenCalledWith(
        { tokenFamily: 'family-abc', isRevoked: false },
        {
          isRevoked: true,
          revokedAt: (expect as any).any(Date),
          revokeReason: 'Token reuse detected',
        },
      );
      expect(count).toBe(2);
    });

    it('should use default reason if not provided', async () => {
      mockSessionRepository.update.mockResolvedValue({ affected: 1 } as any);

      await service.revokeTokenFamily('family-xyz');

      expect(mockSessionRepository.update).toHaveBeenCalledWith(
        (expect as any).any(Object),
        (expect as any).objectContaining({
          revokeReason: 'Token reuse detected',
        }),
      );
    });

    it('should return 0 if no sessions in family', async () => {
      mockSessionRepository.update.mockResolvedValue({ affected: 0 } as any);

      const count = await service.revokeTokenFamily('nonexistent-family');

      expect(count).toBe(0);
    });

    it('should handle missing affected property', async () => {
      mockSessionRepository.update.mockResolvedValue({} as any);

      const count = await service.revokeTokenFamily('family-abc');

      expect(count).toBe(0);
    });
  });

  // ============================================================================
  // Cleanup Operations
  // ============================================================================

  describe('cleanupExpiredSessions', () => {
    it('should delete expired sessions', async () => {
      mockSessionRepository.delete.mockResolvedValue({ affected: 5 } as any);

      const count = await service.cleanupExpiredSessions();

      expect(mockSessionRepository.delete).toHaveBeenCalledWith({
        expiresAt: (expect as any).any(Object), // LessThan matcher
      });
      expect(count).toBe(5);
    });

    it('should return 0 if no expired sessions', async () => {
      mockSessionRepository.delete.mockResolvedValue({ affected: 0 } as any);

      const count = await service.cleanupExpiredSessions();

      expect(count).toBe(0);
    });

    it('should handle missing affected property', async () => {
      mockSessionRepository.delete.mockResolvedValue({} as any);

      const count = await service.cleanupExpiredSessions();

      expect(count).toBe(0);
    });
  });

  // ============================================================================
  // Session Counting
  // ============================================================================

  describe('countUserSessions', () => {
    it('should count active sessions for a user', async () => {
      mockSessionRepository.count.mockResolvedValue(3);

      const count = await service.countUserSessions(123);

      expect(mockSessionRepository.count).toHaveBeenCalledWith({
        where: { userId: 123, isRevoked: false },
      });
      expect(count).toBe(3);
    });

    it('should return 0 for user with no sessions', async () => {
      mockSessionRepository.count.mockResolvedValue(0);

      const count = await service.countUserSessions(999);

      expect(count).toBe(0);
    });
  });

  // ============================================================================
  // Token Reuse Detection
  // ============================================================================

  describe('markRefreshTokenAsUsed', () => {
    it('should mark token as used in storage with TTL', async () => {
      const tokenHash = 'abc123hash';
      const ttlSeconds = 2592000; // 30 days

      mockStorageAdapter.set.mockResolvedValue('true');

      const result = await service.markRefreshTokenAsUsed(tokenHash, ttlSeconds);

      expect(mockStorageAdapter.set).toHaveBeenCalledWith(`used-token:${tokenHash}`, 'true', ttlSeconds, { nx: true });
      expect(result).toBe(true);
    });

    it('should return false if token already marked as used', async () => {
      const tokenHash = 'abc123hash';

      // NX set returns null if key already exists
      mockStorageAdapter.set.mockResolvedValue(null);

      const result = await service.markRefreshTokenAsUsed(tokenHash, 3600);

      expect(result).toBe(false);
    });

    it('should use correct key format', async () => {
      const tokenHash = 'xyz789';
      mockStorageAdapter.set.mockResolvedValue('true');

      await service.markRefreshTokenAsUsed(tokenHash, 3600);

      const call = mockStorageAdapter.set.mock.calls[0];
      expect(call[0]).toBe('used-token:xyz789');
    });
  });

  describe('isRefreshTokenUsed', () => {
    it('should return true if token already used', async () => {
      const tokenHash = 'abc123hash';
      mockStorageAdapter.exists.mockResolvedValue(true);

      const result = await service.isRefreshTokenUsed(tokenHash);

      expect(result).toBe(true);
      expect(mockStorageAdapter.exists).toHaveBeenCalledWith(`used-token:${tokenHash}`);
    });

    it('should return false if token not used', async () => {
      const tokenHash = 'abc123hash';
      mockStorageAdapter.exists.mockResolvedValue(false);

      const result = await service.isRefreshTokenUsed(tokenHash);

      expect(result).toBe(false);
    });

    it('should check correct key format', async () => {
      const tokenHash = 'unique-token-hash';
      mockStorageAdapter.exists.mockResolvedValue(false);

      await service.isRefreshTokenUsed(tokenHash);

      expect(mockStorageAdapter.exists).toHaveBeenCalledWith('used-token:unique-token-hash');
    });
  });

  // ============================================================================
  // Distributed Locking
  // ============================================================================

  describe('acquireRefreshLock', () => {
    it('should acquire lock if not exists', async () => {
      const lockKey = 'session-refresh:123';
      const ttlMs = 5000;

      // NX set returns non-null if lock acquired
      mockStorageAdapter.set.mockResolvedValue('locked');

      const acquired = await service.acquireRefreshLock(lockKey, ttlMs);

      expect(acquired).toBe(true);
      expect(mockStorageAdapter.set).toHaveBeenCalledWith(
        lockKey,
        'locked',
        (expect as any).any(Number), // TTL with jitter
        { nx: true },
      );
      // TTL should be converted from ms to seconds (5 seconds)
      const ttlCall = mockStorageAdapter.set.mock.calls[0][2];
      expect(ttlCall).toBeGreaterThanOrEqual(4); // Allow for jitter
      expect(ttlCall).toBeLessThanOrEqual(6);
    });

    it('should fail to acquire lock if already exists', async () => {
      const lockKey = 'session-refresh:123';

      // NX set returns null if lock already exists
      mockStorageAdapter.set.mockResolvedValue(null);

      const acquired = await service.acquireRefreshLock(lockKey, 5000);

      expect(acquired).toBe(false);
    });

    it('should use default TTL of 10 seconds', async () => {
      const lockKey = 'session-refresh:123';
      mockStorageAdapter.set.mockResolvedValue('locked');

      await service.acquireRefreshLock(lockKey); // No TTL provided

      const ttlCall = mockStorageAdapter.set.mock.calls[0][2];
      // Default is 10000ms = 10 seconds, with jitter
      expect(ttlCall).toBeGreaterThanOrEqual(9);
      expect(ttlCall).toBeLessThanOrEqual(11);
    });

    it('should add jitter to TTL', async () => {
      const lockKey = 'session-refresh:123';
      const ttlMs = 10000; // 10 seconds

      mockStorageAdapter.set.mockResolvedValue('locked');

      // Call multiple times to check jitter variation
      const ttls: number[] = [];
      for (let i = 0; i < 10; i++) {
        await service.acquireRefreshLock(lockKey, ttlMs);
        const ttl = mockStorageAdapter.set.mock.calls[i][2];
        if (ttl !== undefined) {
          ttls.push(ttl);
        }
      }

      // Should have some variation (jitter)
      const uniqueTtls = new Set(ttls);
      // Allow some variation but within expected range
      expect(ttls.every((ttl) => ttl >= 9 && ttl <= 11)).toBe(true);
    });

    it('should handle minimum TTL of 1 second', async () => {
      const lockKey = 'session-refresh:123';
      mockStorageAdapter.set.mockResolvedValue('locked');

      await service.acquireRefreshLock(lockKey, 100); // Very small TTL

      const ttlCall = mockStorageAdapter.set.mock.calls[0][2];
      expect(ttlCall).toBeGreaterThanOrEqual(1);
    });
  });

  describe('releaseRefreshLock', () => {
    it('should delete lock key from storage', async () => {
      const lockKey = 'session-refresh:123';
      mockStorageAdapter.del.mockResolvedValue(undefined);

      await service.releaseRefreshLock(lockKey);

      expect(mockStorageAdapter.del).toHaveBeenCalledWith(lockKey);
    });

    it('should not throw if lock does not exist', async () => {
      const lockKey = 'nonexistent';
      mockStorageAdapter.del.mockResolvedValue(undefined);

      // Should complete without throwing
      await service.releaseRefreshLock(lockKey);
      expect(mockStorageAdapter.del).toHaveBeenCalledWith(lockKey);
    });
  });

  // ============================================================================
  // Service Without Optional Dependencies
  // ============================================================================

  describe('Service without optional dependencies', () => {
    it('should work without audit service', async () => {
      const serviceWithoutAudit = new SessionService(
        mockSessionRepository,
        mockStorageAdapter,
        mockClientInfoService,
        mockConfig,
        mockLogger,
        undefined, // No audit service
      );

      mockSessionRepository.findOne.mockResolvedValue(mockSession as any);
      mockSessionRepository.update.mockResolvedValue({ affected: 1 } as any);

      await serviceWithoutAudit.revokeSession(123, 'User logout');

      // Should not throw error
      expect(mockSessionRepository.update).toHaveBeenCalled();
    });
  });
});
