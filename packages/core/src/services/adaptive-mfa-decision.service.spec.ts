import { AdaptiveMFADecisionService } from './adaptive-mfa-decision.service';
import { RiskDetectionService } from './risk-detection.service';
import { RiskScoringService } from './risk-scoring.service';
import { StorageAdapter } from '../interfaces/storage-adapter.interface';
import { InternalAuthAuditService as AuthAuditService } from './auth-audit.service';
import { ClientInfoService } from './client-info.service';
import { IUser } from '../interfaces/entities.interface';
import { NAuthConfig, AdaptiveMFARiskEventPayload } from '../interfaces/config.interface';
import { NAuthLogger } from '../utils/nauth-logger';
import { ClientInfo } from '../interfaces/client-info.interface';
import { AuthAuditEventType } from '../enums/auth-audit-event-type.enum';
import { RiskFactor } from '../enums/risk-factor.enum';
import { HookRegistryService } from './hook-registry.service';

/**
 * Adaptive MFA Decision Service Unit Tests
 *
 * Platform-agnostic: Uses direct instantiation, no NestJS dependencies.
 *
 * Covers:
 * - Risk evaluation and decision making
 * - Risk level determination (low, medium, high)
 * - Action determination (allow, require_mfa, block_signin)
 * - Lifecycle hook integration (onAdaptiveMFATriggered, onSignInBlocked)
 * - User blocking functionality (isUserBlocked, blockUserSignIn)
 * - Configuration-based risk level customization
 * - Error handling and graceful degradation
 */
