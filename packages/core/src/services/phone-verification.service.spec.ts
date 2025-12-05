import { Repository } from 'typeorm';
import { PhoneVerificationService } from './phone-verification.service';
import { NAuthException } from '../exceptions/nauth.exception';
import { ClientInfoService } from './client-info.service';
import { SMSProvider } from '../interfaces/provider.interface';
import { StorageAdapter } from '../interfaces/storage-adapter.interface';
import { NAuthConfig } from '../interfaces/config.interface';
import { NAuthLogger } from '../utils/nauth-logger';
import { AuthAuditService } from './auth-audit.service';
import { BaseVerificationToken, BaseUser } from '../entities';
import { IUser, IVerificationToken } from '../interfaces/entities.interface';
import { AuthErrorCode } from '../enums/error-codes.enum';

/**
 * Phone Verification Service Unit Tests
 *
 * Platform-agnostic: Uses direct instantiation, no NestJS dependencies.
 *
 * Covers:
 * - Send verification SMS with rate limiting
 * - Code-based verification (by phone and by sub)
 * - Resend verification SMS with cooldown
 * - Rate limiting per user
 * - Error handling for all dependencies
 * - Storage adapter failures
 * - SMS provider errors
 */
describe('PhoneVerificationService', () => {
  let service: PhoneVerificationService;
  let mockVerificationTokenRepository: jest.Mocked<Repository<BaseVerificationToken>>;
  let mockUserRepository: jest.Mocked<Repository<BaseUser>>;
  let mockSmsProvider: jest.Mocked<SMSProvider>;
  let mockStorageAdapter: jest.Mocked<StorageAdapter>;
  let mockClientInfoService: jest.Mocked<ClientInfoService>;
  let mockLogger: jest.Mocked<NAuthLogger>;
  let mockAuditService: jest.Mocked<AuthAuditService>;
  let mockConfig: NAuthConfig;

  const mockUser: IUser = {
    id: 123,
    sub: 'user-sub-123',
    email: 'test@example.com',
    username: 'testuser',
    phone: '+1234567890',
    firstName: null,
    lastName: null,
    passwordHash: null,
    passwordChangedAt: null,
    passwordHistory: null,
    isEmailVerified: false,
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

  const mockVerificationToken: IVerificationToken = {
    id: 456,
    userId: 123,
    type: 'phone',
    token: 'hashed-token-abc123',
    code: '123456',
    expiresAt: new Date(Date.now() + 300000), // 5 minutes from now
    attempts: 0,
    usedAt: null,
    ipAddress: '127.0.0.1',
    userAgent: 'test-agent',
    createdAt: new Date(),
    isExpired: jest.fn().mockReturnValue(false),
    maxAttemptsExceeded: jest.fn().mockReturnValue(false),
  };

  beforeEach(() => {
    mockVerificationTokenRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 0 } as any),
      count: jest.fn(),
    } as any;

    mockUserRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 } as any),
    } as any;

    mockSmsProvider = {
      sendOTP: jest.fn().mockResolvedValue(undefined),
      setLogger: jest.fn(),
    } as any;

    mockStorageAdapter = {
      get: jest.fn(),
      set: jest.fn(),
      incr: jest.fn().mockResolvedValue(1),
      expire: jest.fn().mockResolvedValue(undefined),
      ttl: jest.fn().mockResolvedValue(3600),
      del: jest.fn().mockResolvedValue(undefined),
      exists: jest.fn(),
      initialize: jest.fn(),
      isHealthy: jest.fn().mockResolvedValue(true),
      cleanup: jest.fn(),
      disconnect: jest.fn(),
    } as any;

    mockClientInfoService = {
      get: jest.fn().mockReturnValue({
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      }),
    } as any;

    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    } as any;

    mockAuditService = {
      recordEvent: jest.fn().mockResolvedValue(null),
    } as any;

    mockConfig = {
      jwt: {
        accessToken: { secret: 'test-secret', expiresIn: '15m' },
        refreshToken: { secret: 'test-refresh-secret', expiresIn: '7d' },
      },
      signup: {
        phoneVerification: {
          codeLength: 6,
          expiresIn: 300,
          maxAttempts: 3,
          resendDelay: 60,
          rateLimitMax: 3,
          rateLimitWindow: 3600,
        },
      },
    };

    // Instantiate service directly
    service = new PhoneVerificationService(
      mockVerificationTokenRepository,
      mockUserRepository,
      mockSmsProvider,
      mockStorageAdapter,
      mockConfig,
      mockClientInfoService,
      mockLogger,
      mockAuditService,
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
  });

  // ============================================================================
  // sendVerificationSMS
  // ============================================================================

  describe('sendVerificationSMS', () => {
    it('should send verification SMS successfully', async () => {
      mockStorageAdapter.incr.mockResolvedValue(1);
      mockStorageAdapter.ttl.mockResolvedValue(3600);
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockVerificationTokenRepository.findOne.mockResolvedValue(null); // No last token
      mockVerificationTokenRepository.create.mockReturnValue(mockVerificationToken as any);
      mockVerificationTokenRepository.save.mockResolvedValue(mockVerificationToken as any);

      const result = await service.sendVerificationSMS('user-sub-123');

      expect(mockStorageAdapter.incr).toHaveBeenCalled();
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { sub: 'user-sub-123' } as any });
      expect(mockVerificationTokenRepository.save).toHaveBeenCalled();
      expect(mockSmsProvider.sendOTP).toHaveBeenCalledWith('+1234567890', (expect as any).any(String));
      expect(mockAuditService.recordEvent).toHaveBeenCalled();
      expect(result).toBe(456);
    });

    it('should throw NAuthException if user not found', async () => {
      mockStorageAdapter.incr.mockResolvedValue(1);
      mockStorageAdapter.ttl.mockResolvedValue(3600);
      mockUserRepository.findOne.mockResolvedValue(null);

      try {
        await service.sendVerificationSMS('invalid-sub');
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
        expect(error.code).toBe(AuthErrorCode.NOT_FOUND);
      }
    });

    it('should throw NAuthException if phone not provided', async () => {
      const userWithoutPhone = { ...mockUser, phone: null };
      mockStorageAdapter.incr.mockResolvedValue(1);
      mockStorageAdapter.ttl.mockResolvedValue(3600);
      mockUserRepository.findOne.mockResolvedValue(userWithoutPhone as any);

      try {
        await service.sendVerificationSMS('user-sub-123');
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
        expect(error.code).toBe(AuthErrorCode.PHONE_REQUIRED);
      }
    });

    it('should throw NAuthException if phone already verified (when skipAlreadyVerifiedCheck is false)', async () => {
      const verifiedUser = { ...mockUser, isPhoneVerified: true };
      mockStorageAdapter.incr.mockResolvedValue(1);
      mockStorageAdapter.ttl.mockResolvedValue(3600);
      mockUserRepository.findOne.mockResolvedValue(verifiedUser as any);

      try {
        await service.sendVerificationSMS('user-sub-123', false); // Don't skip check
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
        expect(error.code).toBe(AuthErrorCode.ALREADY_VERIFIED);
      }
    });

    it('should allow sending SMS when phone already verified (skipAlreadyVerifiedCheck is true)', async () => {
      const verifiedUser = { ...mockUser, isPhoneVerified: true };
      mockStorageAdapter.incr.mockResolvedValue(1);
      mockStorageAdapter.ttl.mockResolvedValue(3600);
      mockUserRepository.findOne.mockResolvedValue(verifiedUser as any);
      mockVerificationTokenRepository.findOne.mockResolvedValue(null);
      mockVerificationTokenRepository.create.mockReturnValue(mockVerificationToken as any);
      mockVerificationTokenRepository.save.mockResolvedValue(mockVerificationToken as any);

      await service.sendVerificationSMS('user-sub-123', true); // Skip check

      expect(mockSmsProvider.sendOTP).toHaveBeenCalled();
    });

    it('should enforce rate limit (too many SMS)', async () => {
      mockStorageAdapter.incr.mockResolvedValue(4); // Exceeds limit of 3
      mockStorageAdapter.ttl.mockResolvedValue(3600);

      try {
        await service.sendVerificationSMS('user-sub-123');
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
        expect(error.code).toBe(AuthErrorCode.RATE_LIMIT_SMS);
        expect(mockUserRepository.findOne).not.toHaveBeenCalled();
      }
    });

    it('should enforce resend delay', async () => {
      const recentToken = {
        ...mockVerificationToken,
        createdAt: new Date(Date.now() - 30 * 1000), // 30 seconds ago (less than 60s delay)
      };
      mockStorageAdapter.incr.mockResolvedValue(1);
      mockStorageAdapter.ttl.mockResolvedValue(3600);
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockVerificationTokenRepository.findOne.mockResolvedValue(recentToken as any);

      try {
        await service.sendVerificationSMS('user-sub-123');
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
        expect(error.code).toBe(AuthErrorCode.RATE_LIMIT_RESEND);
      }
    });

    it('should allow resend after delay period', async () => {
      const oldToken = {
        ...mockVerificationToken,
        createdAt: new Date(Date.now() - 70 * 1000), // 70 seconds ago (more than 60s delay)
      };
      mockStorageAdapter.incr.mockResolvedValue(1);
      mockStorageAdapter.ttl.mockResolvedValue(3600);
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockVerificationTokenRepository.findOne.mockResolvedValue(oldToken as any);
      mockVerificationTokenRepository.create.mockReturnValue(mockVerificationToken as any);
      mockVerificationTokenRepository.save.mockResolvedValue(mockVerificationToken as any);

      await service.sendVerificationSMS('user-sub-123');

      expect(mockSmsProvider.sendOTP).toHaveBeenCalled();
    });

    it('should invalidate existing unused tokens', async () => {
      mockStorageAdapter.incr.mockResolvedValue(1);
      mockStorageAdapter.ttl.mockResolvedValue(3600);
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockVerificationTokenRepository.findOne.mockResolvedValue(null);
      mockVerificationTokenRepository.create.mockReturnValue(mockVerificationToken as any);
      mockVerificationTokenRepository.save.mockResolvedValue(mockVerificationToken as any);

      await service.sendVerificationSMS('user-sub-123');

      expect(mockVerificationTokenRepository.update).toHaveBeenCalledWith(
        (expect as any).objectContaining({
          userId: 123,
          type: 'phone',
        }),
        (expect as any).objectContaining({
          usedAt: (expect as any).any(Date),
        }),
      );
    });

    it('should handle rate limit window reset when TTL > window', async () => {
      mockStorageAdapter.ttl.mockResolvedValue(7200); // TTL longer than window (3600)
      mockStorageAdapter.del.mockResolvedValue(undefined);
      mockStorageAdapter.incr.mockResolvedValue(1);
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockVerificationTokenRepository.findOne.mockResolvedValue(null);
      mockVerificationTokenRepository.create.mockReturnValue(mockVerificationToken as any);
      mockVerificationTokenRepository.save.mockResolvedValue(mockVerificationToken as any);

      await service.sendVerificationSMS('user-sub-123');

      expect(mockStorageAdapter.del).toHaveBeenCalledWith('phone-verification:user-sub-123');
    });

    it('should handle SMS provider errors', async () => {
      mockStorageAdapter.incr.mockResolvedValue(1);
      mockStorageAdapter.ttl.mockResolvedValue(3600);
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockVerificationTokenRepository.findOne.mockResolvedValue(null);
      mockVerificationTokenRepository.create.mockReturnValue(mockVerificationToken as any);
      mockVerificationTokenRepository.save.mockResolvedValue(mockVerificationToken as any);
      mockSmsProvider.sendOTP.mockRejectedValue(new Error('SMS service error'));

      try {
        await service.sendVerificationSMS('user-sub-123');
        fail('Should have thrown error');
      } catch (error: any) {
        expect(error.message).toContain('SMS service error');
      }
    });

    it('should handle audit service errors gracefully', async () => {
      mockStorageAdapter.incr.mockResolvedValue(1);
      mockStorageAdapter.ttl.mockResolvedValue(3600);
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockVerificationTokenRepository.findOne.mockResolvedValue(null);
      mockVerificationTokenRepository.create.mockReturnValue(mockVerificationToken as any);
      mockVerificationTokenRepository.save.mockResolvedValue(mockVerificationToken as any);
      mockAuditService.recordEvent.mockRejectedValue(new Error('Audit error'));

      await service.sendVerificationSMS('user-sub-123');

      expect(mockLogger.error).toHaveBeenCalled();
      expect(mockSmsProvider.sendOTP).toHaveBeenCalled(); // Should still send SMS
    });

    it('should use custom rate limit config', async () => {
      mockConfig.signup!.phoneVerification!.rateLimitMax = 5;
      mockConfig.signup!.phoneVerification!.rateLimitWindow = 1800;
      service = new PhoneVerificationService(
        mockVerificationTokenRepository,
        mockUserRepository,
        mockSmsProvider,
        mockStorageAdapter,
        mockConfig,
        mockClientInfoService,
        mockLogger,
        mockAuditService,
      );

      mockStorageAdapter.incr.mockResolvedValue(6); // Exceeds new limit of 5
      mockStorageAdapter.ttl.mockResolvedValue(1800);

      try {
        await service.sendVerificationSMS('user-sub-123');
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error.code).toBe(AuthErrorCode.RATE_LIMIT_SMS);
      }
    });

    it('should use custom resend delay config', async () => {
      mockConfig.signup!.phoneVerification!.resendDelay = 120; // 2 minutes
      service = new PhoneVerificationService(
        mockVerificationTokenRepository,
        mockUserRepository,
        mockSmsProvider,
        mockStorageAdapter,
        mockConfig,
        mockClientInfoService,
        mockLogger,
        mockAuditService,
      );

      const recentToken = {
        ...mockVerificationToken,
        createdAt: new Date(Date.now() - 90 * 1000), // 90 seconds ago (less than 120s)
      };
      mockStorageAdapter.incr.mockResolvedValue(1);
      mockStorageAdapter.ttl.mockResolvedValue(3600);
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockVerificationTokenRepository.findOne.mockResolvedValue(recentToken as any);

      try {
        await service.sendVerificationSMS('user-sub-123');
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error.code).toBe(AuthErrorCode.RATE_LIMIT_RESEND);
      }
    });
  });

  // ============================================================================
  // verifyPhoneWithCode
  // ============================================================================

  describe('verifyPhoneWithCode', () => {
    it('should verify phone with valid code', async () => {
      mockVerificationTokenRepository.find.mockResolvedValue([mockVerificationToken] as any);
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockVerificationTokenRepository.save.mockResolvedValue(mockVerificationToken as any);

      const result = await service.verifyPhoneWithCode('+1234567890', '123456');

      expect(result.message).toBe('Phone verified successfully. Please log in to continue.');
      expect(mockUserRepository.update).toHaveBeenCalledWith(123, {
        isPhoneVerified: true,
        isActive: true,
      });
      expect(mockAuditService.recordEvent).toHaveBeenCalled();
    });

    it('should throw NAuthException for invalid code', async () => {
      mockVerificationTokenRepository.find.mockResolvedValue([]); // No matching tokens

      try {
        await service.verifyPhoneWithCode('+1234567890', 'wrong-code');
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
        expect(error.code).toBe(AuthErrorCode.VERIFICATION_CODE_INVALID);
      }
    });

    it('should throw NAuthException when no matching user phone', async () => {
      const tokenForDifferentUser = {
        ...mockVerificationToken,
        userId: 999,
      };
      const differentUser = {
        ...mockUser,
        id: 999,
        phone: '+9999999999', // Different phone
      };
      mockVerificationTokenRepository.find.mockResolvedValue([tokenForDifferentUser] as any);
      mockUserRepository.findOne.mockResolvedValue(differentUser as any);

      try {
        await service.verifyPhoneWithCode('+1234567890', '123456');
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
        expect(error.code).toBe(AuthErrorCode.VERIFICATION_CODE_INVALID);
      }
    });

    it('should throw NAuthException for expired code', async () => {
      const expiredToken = {
        ...mockVerificationToken,
        expiresAt: new Date(Date.now() - 1000),
        isExpired: jest.fn().mockReturnValue(true),
      };
      mockVerificationTokenRepository.find.mockResolvedValue([expiredToken] as any);
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);

      try {
        await service.verifyPhoneWithCode('+1234567890', '123456');
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
        expect(error.code).toBe(AuthErrorCode.VERIFICATION_CODE_EXPIRED);
      }
    });

    it('should throw NAuthException after max attempts', async () => {
      const exhaustedToken = {
        ...mockVerificationToken,
        attempts: 3,
        isExpired: jest.fn().mockReturnValue(false),
        maxAttemptsExceeded: jest.fn().mockReturnValue(true),
      };
      mockVerificationTokenRepository.find.mockResolvedValue([exhaustedToken] as any);
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);

      try {
        await service.verifyPhoneWithCode('+1234567890', '123456');
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
        expect(error.code).toBe(AuthErrorCode.VERIFICATION_TOO_MANY_ATTEMPTS);
      }
    });

    it('should increment attempts on invalid code', async () => {
      const tokenWithWrongCode = {
        ...mockVerificationToken,
        code: '999999', // Different code
        attempts: 0,
      };
      mockVerificationTokenRepository.find.mockResolvedValue([tokenWithWrongCode] as any);
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockVerificationTokenRepository.save.mockResolvedValue(tokenWithWrongCode as any);

      try {
        await service.verifyPhoneWithCode('+1234567890', '123456');
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error.code).toBe(AuthErrorCode.VERIFICATION_CODE_INVALID);
        expect(mockVerificationTokenRepository.save).toHaveBeenCalledWith(
          (expect as any).objectContaining({
            attempts: 1, // Incremented
          }),
        );
        expect(mockAuditService.recordEvent).toHaveBeenCalledWith(
          (expect as any).objectContaining({
            eventType: (expect as any).any(String),
            eventStatus: 'FAILURE',
          }),
        );
      }
    });

    it('should handle multiple tokens with same code and select correct user', async () => {
      const token1 = {
        ...mockVerificationToken,
        userId: 123,
        code: '123456',
      };
      const token2 = {
        ...mockVerificationToken,
        userId: 456,
        code: '123456',
      };
      const user2 = {
        ...mockUser,
        id: 456,
        phone: '+9876543210',
      };
      mockVerificationTokenRepository.find.mockResolvedValue([token1, token2] as any);
      mockUserRepository.findOne
        .mockResolvedValueOnce(mockUser as any) // First call for user 123
        .mockResolvedValueOnce(user2 as any); // Second call for user 456

      const result = await service.verifyPhoneWithCode('+1234567890', '123456');

      // Should match token1 (user 123) because phone matches
      expect(result.message).toBeDefined();
      expect(mockUserRepository.update).toHaveBeenCalledWith(123, (expect as any).any(Object));
    });

    it('should handle audit service errors gracefully', async () => {
      mockVerificationTokenRepository.find.mockResolvedValue([mockVerificationToken] as any);
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockVerificationTokenRepository.save.mockResolvedValue(mockVerificationToken as any);
      mockAuditService.recordEvent.mockRejectedValue(new Error('Audit error'));

      const result = await service.verifyPhoneWithCode('+1234567890', '123456');

      expect(mockLogger.error).toHaveBeenCalled();
      expect(result.message).toBeDefined(); // Should still verify
    });

    it('should check expiration using isExpired method if available', async () => {
      const tokenWithMethod = {
        ...mockVerificationToken,
        isExpired: jest.fn().mockReturnValue(true),
      };
      mockVerificationTokenRepository.find.mockResolvedValue([tokenWithMethod] as any);
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);

      try {
        await service.verifyPhoneWithCode('+1234567890', '123456');
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error.code).toBe(AuthErrorCode.VERIFICATION_CODE_EXPIRED);
        expect(tokenWithMethod.isExpired).toHaveBeenCalled();
      }
    });

    it('should check expiration using expiresAt date if method not available', async () => {
      const tokenWithoutMethod = {
        ...mockVerificationToken,
        expiresAt: new Date(Date.now() - 1000), // Expired
        isExpired: undefined,
      };
      mockVerificationTokenRepository.find.mockResolvedValue([tokenWithoutMethod] as any);
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);

      try {
        await service.verifyPhoneWithCode('+1234567890', '123456');
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error.code).toBe(AuthErrorCode.VERIFICATION_CODE_EXPIRED);
      }
    });

    it('should check max attempts using method if available', async () => {
      const tokenWithMethod = {
        ...mockVerificationToken,
        maxAttemptsExceeded: jest.fn().mockReturnValue(true),
      };
      mockVerificationTokenRepository.find.mockResolvedValue([tokenWithMethod] as any);
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);

      try {
        await service.verifyPhoneWithCode('+1234567890', '123456');
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error.code).toBe(AuthErrorCode.VERIFICATION_TOO_MANY_ATTEMPTS);
        expect(tokenWithMethod.maxAttemptsExceeded).toHaveBeenCalledWith(3);
      }
    });

    it('should check max attempts using attempts field if method not available', async () => {
      const tokenWithoutMethod = {
        ...mockVerificationToken,
        attempts: 3,
        maxAttemptsExceeded: undefined,
      };
      mockVerificationTokenRepository.find.mockResolvedValue([tokenWithoutMethod] as any);
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);

      try {
        await service.verifyPhoneWithCode('+1234567890', '123456');
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error.code).toBe(AuthErrorCode.VERIFICATION_TOO_MANY_ATTEMPTS);
      }
    });
  });

  // ============================================================================
  // verifyPhoneWithCodeBySub
  // ============================================================================

  describe('verifyPhoneWithCodeBySub', () => {
    it('should verify phone with valid code by sub', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockVerificationTokenRepository.findOne.mockResolvedValue(mockVerificationToken as any);
      mockVerificationTokenRepository.save.mockResolvedValue(mockVerificationToken as any);

      const result = await service.verifyPhoneWithCodeBySub('user-sub-123', '123456');

      expect(result.message).toBe('Phone verified successfully. Please log in to continue.');
      expect(mockUserRepository.update).toHaveBeenCalledWith({ sub: 'user-sub-123' } as any, {
        isPhoneVerified: true,
        isActive: true,
      });
      expect(mockAuditService.recordEvent).toHaveBeenCalled();
    });

    it('should throw NAuthException if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      try {
        await service.verifyPhoneWithCodeBySub('invalid-sub', '123456');
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
        expect(error.code).toBe(AuthErrorCode.NOT_FOUND);
      }
    });

    it('should throw NAuthException if phone not provided', async () => {
      const userWithoutPhone = { ...mockUser, phone: null };
      mockUserRepository.findOne.mockResolvedValue(userWithoutPhone as any);

      try {
        await service.verifyPhoneWithCodeBySub('user-sub-123', '123456');
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
        expect(error.code).toBe(AuthErrorCode.PHONE_REQUIRED);
      }
    });

    it('should throw NAuthException for invalid code', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockVerificationTokenRepository.findOne.mockResolvedValue(null);

      try {
        await service.verifyPhoneWithCodeBySub('user-sub-123', 'wrong-code');
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
        expect(error.code).toBe(AuthErrorCode.VERIFICATION_CODE_INVALID);
      }
    });

    it('should throw NAuthException for expired code', async () => {
      const expiredToken = {
        ...mockVerificationToken,
        expiresAt: new Date(Date.now() - 1000),
        isExpired: jest.fn().mockReturnValue(true),
      };
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockVerificationTokenRepository.findOne.mockResolvedValue(expiredToken as any);

      try {
        await service.verifyPhoneWithCodeBySub('user-sub-123', '123456');
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
        expect(error.code).toBe(AuthErrorCode.VERIFICATION_CODE_EXPIRED);
      }
    });

    it('should throw NAuthException after max attempts', async () => {
      const exhaustedToken = {
        ...mockVerificationToken,
        attempts: 3,
        isExpired: jest.fn().mockReturnValue(false),
        maxAttemptsExceeded: jest.fn().mockReturnValue(true),
      };
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockVerificationTokenRepository.findOne.mockResolvedValue(exhaustedToken as any);

      try {
        await service.verifyPhoneWithCodeBySub('user-sub-123', '123456');
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
        expect(error.code).toBe(AuthErrorCode.VERIFICATION_TOO_MANY_ATTEMPTS);
      }
    });

    it('should increment attempts on invalid code', async () => {
      const tokenWithWrongCode = {
        ...mockVerificationToken,
        code: '999999', // Different code
        attempts: 0,
      };
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockVerificationTokenRepository.findOne.mockResolvedValue(tokenWithWrongCode as any);
      mockVerificationTokenRepository.save.mockResolvedValue(tokenWithWrongCode as any);

      try {
        await service.verifyPhoneWithCodeBySub('user-sub-123', '123456');
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error.code).toBe(AuthErrorCode.VERIFICATION_CODE_INVALID);
        expect(mockVerificationTokenRepository.save).toHaveBeenCalledWith(
          (expect as any).objectContaining({
            attempts: 1, // Incremented
          }),
        );
        expect(mockAuditService.recordEvent).toHaveBeenCalledWith(
          (expect as any).objectContaining({
            eventType: (expect as any).any(String),
            eventStatus: 'FAILURE',
          }),
        );
      }
    });

    it('should handle audit service errors gracefully', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockVerificationTokenRepository.findOne.mockResolvedValue(mockVerificationToken as any);
      mockVerificationTokenRepository.save.mockResolvedValue(mockVerificationToken as any);
      mockAuditService.recordEvent.mockRejectedValue(new Error('Audit error'));

      const result = await service.verifyPhoneWithCodeBySub('user-sub-123', '123456');

      expect(mockLogger.error).toHaveBeenCalled();
      expect(result.message).toBeDefined(); // Should still verify
    });

    it('should check expiration using isExpired method if available', async () => {
      const tokenWithMethod = {
        ...mockVerificationToken,
        isExpired: jest.fn().mockReturnValue(true),
      };
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockVerificationTokenRepository.findOne.mockResolvedValue(tokenWithMethod as any);

      try {
        await service.verifyPhoneWithCodeBySub('user-sub-123', '123456');
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error.code).toBe(AuthErrorCode.VERIFICATION_CODE_EXPIRED);
        expect(tokenWithMethod.isExpired).toHaveBeenCalled();
      }
    });

    it('should check expiration using expiresAt date if method not available', async () => {
      const tokenWithoutMethod = {
        ...mockVerificationToken,
        expiresAt: new Date(Date.now() - 1000), // Expired
        isExpired: undefined,
      };
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockVerificationTokenRepository.findOne.mockResolvedValue(tokenWithoutMethod as any);

      try {
        await service.verifyPhoneWithCodeBySub('user-sub-123', '123456');
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error.code).toBe(AuthErrorCode.VERIFICATION_CODE_EXPIRED);
      }
    });

    it('should check max attempts using method if available', async () => {
      const tokenWithMethod = {
        ...mockVerificationToken,
        maxAttemptsExceeded: jest.fn().mockReturnValue(true),
      };
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockVerificationTokenRepository.findOne.mockResolvedValue(tokenWithMethod as any);

      try {
        await service.verifyPhoneWithCodeBySub('user-sub-123', '123456');
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error.code).toBe(AuthErrorCode.VERIFICATION_TOO_MANY_ATTEMPTS);
        expect(tokenWithMethod.maxAttemptsExceeded).toHaveBeenCalledWith(3);
      }
    });

    it('should check max attempts using attempts field if method not available', async () => {
      const tokenWithoutMethod = {
        ...mockVerificationToken,
        attempts: 3,
        maxAttemptsExceeded: undefined,
      };
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockVerificationTokenRepository.findOne.mockResolvedValue(tokenWithoutMethod as any);

      try {
        await service.verifyPhoneWithCodeBySub('user-sub-123', '123456');
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error.code).toBe(AuthErrorCode.VERIFICATION_TOO_MANY_ATTEMPTS);
      }
    });
  });

  // ============================================================================
  // resendVerificationSMS
  // ============================================================================

  describe('resendVerificationSMS', () => {
    it('should resend verification SMS successfully', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockVerificationTokenRepository.findOne.mockResolvedValue(null); // No last token
      mockStorageAdapter.incr.mockResolvedValue(1);
      mockStorageAdapter.ttl.mockResolvedValue(3600);
      mockVerificationTokenRepository.create.mockReturnValue(mockVerificationToken as any);
      mockVerificationTokenRepository.save.mockResolvedValue(mockVerificationToken as any);

      const result = await service.resendVerificationSMS('user-sub-123');

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { sub: 'user-sub-123' } as any });
      expect(mockSmsProvider.sendOTP).toHaveBeenCalled();
      expect(result).toBe(456);
    });

    it('should enforce resend delay', async () => {
      const recentToken = {
        ...mockVerificationToken,
        createdAt: new Date(Date.now() - 30 * 1000), // 30 seconds ago
      };
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockVerificationTokenRepository.findOne.mockResolvedValue(recentToken as any);

      try {
        await service.resendVerificationSMS('user-sub-123');
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
        expect(error.code).toBe(AuthErrorCode.RATE_LIMIT_RESEND);
      }
    });

    it('should allow resend after delay period', async () => {
      const oldToken = {
        ...mockVerificationToken,
        createdAt: new Date(Date.now() - 70 * 1000), // 70 seconds ago
      };
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockVerificationTokenRepository.findOne.mockResolvedValue(oldToken as any);
      mockStorageAdapter.incr.mockResolvedValue(1);
      mockStorageAdapter.ttl.mockResolvedValue(3600);
      mockVerificationTokenRepository.create.mockReturnValue(mockVerificationToken as any);
      mockVerificationTokenRepository.save.mockResolvedValue(mockVerificationToken as any);

      await service.resendVerificationSMS('user-sub-123');

      expect(mockSmsProvider.sendOTP).toHaveBeenCalled();
    });

    it('should throw NAuthException if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      try {
        await service.resendVerificationSMS('invalid-sub');
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
        expect(error.code).toBe(AuthErrorCode.NOT_FOUND);
      }
    });

    it('should delegate to sendVerificationSMS', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockVerificationTokenRepository.findOne.mockResolvedValue(null);
      mockStorageAdapter.incr.mockResolvedValue(1);
      mockStorageAdapter.ttl.mockResolvedValue(3600);
      mockVerificationTokenRepository.create.mockReturnValue(mockVerificationToken as any);
      mockVerificationTokenRepository.save.mockResolvedValue(mockVerificationToken as any);

      await service.resendVerificationSMS('user-sub-123');

      // Should call sendVerificationSMS with same parameters
      expect(mockSmsProvider.sendOTP).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // resendVerificationSMSForPhone
  // ============================================================================

  describe('resendVerificationSMSForPhone', () => {
    it('should resend verification SMS by phone number', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockVerificationTokenRepository.findOne.mockResolvedValue(null);
      mockStorageAdapter.incr.mockResolvedValue(1);
      mockStorageAdapter.ttl.mockResolvedValue(3600);
      mockVerificationTokenRepository.create.mockReturnValue(mockVerificationToken as any);
      mockVerificationTokenRepository.save.mockResolvedValue(mockVerificationToken as any);

      const result = await service.resendVerificationSMSForPhone('+1234567890');

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { phone: '+1234567890' } as any });
      expect(mockSmsProvider.sendOTP).toHaveBeenCalled();
      expect(result).toBe(456);
    });

    it('should throw NAuthException if user not found by phone', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      try {
        await service.resendVerificationSMSForPhone('+9999999999');
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
        expect(error.code).toBe(AuthErrorCode.NOT_FOUND);
      }
    });

    it('should throw NAuthException if phone already verified', async () => {
      const verifiedUser = { ...mockUser, isPhoneVerified: true };
      mockUserRepository.findOne.mockResolvedValue(verifiedUser as any);

      try {
        await service.resendVerificationSMSForPhone('+1234567890');
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
        expect(error.code).toBe(AuthErrorCode.ALREADY_VERIFIED);
      }
    });

    it('should delegate to resendVerificationSMS with user sub', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockVerificationTokenRepository.findOne.mockResolvedValue(null);
      mockStorageAdapter.incr.mockResolvedValue(1);
      mockStorageAdapter.ttl.mockResolvedValue(3600);
      mockVerificationTokenRepository.create.mockReturnValue(mockVerificationToken as any);
      mockVerificationTokenRepository.save.mockResolvedValue(mockVerificationToken as any);

      await service.resendVerificationSMSForPhone('+1234567890');

      // Should find user by phone, then use their sub to resend
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { phone: '+1234567890' } as any });
      expect(mockSmsProvider.sendOTP).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Service Without Optional Dependencies
  // ============================================================================

  describe('Service without optional dependencies', () => {
    it('should work without audit service', async () => {
      const serviceWithoutAudit = new PhoneVerificationService(
        mockVerificationTokenRepository,
        mockUserRepository,
        mockSmsProvider,
        mockStorageAdapter,
        mockConfig,
        mockClientInfoService,
        mockLogger,
        undefined, // No audit service
      );

      mockStorageAdapter.incr.mockResolvedValue(1);
      mockStorageAdapter.ttl.mockResolvedValue(3600);
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockVerificationTokenRepository.findOne.mockResolvedValue(null);
      mockVerificationTokenRepository.create.mockReturnValue(mockVerificationToken as any);
      mockVerificationTokenRepository.save.mockResolvedValue(mockVerificationToken as any);

      await serviceWithoutAudit.sendVerificationSMS('user-sub-123');

      // Should not throw error
      expect(mockSmsProvider.sendOTP).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle TTL of -1 (key does not exist)', async () => {
      mockStorageAdapter.ttl.mockResolvedValue(-1); // Key does not exist
      mockStorageAdapter.incr.mockResolvedValue(1);
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockVerificationTokenRepository.findOne.mockResolvedValue(null);
      mockVerificationTokenRepository.create.mockReturnValue(mockVerificationToken as any);
      mockVerificationTokenRepository.save.mockResolvedValue(mockVerificationToken as any);

      await service.sendVerificationSMS('user-sub-123');

      // Should create new window
      expect(mockStorageAdapter.incr).toHaveBeenCalled();
    });

    it('should handle TTL of 0 (key expired)', async () => {
      mockStorageAdapter.ttl.mockResolvedValue(0); // Key expired
      mockStorageAdapter.incr.mockResolvedValue(1);
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockVerificationTokenRepository.findOne.mockResolvedValue(null);
      mockVerificationTokenRepository.create.mockReturnValue(mockVerificationToken as any);
      mockVerificationTokenRepository.save.mockResolvedValue(mockVerificationToken as any);

      await service.sendVerificationSMS('user-sub-123');

      // Should create new window (when TTL is 0, window is expired, so TTL parameter is passed)
      expect(mockStorageAdapter.incr).toHaveBeenCalled();
    });

    it('should handle negative TTL (key expired)', async () => {
      mockStorageAdapter.ttl.mockResolvedValue(-10); // Negative TTL (expired)
      mockStorageAdapter.incr.mockResolvedValue(1);
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockVerificationTokenRepository.findOne.mockResolvedValue(null);
      mockVerificationTokenRepository.create.mockReturnValue(mockVerificationToken as any);
      mockVerificationTokenRepository.save.mockResolvedValue(mockVerificationToken as any);

      await service.sendVerificationSMS('user-sub-123');

      // Should create new window
      expect(mockStorageAdapter.incr).toHaveBeenCalled();
    });

    it('should handle missing config phone verification settings', async () => {
      mockConfig.phone = undefined;
      service = new PhoneVerificationService(
        mockVerificationTokenRepository,
        mockUserRepository,
        mockSmsProvider,
        mockStorageAdapter,
        mockConfig,
        mockClientInfoService,
        mockLogger,
        mockAuditService,
      );

      mockStorageAdapter.incr.mockResolvedValue(1);
      mockStorageAdapter.ttl.mockResolvedValue(-1);
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockVerificationTokenRepository.findOne.mockResolvedValue(null);
      mockVerificationTokenRepository.create.mockReturnValue(mockVerificationToken as any);
      mockVerificationTokenRepository.save.mockResolvedValue(mockVerificationToken as any);

      // Should use defaults (rateLimitMax: 3, rateLimitWindow: 3600, resendDelay: 60, expiresIn: 300, maxAttempts: 3)
      await service.sendVerificationSMS('user-sub-123');

      expect(mockSmsProvider.sendOTP).toHaveBeenCalled();
    });
  });
});