describe('AdaptiveMFADecisionService', () => {
  let service: AdaptiveMFADecisionService;
  let mockRiskDetectionService: jest.Mocked<RiskDetectionService>;
  let mockRiskScoringService: jest.Mocked<RiskScoringService>;
  let mockStorageAdapter: jest.Mocked<StorageAdapter>;
  let mockAuditService: jest.Mocked<AuthAuditService>;
  let mockClientInfoService: jest.Mocked<ClientInfoService>;
  let mockConfig: NAuthConfig;
  let mockLogger: jest.Mocked<NAuthLogger>;
  let mockHookRegistry: jest.Mocked<Pick<HookRegistryService, 'executeAdaptiveMFARiskDetected'>>;

  const mockUser: IUser = {
    id: 1,
    sub: 'user-123',
    email: 'test@example.com',
    username: 'testuser',
    phone: null,
    firstName: null,
    lastName: null,
    passwordHash: null,
    passwordChangedAt: null,
    passwordHistory: null,
    isEmailVerified: true,
    isPhoneVerified: false,
    isActive: true,
    mustChangePassword: false,
    isLocked: false,
    lockReason: null,
    lockedAt: null,
    lockedUntil: null,
    failedLoginAttempts: 0,
    lastFailedLoginAt: null,
    lastLoginAt: null,
    lastLoginIp: null,
    hasSocialAuth: false,
    socialProviders: null,
    mfaEnabled: false,
    mfaMethods: null,
    preferredMfaMethod: null,
    backupCodes: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockClientInfo: ClientInfo = {
    ipAddress: '192.168.1.100',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    deviceToken: 'device-123',
    deviceName: 'Chrome on Windows',
    deviceType: 'desktop',
    ipCountry: 'US',
    ipCity: 'New York',
    platform: 'Windows',
    browser: 'Chrome',
  };

  beforeEach(() => {
    mockRiskDetectionService = {
      detectRiskFactors: jest.fn(),
    } as any;

    mockRiskScoringService = {
      calculateRiskScore: jest.fn(),
      getRiskLevel: jest.fn(),
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
      isHealthy: jest.fn(),
      cleanup: jest.fn(),
      disconnect: jest.fn(),
    } as any;

    mockAuditService = {
      recordEvent: jest.fn().mockResolvedValue(null),
    } as any;

    mockClientInfoService = {
      get: jest.fn().mockReturnValue(mockClientInfo),
    } as any;

    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    } as any;

    mockHookRegistry = {
      executeAdaptiveMFARiskDetected: jest.fn().mockResolvedValue(undefined),
    };

    mockConfig = {
      jwt: {
        accessToken: { secret: 'test-secret', expiresIn: '15m' },
        refreshToken: { secret: 'test-refresh-secret', expiresIn: '7d' },
      },
      mfa: {
        adaptive: {
          triggers: ['new_device', 'new_ip', 'new_country'],
          riskLevels: {
            low: { maxScore: 20, action: 'allow', notifyUser: false },
            medium: { maxScore: 50, action: 'require_mfa', notifyUser: true },
            high: { maxScore: 100, action: 'require_mfa', notifyUser: true },
          },
        },
      },
    };

    // Instantiate service directly
    service = new AdaptiveMFADecisionService(
      mockRiskDetectionService,
      mockRiskScoringService,
      mockStorageAdapter,
      mockClientInfoService,
      mockConfig,
      mockLogger,
      mockAuditService,
      mockHookRegistry as unknown as HookRegistryService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Service Initialization
  // ============================================================================

  it('should be defined', () => {
    expect(service).toBeDefined();
    // Verify clientInfoService is injected
    expect((service as any).clientInfoService).toBe(mockClientInfoService);
  });

  // ============================================================================
  // evaluateAdaptiveMFA - Low Risk
  // ============================================================================

  describe('evaluateAdaptiveMFA() - low risk', () => {
    it('should return allow action for low risk score', async () => {
      mockClientInfoService.get.mockReturnValue(mockClientInfo);
      mockRiskDetectionService.detectRiskFactors.mockResolvedValue([RiskFactor.NEW_DEVICE]);
      mockRiskScoringService.calculateRiskScore.mockReturnValue(15); // Low risk
      mockRiskScoringService.getRiskLevel.mockReturnValue('low');
      mockAuditService.recordEvent.mockResolvedValue(null);

      const decision = await service.evaluateAdaptiveMFA(mockUser, 'password');

      expect(decision.action).toBe('allow');
      expect(decision.riskScore).toBe(15);
      expect(decision.riskLevel).toBe('low');
      expect(decision.riskFactors).toEqual([RiskFactor.NEW_DEVICE]);
      // Payload should not be included for low risk (allow action, notifyUser false)
      expect(decision.payload).toBeUndefined();
      expect(decision.notifyUser).toBe(false);
      expect(decision.hookOverride).toBe(false);
    });

    it('should not execute adaptiveMfaRiskDetected hook when notifyUser is false (low risk)', async () => {
      mockClientInfoService.get.mockReturnValue(mockClientInfo);
      mockRiskDetectionService.detectRiskFactors.mockResolvedValue([RiskFactor.NEW_DEVICE]);
      mockRiskScoringService.calculateRiskScore.mockReturnValue(15); // Low risk
      mockAuditService.recordEvent.mockResolvedValue(null);

      await service.evaluateAdaptiveMFA(mockUser, 'password');

      expect(mockHookRegistry.executeAdaptiveMFARiskDetected).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // evaluateAdaptiveMFA - Medium Risk
  // ============================================================================

  describe('evaluateAdaptiveMFA() - medium risk', () => {
    it('should return require_mfa action for medium risk score', async () => {
      mockClientInfoService.get.mockReturnValue(mockClientInfo);
      mockRiskDetectionService.detectRiskFactors.mockResolvedValue([RiskFactor.NEW_COUNTRY]);
      mockRiskScoringService.calculateRiskScore.mockReturnValue(35); // Medium risk
      mockRiskScoringService.getRiskLevel.mockReturnValue('medium');
      mockAuditService.recordEvent.mockResolvedValue(null);

      const decision = await service.evaluateAdaptiveMFA(mockUser, 'password');

      expect(decision.action).toBe('require_mfa');
      expect(decision.riskScore).toBe(35);
      expect(decision.riskLevel).toBe('medium');
      expect(decision.notifyUser).toBe(true);
      // Payload should be included when notifyUser is true
      expect(decision.payload).toBeDefined();
      expect(decision.payload?.action).toBe('require_mfa');
      expect(decision.payload?.user.email).toBe('test@example.com');
    });

    // TODO: Re-enable when onAdaptiveMFATriggered hook is implemented in HookRegistryService
    // it('should call lifecycle hook for medium risk when notifyUser is true', async () => { ... });
    // it('should allow hook to override action by returning false', async () => { ... });
  });

  // ============================================================================
  // evaluateAdaptiveMFA - High Risk
  // ============================================================================

  describe('evaluateAdaptiveMFA() - high risk', () => {
    it('should return require_mfa action for high risk by default', async () => {
      mockClientInfoService.get.mockReturnValue(mockClientInfo);
      mockRiskDetectionService.detectRiskFactors.mockResolvedValue([
        RiskFactor.IMPOSSIBLE_TRAVEL,
        RiskFactor.SUSPICIOUS_ACTIVITY,
      ]);
      mockRiskScoringService.calculateRiskScore.mockReturnValue(70); // High risk
      mockRiskScoringService.getRiskLevel.mockReturnValue('high');
      mockAuditService.recordEvent.mockResolvedValue(null);

      const decision = await service.evaluateAdaptiveMFA(mockUser, 'password');

      expect(decision.action).toBe('require_mfa');
      expect(decision.riskScore).toBe(70);
      expect(decision.riskLevel).toBe('high');
      expect(decision.notifyUser).toBe(true);
    });

    it('should return block_signin action when configured for high risk', async () => {
      const testConfig: NAuthConfig = {
        ...mockConfig,
        mfa: {
          ...mockConfig.mfa,
          adaptive: {
            ...mockConfig.mfa!.adaptive!,
            riskLevels: {
              ...mockConfig.mfa!.adaptive!.riskLevels,
              high: {
                maxScore: 100,
                action: 'block_signin' as const,
                notifyUser: true,
              },
            },
          },
        },
      };

      mockClientInfoService.get.mockReturnValue(mockClientInfo);
      mockRiskDetectionService.detectRiskFactors.mockResolvedValue([
        RiskFactor.IMPOSSIBLE_TRAVEL,
        RiskFactor.SUSPICIOUS_ACTIVITY,
      ]);
      mockRiskScoringService.calculateRiskScore.mockReturnValue(70);
      mockRiskScoringService.getRiskLevel.mockReturnValue('high');

      const testService = new AdaptiveMFADecisionService(
        mockRiskDetectionService,
        mockRiskScoringService,
        mockStorageAdapter,
        mockClientInfoService,
        testConfig,
        mockLogger,
        mockAuditService,
      );

      const decision = await testService.evaluateAdaptiveMFA(mockUser, 'password');

      expect(decision.action).toBe('block_signin');
      expect(decision.riskScore).toBe(70);
      expect(decision.riskLevel).toBe('high');
      // Payload should be included for block_signin action
      expect(decision.payload).toBeDefined();
      expect(decision.payload?.action).toBe('block_signin');
      expect(decision.payload?.riskScore).toBe(70);
      expect(decision.payload?.user.email).toBe('test@example.com');
    });

    it('should return block_signin action and include payload for blockUserSignIn', async () => {
      const testConfig: NAuthConfig = {
        ...mockConfig,
        mfa: {
          ...mockConfig.mfa,
          adaptive: {
            ...mockConfig.mfa!.adaptive!,
            riskLevels: {
              ...mockConfig.mfa!.adaptive!.riskLevels,
              high: {
                maxScore: 100,
                action: 'block_signin' as const,
                notifyUser: true,
              },
            },
          },
        },
      };

      mockClientInfoService.get.mockReturnValue(mockClientInfo);
      mockRiskDetectionService.detectRiskFactors.mockResolvedValue([RiskFactor.IMPOSSIBLE_TRAVEL]);
      mockRiskScoringService.calculateRiskScore.mockReturnValue(70);
      mockRiskScoringService.getRiskLevel.mockReturnValue('high');

      const testService = new AdaptiveMFADecisionService(
        mockRiskDetectionService,
        mockRiskScoringService,
        mockStorageAdapter,
        mockClientInfoService,
        testConfig,
        mockLogger,
        mockAuditService,
      );

      const decision = await testService.evaluateAdaptiveMFA(mockUser, 'password');

      expect(decision.action).toBe('block_signin');
      // Payload should be included for block_signin action (caller can use it to call blockUserSignIn)
      expect(decision.payload).toBeDefined();
      expect(decision.payload?.action).toBe('block_signin');
    });

    it('should execute adaptiveMfaRiskDetected hook when notifyUser is true (medium risk)', async () => {
      mockClientInfoService.get.mockReturnValue(mockClientInfo);
      mockRiskDetectionService.detectRiskFactors.mockResolvedValue([RiskFactor.NEW_COUNTRY]);
      mockRiskScoringService.calculateRiskScore.mockReturnValue(35); // Medium risk
      mockAuditService.recordEvent.mockResolvedValue(null);

      const decision = await service.evaluateAdaptiveMFA(mockUser, 'password');

      expect(decision.notifyUser).toBe(true);
      expect(mockHookRegistry.executeAdaptiveMFARiskDetected).toHaveBeenCalledTimes(1);
      const call = mockHookRegistry.executeAdaptiveMFARiskDetected.mock.calls[0]?.[0];
      expect(call.user.email).toBe(mockUser.email);
      expect(call.riskScore).toBe(35);
      expect(call.riskLevel).toBe('medium');
      expect(call.action).toBe('require_mfa');
    });
  });

  // ============================================================================
  // evaluateAdaptiveMFA - Configuration
  // ============================================================================

  describe('evaluateAdaptiveMFA() - configuration', () => {
    it('should use default risk levels when not configured', async () => {
      const testConfig: NAuthConfig = {
        ...mockConfig,
        mfa: {
          ...mockConfig.mfa,
          adaptive: {
            ...mockConfig.mfa!.adaptive!,
            riskLevels: undefined,
          },
        },
      };

      mockClientInfoService.get.mockReturnValue(mockClientInfo);
      mockRiskDetectionService.detectRiskFactors.mockResolvedValue([RiskFactor.NEW_DEVICE]);
      mockRiskScoringService.calculateRiskScore.mockReturnValue(15);
      mockRiskScoringService.getRiskLevel.mockReturnValue('low');

      const testService = new AdaptiveMFADecisionService(
        mockRiskDetectionService,
        mockRiskScoringService,
        mockStorageAdapter,
        mockClientInfoService,
        testConfig,
        mockLogger,
        mockAuditService,
      );

      const decision = await testService.evaluateAdaptiveMFA(mockUser, 'password');

      expect(decision.action).toBe('allow'); // Default for low
    });

    it('should respect custom risk level thresholds', async () => {
      const testConfig: NAuthConfig = {
        ...mockConfig,
        mfa: {
          ...mockConfig.mfa,
          adaptive: {
            ...mockConfig.mfa!.adaptive!,
            riskLevels: {
              low: { maxScore: 30, action: 'allow' as const, notifyUser: false },
              medium: { maxScore: 70, action: 'require_mfa' as const, notifyUser: true },
              high: { maxScore: 100, action: 'require_mfa' as const, notifyUser: true },
            },
          },
        },
      };

      mockClientInfoService.get.mockReturnValue(mockClientInfo);
      mockRiskDetectionService.detectRiskFactors.mockResolvedValue([RiskFactor.NEW_DEVICE]);
      mockRiskScoringService.calculateRiskScore.mockReturnValue(25); // Now in low range
      mockRiskScoringService.getRiskLevel.mockReturnValue('low');

      const testService = new AdaptiveMFADecisionService(
        mockRiskDetectionService,
        mockRiskScoringService,
        mockStorageAdapter,
        mockClientInfoService,
        testConfig,
        mockLogger,
        mockAuditService,
      );

      const decision = await testService.evaluateAdaptiveMFA(mockUser, 'password');

      expect(decision.action).toBe('allow');
    });
  });

  // ============================================================================
  // evaluateAdaptiveMFA - Audit Logging
  // ============================================================================

  describe('evaluateAdaptiveMFA() - audit logging', () => {
    it('should record audit event with risk details', async () => {
      mockClientInfoService.get.mockReturnValue(mockClientInfo);
      mockRiskDetectionService.detectRiskFactors.mockResolvedValue([RiskFactor.NEW_COUNTRY]);
      mockRiskScoringService.calculateRiskScore.mockReturnValue(35);
      mockRiskScoringService.getRiskLevel.mockReturnValue('medium');
      mockAuditService.recordEvent.mockResolvedValue(null);

      await service.evaluateAdaptiveMFA(mockUser, 'password');

      expect(mockAuditService.recordEvent).toHaveBeenCalled();
      const auditCall = mockAuditService.recordEvent.mock.calls[0][0];
      expect(auditCall.userId).toBe(1);
      expect(auditCall.eventType).toBe(AuthAuditEventType.ADAPTIVE_MFA_RISK_ASSESSED);
      expect(auditCall.riskFactors).toEqual([RiskFactor.NEW_COUNTRY]);
      expect(auditCall.riskFactor).toBe(35);
      expect(auditCall.adaptiveMfaTriggered).toBe(true);
    });

    it('should handle audit logging errors gracefully', async () => {
      mockClientInfoService.get.mockReturnValue(mockClientInfo);
      mockRiskDetectionService.detectRiskFactors.mockResolvedValue([RiskFactor.NEW_DEVICE]);
      mockRiskScoringService.calculateRiskScore.mockReturnValue(15);
      mockRiskScoringService.getRiskLevel.mockReturnValue('low');
      // recordEvent returns a promise that rejects - service catches it
      mockAuditService.recordEvent.mockImplementation(() => Promise.reject(new Error('Audit error')));

      // Should not throw
      const decision = await service.evaluateAdaptiveMFA(mockUser, 'password');

      expect(decision).toBeDefined();
      // Service uses .catch() so error is handled internally
    });
  });

  // ============================================================================
  // isUserBlocked
  // ============================================================================

  describe('isUserBlocked()', () => {
    it('should return blocked=false when no block exists', async () => {
      mockStorageAdapter.get.mockClear();
      mockStorageAdapter.get.mockResolvedValue(null);

      const result = await service.isUserBlocked(1);

      expect(result.blocked).toBe(false);
      expect(mockStorageAdapter.get).toHaveBeenCalledWith('adaptive_mfa_block:1');
    });

    it('should return blocked=true when block exists', async () => {
      const blockData = {
        userId: 1,
        userSub: 'user-123',
        message: 'Sign-in blocked',
        riskScore: 70,
        riskFactors: [RiskFactor.IMPOSSIBLE_TRAVEL],
        blockedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
      };

      mockStorageAdapter.get.mockClear();
      mockStorageAdapter.get.mockResolvedValue(JSON.stringify(blockData));

      const result = await service.isUserBlocked(1);

      expect(result.blocked).toBe(true);
      expect(result.message).toBe('Sign-in blocked');
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('should return blocked=false when block has expired', async () => {
      const expiredBlockData = {
        userId: 1,
        userSub: 'user-123',
        message: 'Sign-in blocked',
        riskScore: 70,
        riskFactors: [RiskFactor.IMPOSSIBLE_TRAVEL],
        blockedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        expiresAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago (expired)
      };

      mockStorageAdapter.get.mockClear();
      mockStorageAdapter.get.mockResolvedValue(JSON.stringify(expiredBlockData));
      mockStorageAdapter.del.mockClear();
      mockStorageAdapter.del.mockResolvedValue(undefined);

      const result = await service.isUserBlocked(1);

      expect(result.blocked).toBe(false);
      expect(mockStorageAdapter.del).toHaveBeenCalledWith('adaptive_mfa_block:1');
    });

    it('should handle permanent blocks (no expiration)', async () => {
      const permanentBlockData: any = {
        userId: 1,
        userSub: 'user-123',
        message: 'Sign-in blocked',
        riskScore: 70,
        riskFactors: [RiskFactor.IMPOSSIBLE_TRAVEL],
        blockedAt: new Date().toISOString(),
      };
      // expiresAt is omitted (not set) for permanent blocks

      mockStorageAdapter.get.mockClear();
      mockStorageAdapter.get.mockResolvedValue(JSON.stringify(permanentBlockData));

      const result = await service.isUserBlocked(1);

      expect(result.blocked).toBe(true);
      expect(result.expiresAt).toBeUndefined();
    });

    it('should derive expiry from blockedAt when config.blockDuration is set (legacy block)', async () => {
      const blockedAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2 hours ago
      const legacyPermanentBlockData: any = {
        userId: 1,
        userSub: 'user-123',
        message: 'Sign-in blocked',
        riskScore: 70,
        riskFactors: [RiskFactor.IMPOSSIBLE_TRAVEL],
        blockedAt,
        // expiresAt intentionally omitted
      };

      const testConfig: NAuthConfig = {
        ...mockConfig,
        mfa: {
          ...mockConfig.mfa,
          adaptive: {
            ...mockConfig.mfa!.adaptive!,
            blockedSignIn: {
              blockDuration: 60, // 60 minutes
            },
          },
        },
      };

      const testService = new AdaptiveMFADecisionService(
        mockRiskDetectionService,
        mockRiskScoringService,
        mockStorageAdapter,
        mockClientInfoService,
        testConfig,
        mockLogger,
        mockAuditService,
      );

      mockStorageAdapter.get.mockClear();
      mockStorageAdapter.get.mockResolvedValue(JSON.stringify(legacyPermanentBlockData));
      mockStorageAdapter.del.mockClear();
      mockStorageAdapter.del.mockResolvedValue(undefined);

      const result = await testService.isUserBlocked(1);

      // 2 hours ago + 60 minutes duration => expired => should auto-clear
      expect(result.blocked).toBe(false);
      expect(mockStorageAdapter.del).toHaveBeenCalledWith('adaptive_mfa_block:1');
    });

    it('should handle errors gracefully', async () => {
      mockStorageAdapter.get.mockRejectedValueOnce(new Error('Storage error'));

      const result = await service.isUserBlocked(1);

      expect(result.blocked).toBe(false); // Safer default
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // blockUserSignIn
  // ============================================================================

  describe('blockUserSignIn()', () => {
    it('should block user with temporary TTL when blockDuration configured', async () => {
      const testConfig: NAuthConfig = {
        ...mockConfig,
        mfa: {
          ...mockConfig.mfa,
          adaptive: {
            ...mockConfig.mfa!.adaptive!,
            blockedSignIn: {
              blockDuration: 60, // 60 minutes
              message: 'Custom block message',
            },
          },
        },
      };

      const payload: AdaptiveMFARiskEventPayload = {
        user: {
          sub: 'user-123',
          email: 'test@example.com',
          username: 'testuser',
        },
        riskScore: 70,
        riskLevel: 'high',
        riskFactors: [RiskFactor.IMPOSSIBLE_TRAVEL],
        action: 'block_signin',
        clientInfo: {
          ipAddress: mockClientInfo.ipAddress,
          ipCountry: mockClientInfo.ipCountry,
          ipCity: mockClientInfo.ipCity,
          deviceId: mockClientInfo.deviceToken,
          deviceName: mockClientInfo.deviceName,
          deviceType: mockClientInfo.deviceType,
          userAgent: mockClientInfo.userAgent,
          platform: mockClientInfo.platform,
          browser: mockClientInfo.browser,
        },
        authMethod: 'password',
        timestamp: new Date(),
      };

      const testService = new AdaptiveMFADecisionService(
        mockRiskDetectionService,
        mockRiskScoringService,
        mockStorageAdapter,
        mockClientInfoService,
        testConfig,
        mockLogger,
        mockAuditService,
      );

      await testService.blockUserSignIn(mockUser, payload);

      const setCall = mockStorageAdapter.set.mock.calls[0];
      expect(setCall[0]).toBe('adaptive_mfa_block:1');
      expect(setCall[1]).toContain('Custom block message');
      expect(setCall[2]).toBe(3600); // 60 minutes in seconds
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('should block user permanently when blockDuration not configured', async () => {
      const testConfig: NAuthConfig = {
        ...mockConfig,
        mfa: {
          ...mockConfig.mfa,
          adaptive: {
            ...mockConfig.mfa!.adaptive!,
            blockedSignIn: {
              message: 'Sign-in blocked',
            },
          },
        },
      };

      const payload: AdaptiveMFARiskEventPayload = {
        user: {
          sub: 'user-123',
          email: 'test@example.com',
          username: 'testuser',
        },
        riskScore: 70,
        riskLevel: 'high',
        riskFactors: [RiskFactor.IMPOSSIBLE_TRAVEL],
        action: 'block_signin',
        clientInfo: {
          ipAddress: mockClientInfo.ipAddress,
          ipCountry: mockClientInfo.ipCountry,
          ipCity: mockClientInfo.ipCity,
          deviceId: mockClientInfo.deviceToken,
          deviceName: mockClientInfo.deviceName,
          deviceType: mockClientInfo.deviceType,
          userAgent: mockClientInfo.userAgent,
          platform: mockClientInfo.platform,
          browser: mockClientInfo.browser,
        },
        authMethod: 'password',
        timestamp: new Date(),
      };

      const testService = new AdaptiveMFADecisionService(
        mockRiskDetectionService,
        mockRiskScoringService,
        mockStorageAdapter,
        mockClientInfoService,
        testConfig,
        mockLogger,
        mockAuditService,
      );

      await testService.blockUserSignIn(mockUser, payload);

      const setCall = mockStorageAdapter.set.mock.calls[0];
      expect(setCall[0]).toBe('adaptive_mfa_block:1');
      expect(typeof setCall[1]).toBe('string');
      expect(setCall[2]).toBeUndefined(); // No TTL
    });

    // TODO: Re-enable when onSignInBlocked hook is implemented in HookRegistryService
    // it('should call onSignInBlocked lifecycle hook', async () => { ... });
    // it('should handle hook errors gracefully', async () => { ... });

    it('should use default message when not configured', async () => {
      const testConfig: NAuthConfig = {
        ...mockConfig,
        mfa: {
          ...mockConfig.mfa,
          adaptive: {
            ...mockConfig.mfa!.adaptive!,
            blockedSignIn: {},
          },
        },
      };

      const payload: AdaptiveMFARiskEventPayload = {
        user: {
          sub: 'user-123',
          email: 'test@example.com',
          username: 'testuser',
        },
        riskScore: 70,
        riskLevel: 'high',
        riskFactors: [RiskFactor.IMPOSSIBLE_TRAVEL],
        action: 'block_signin',
        clientInfo: {
          ipAddress: mockClientInfo.ipAddress,
          ipCountry: mockClientInfo.ipCountry,
          ipCity: mockClientInfo.ipCity,
          deviceId: mockClientInfo.deviceToken,
          deviceName: mockClientInfo.deviceName,
          deviceType: mockClientInfo.deviceType,
          userAgent: mockClientInfo.userAgent,
          platform: mockClientInfo.platform,
          browser: mockClientInfo.browser,
        },
        authMethod: 'password',
        timestamp: new Date(),
      };

      const testService = new AdaptiveMFADecisionService(
        mockRiskDetectionService,
        mockRiskScoringService,
        mockStorageAdapter,
        mockClientInfoService,
        testConfig,
        mockLogger,
        mockAuditService,
      );

      await testService.blockUserSignIn(mockUser, payload);

      const setCall = mockStorageAdapter.set.mock.calls[0];
      const blockData = JSON.parse(setCall[1] as string);
      expect(blockData.message).toContain('suspicious activity');
    });
  });

  // ============================================================================
  // evaluateAdaptiveMFA - Error Handling
  // ============================================================================

  describe('evaluateAdaptiveMFA() - error handling', () => {
    it('should handle risk detection errors gracefully', async () => {
      mockClientInfoService.get.mockReturnValue(mockClientInfo);
      // Risk detection returns empty array on error (handled internally)
      mockRiskDetectionService.detectRiskFactors.mockResolvedValue([]);
      mockRiskScoringService.calculateRiskScore.mockReturnValue(0);
      mockRiskScoringService.getRiskLevel.mockReturnValue('low');
      mockAuditService.recordEvent.mockResolvedValue(null);

      const decision = await service.evaluateAdaptiveMFA(mockUser, 'password');

      expect(decision).toBeDefined();
      expect(decision.action).toBe('allow');
    });

    it('should handle missing client info gracefully', async () => {
      mockClientInfoService.get.mockReturnValue({
        ipAddress: 'unknown',
        userAgent: 'unknown',
      } as ClientInfo);

      mockRiskDetectionService.detectRiskFactors.mockResolvedValue([]);
      mockRiskScoringService.calculateRiskScore.mockReturnValue(0);
      mockRiskScoringService.getRiskLevel.mockReturnValue('low');

      const decision = await service.evaluateAdaptiveMFA(mockUser, 'password');

      expect(decision.action).toBe('allow');
    });

    it('should throw error when user email is missing', async () => {
      const userWithoutEmail: IUser = {
        ...mockUser,
        email: '', // Empty email
      };

      try {
        await service.evaluateAdaptiveMFA(userWithoutEmail, 'password');
        fail('Expected evaluateAdaptiveMFA to throw error for missing email');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('User email is required for adaptive MFA evaluation');
      }
    });

    it('should throw error when user email is null', async () => {
      const userWithoutEmail: IUser = {
        ...mockUser,
        email: null as unknown as string, // Force null for test
      };

      try {
        await service.evaluateAdaptiveMFA(userWithoutEmail, 'password');
        fail('Expected evaluateAdaptiveMFA to throw error for null email');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('User email is required for adaptive MFA evaluation');
      }
    });
  });

  // ============================================================================
  // clearUserBlock
  // ============================================================================

  describe('clearUserBlock()', () => {
    it('should clear user block successfully', async () => {
      mockStorageAdapter.del.mockResolvedValue(undefined);

      await service.clearUserBlock(1);

      expect(mockStorageAdapter.del).toHaveBeenCalledWith('adaptive_mfa_block:1');
      expect(mockLogger.log).toHaveBeenCalledWith((expect as any).stringContaining('User block cleared'));
    });

    it('should handle errors gracefully', async () => {
      mockStorageAdapter.del.mockRejectedValue(new Error('Storage error'));

      await service.clearUserBlock(1);

      expect(mockLogger.warn).toHaveBeenCalled();
      // Should not throw
    });
  });

  // ============================================================================
  // Block scoping — the storage key must not be movable by the caller
  // ============================================================================

  describe('scoped sign-in blocks', () => {
    /**
     * A real key/value store, so a read that computes a different key than the write
     * genuinely misses. Stubbing `get` to always return the record would hide exactly
     * the defect these tests exist to catch.
     */
    let store: Map<string, string>;

    /** Build the service with a given blockedSignIn scope, backed by `store`. */
    const scopedService = (scope: 'user' | 'device' | 'ip'): AdaptiveMFADecisionService => {
      const storage = {
        get: jest.fn(async (key: string) => store.get(key) ?? null),
        set: jest.fn(async (key: string, value: string) => {
          store.set(key, value);
        }),
        del: jest.fn(async (key: string) => {
          store.delete(key);
        }),
      } as unknown as StorageAdapter;

      const config = {
        ...mockConfig,
        mfa: {
          ...mockConfig.mfa,
          adaptive: {
            ...mockConfig.mfa?.adaptive,
            blockedSignIn: { scope, blockDuration: 15 },
          },
        },
      };

      return new AdaptiveMFADecisionService(
        mockRiskDetectionService,
        mockRiskScoringService,
        storage,
        mockClientInfoService,
        config,
        mockLogger,
        mockAuditService,
        mockHookRegistry as unknown as HookRegistryService,
      );
    };

    const payload = { riskScore: 95, riskFactors: [RiskFactor.NEW_DEVICE] } as any;

    beforeEach(() => {
      store = new Map<string, string>();
      mockClientInfoService.get.mockReturnValue(mockClientInfo);
    });

    it('writes every scope to the user-only key', async () => {
      for (const scope of ['user', 'device', 'ip'] as const) {
        store.clear();
        await scopedService(scope).blockUserSignIn(mockUser, payload);
        expect([...store.keys()]).toEqual(['adaptive_mfa_block:1']);
      }
    });

    it('never stores the plaintext device token', async () => {
      await scopedService('device').blockUserSignIn(mockUser, payload);

      const raw = store.get('adaptive_mfa_block:1') as string;
      expect(raw).not.toContain('device-123');
      expect(JSON.parse(raw).deviceTokenHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('keeps a device-scoped block in force when the device token is dropped', async () => {
      const service = scopedService('device');
      await service.blockUserSignIn(mockUser, payload);

      // The bypass: replay the sign-in with no x-device-token header at all. Under the
      // old scoped-key scheme this read landed on a different key and found nothing.
      mockClientInfoService.get.mockReturnValue({ ...mockClientInfo, deviceToken: undefined } as any);

      await expect(service.isUserBlocked(1)).resolves.toMatchObject({ blocked: true });
    });

    it('keeps an ip-scoped block in force when the IP is unknown', async () => {
      const service = scopedService('ip');
      await service.blockUserSignIn(mockUser, payload);

      mockClientInfoService.get.mockReturnValue({ ...mockClientInfo, ipAddress: undefined } as any);

      await expect(service.isUserBlocked(1)).resolves.toMatchObject({ blocked: true });
    });

    it('still applies a device-scoped block to the same device', async () => {
      const service = scopedService('device');
      await service.blockUserSignIn(mockUser, payload);

      await expect(service.isUserBlocked(1)).resolves.toMatchObject({ blocked: true });
    });

    it('does not apply a device-scoped block to a genuinely different device', async () => {
      const service = scopedService('device');
      await service.blockUserSignIn(mockUser, payload);

      // Out of scope by configuration; risk scoring re-evaluates that request instead.
      mockClientInfoService.get.mockReturnValue({ ...mockClientInfo, deviceToken: 'some-other-device' });

      await expect(service.isUserBlocked(1)).resolves.toMatchObject({ blocked: false });
    });

    it('applies a user-scoped block whatever the request presents', async () => {
      const service = scopedService('user');
      await service.blockUserSignIn(mockUser, payload);

      mockClientInfoService.get.mockReturnValue({ deviceToken: 'other', ipAddress: '10.0.0.1' } as any);

      await expect(service.isUserBlocked(1)).resolves.toMatchObject({ blocked: true });
    });

    it('clears the block that was written, whatever the scope', async () => {
      const service = scopedService('ip');
      await service.blockUserSignIn(mockUser, payload);
      expect(store.size).toBe(1);

      // An admin unblocking runs in their own request context, with their own IP — the
      // scoped-key scheme could not address the blocked user's key from there.
      mockClientInfoService.get.mockReturnValue({ ...mockClientInfo, ipAddress: '203.0.113.9' });
      await service.clearUserBlock(1);

      expect(store.size).toBe(0);
      await expect(service.isUserBlocked(1)).resolves.toMatchObject({ blocked: false });
    });
  });

  // ============================================================================
  // Service Without Optional Dependencies
  // ============================================================================

  describe('Service without optional dependencies', () => {
    it('should work without audit service', async () => {
      const serviceWithoutAudit = new AdaptiveMFADecisionService(
        mockRiskDetectionService,
        mockRiskScoringService,
        mockStorageAdapter,
        mockClientInfoService,
        mockConfig,
        mockLogger,
        undefined, // No audit service
      );

      mockClientInfoService.get.mockReturnValue(mockClientInfo);
      mockRiskDetectionService.detectRiskFactors.mockResolvedValue([]);
      mockRiskScoringService.calculateRiskScore.mockReturnValue(0);
      mockRiskScoringService.getRiskLevel.mockReturnValue('low');

      const decision = await serviceWithoutAudit.evaluateAdaptiveMFA(mockUser, 'password');

      // Should not throw error
      expect(decision).toBeDefined();
      expect(decision.action).toBe('allow');
    });
  });
});
