import { Repository } from 'typeorm';
import { PhoneVerificationService } from './phone-verification.service';
import { NAuthException } from '../exceptions/nauth.exception';
import { ClientInfoService } from './client-info.service';
import { SMSProvider } from '../interfaces/provider.interface';
import { StorageAdapter } from '../interfaces/storage-adapter.interface';
import { NAuthConfig } from '../interfaces/config.interface';
import { NAuthLogger } from '../utils/nauth-logger';
import { InternalAuthAuditService as AuthAuditService } from './auth-audit.service';
import { BaseVerificationToken, BaseUser, BaseMFADevice } from '../entities';
import { AuthAuditEventType } from '../enums/auth-audit-event-type.enum';
import { IUser, IVerificationToken } from '../interfaces/entities.interface';
import { AuthErrorCode } from '../enums/error-codes.enum';
import {
  SendVerificationSMSDTO,
  SetPhoneAndSendVerificationDTO,
  VerifyPhoneWithCodeDTO,
  ResendVerificationSMSDTO,
} from '../dto/verify-phone.dto';
import { VerifyPhoneWithCodeBySubDTO } from '../dto/verify-phone-by-sub.dto';

// ============================================================================
// Test Constants
// ============================================================================
// Use valid UUID v4 values to satisfy DTO validation (service now enforces ensureValidatedDto()).
const TEST_USER_SUB = 'a21b654c-2746-4168-acee-c175083a65cd';
const TEST_OTHER_SUB = 'b21b654c-2746-4168-acee-c175083a65cd';

// Helper to create DTOs from plain objects
function createSendVerificationSMSDto(data: Partial<SendVerificationSMSDTO>): SendVerificationSMSDTO {
  const sub = data.sub === 'user-sub-123' ? TEST_USER_SUB : data.sub === 'invalid-sub' ? TEST_OTHER_SUB : data.sub;
  return Object.assign(new SendVerificationSMSDTO(), { ...data, sub });
}

function createVerifyPhoneWithCodeDto(data: Partial<VerifyPhoneWithCodeDTO>): VerifyPhoneWithCodeDTO {
  return Object.assign(new VerifyPhoneWithCodeDTO(), data);
}

function createResendVerificationSMSDto(data: Partial<ResendVerificationSMSDTO>): ResendVerificationSMSDTO {
  const sub = data.sub === 'user-sub-123' ? TEST_USER_SUB : data.sub === 'invalid-sub' ? TEST_OTHER_SUB : data.sub;
  return Object.assign(new ResendVerificationSMSDTO(), { ...data, sub });
}

function createVerifyPhoneWithCodeBySubDto(data: Partial<VerifyPhoneWithCodeBySubDTO>): VerifyPhoneWithCodeBySubDTO {
  const sub = data.sub === 'user-sub-123' ? TEST_USER_SUB : data.sub === 'invalid-sub' ? TEST_OTHER_SUB : data.sub;
  return Object.assign(new VerifyPhoneWithCodeBySubDTO(), { ...data, sub });
}

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
  let mockHookRegistry: {
    executeUserProfileUpdated: jest.Mock;
    executeOnboardingCompleted: jest.Mock;
    executePhoneChanged: jest.Mock;
    executeMFADeviceRemoved: jest.Mock;
  };
  let mockConfig: NAuthConfig;

  const mockUser: IUser = {
    id: 123,
    sub: TEST_USER_SUB,
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

    mockHookRegistry = {
      executeUserProfileUpdated: jest.fn().mockResolvedValue(undefined),
      executeOnboardingCompleted: jest.fn().mockResolvedValue(undefined),
      executePhoneChanged: jest.fn().mockResolvedValue(undefined),
      executeMFADeviceRemoved: jest.fn().mockResolvedValue(undefined),
    };

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
      mockHookRegistry as any, // hookRegistry (mock)
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

      const result = await service.sendVerificationSMS(createSendVerificationSMSDto({ sub: 'user-sub-123' }));

      expect(mockStorageAdapter.incr).toHaveBeenCalled();
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { sub: TEST_USER_SUB } as any });
      expect(mockVerificationTokenRepository.save).toHaveBeenCalled();
      expect(mockSmsProvider.sendOTP).toHaveBeenCalledWith(
        '+1234567890',
        (expect as any).any(String),
        (expect as any).any(String),
        (expect as any).any(Object),
      );
      expect(mockAuditService.recordEvent).toHaveBeenCalled();
      expect(result).toEqual({ tokenId: 456 });
    });

    it('should throw NAuthException if user not found', async () => {
      mockStorageAdapter.incr.mockResolvedValue(1);
      mockStorageAdapter.ttl.mockResolvedValue(3600);
      mockUserRepository.findOne.mockResolvedValue(null);

      try {
        await service.sendVerificationSMS(createSendVerificationSMSDto({ sub: 'invalid-sub' }));
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
        await service.sendVerificationSMS(createSendVerificationSMSDto({ sub: 'user-sub-123' }));
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
        await service.sendVerificationSMS(
          createSendVerificationSMSDto({ sub: 'user-sub-123', skipAlreadyVerifiedCheck: false }),
        );
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

      await service.sendVerificationSMS(
        createSendVerificationSMSDto({ sub: 'user-sub-123', skipAlreadyVerifiedCheck: true }),
      );

      expect(mockSmsProvider.sendOTP).toHaveBeenCalled();
    });

    it('should enforce rate limit (too many SMS)', async () => {
      mockStorageAdapter.incr.mockResolvedValue(4); // Exceeds limit of 3
      mockStorageAdapter.ttl.mockResolvedValue(3600);

      try {
        await service.sendVerificationSMS(createSendVerificationSMSDto({ sub: 'user-sub-123' }));
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
        await service.sendVerificationSMS(createSendVerificationSMSDto({ sub: 'user-sub-123' }));
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

      await service.sendVerificationSMS(createSendVerificationSMSDto({ sub: 'user-sub-123' }));

      expect(mockSmsProvider.sendOTP).toHaveBeenCalled();
    });

    it('should invalidate existing unused tokens', async () => {
      mockStorageAdapter.incr.mockResolvedValue(1);
      mockStorageAdapter.ttl.mockResolvedValue(3600);
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockVerificationTokenRepository.findOne.mockResolvedValue(null);
      mockVerificationTokenRepository.create.mockReturnValue(mockVerificationToken as any);
      mockVerificationTokenRepository.save.mockResolvedValue(mockVerificationToken as any);

      await service.sendVerificationSMS(createSendVerificationSMSDto({ sub: 'user-sub-123' }));

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

      await service.sendVerificationSMS(createSendVerificationSMSDto({ sub: 'user-sub-123' }));

      expect(mockStorageAdapter.del).toHaveBeenCalledWith(`phone-verification:${TEST_USER_SUB}`);
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
        await service.sendVerificationSMS(createSendVerificationSMSDto({ sub: 'user-sub-123' }));
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

      await service.sendVerificationSMS(createSendVerificationSMSDto({ sub: 'user-sub-123' }));

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
        mockHookRegistry as any, // hookRegistry (mock)
        mockAuditService,
      );

      mockStorageAdapter.incr.mockResolvedValue(6); // Exceeds new limit of 5
      mockStorageAdapter.ttl.mockResolvedValue(1800);

      try {
        await service.sendVerificationSMS(createSendVerificationSMSDto({ sub: 'user-sub-123' }));
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
        mockHookRegistry as any, // hookRegistry (mock)
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
        await service.sendVerificationSMS(createSendVerificationSMSDto({ sub: 'user-sub-123' }));
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error.code).toBe(AuthErrorCode.RATE_LIMIT_RESEND);
      }
    });
  });

  // ============================================================================
  // setPhoneAndSendVerification
  // ============================================================================

  describe('setPhoneAndSendVerification', () => {
    function createSetPhoneDto(data: Partial<SetPhoneAndSendVerificationDTO>): SetPhoneAndSendVerificationDTO {
      const sub = data.sub === 'user-sub-123' ? TEST_USER_SUB : data.sub === 'invalid-sub' ? TEST_OTHER_SUB : data.sub;
      return Object.assign(new SetPhoneAndSendVerificationDTO(), { ...data, sub });
    }

    beforeEach(() => {
      jest.spyOn(service, 'sendVerificationSMS').mockResolvedValue({ tokenId: 999 });
    });

    it('should throw INVALID_PHONE_FORMAT for a malformed phone number', async () => {
      try {
        await service.setPhoneAndSendVerification(createSetPhoneDto({ sub: 'user-sub-123', phone: 'not-a-phone' }));
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
        expect(error.code).toBe(AuthErrorCode.INVALID_PHONE_FORMAT);
      }
      expect(mockUserRepository.findOne).not.toHaveBeenCalled();
    });

    it('should throw NOT_FOUND when the user does not exist', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      try {
        await service.setPhoneAndSendVerification(createSetPhoneDto({ sub: 'invalid-sub', phone: '+19998887777' }));
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
        expect(error.code).toBe(AuthErrorCode.NOT_FOUND);
      }
    });

    it('should throw PHONE_EXISTS when the new number belongs to another user and duplicates are not allowed', async () => {
      mockConfig.signup!.allowDuplicatePhones = false;
      mockUserRepository.findOne
        .mockResolvedValueOnce(mockUser as any) // sub lookup
        .mockResolvedValueOnce({ ...mockUser, id: 999, sub: TEST_OTHER_SUB } as any); // phone lookup (different user)

      try {
        await service.setPhoneAndSendVerification(createSetPhoneDto({ sub: 'user-sub-123', phone: '+19998887777' }));
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
        expect(error.code).toBe(AuthErrorCode.PHONE_EXISTS);
      }
      expect(mockUserRepository.update).not.toHaveBeenCalled();
    });

    it('should allow a duplicate number when signup.allowDuplicatePhones is true', async () => {
      mockConfig.signup!.allowDuplicatePhones = true;
      mockUserRepository.findOne.mockResolvedValueOnce(mockUser as any);

      const result = await service.setPhoneAndSendVerification(
        createSetPhoneDto({ sub: 'user-sub-123', phone: '+19998887777' }),
      );

      expect(mockUserRepository.update).toHaveBeenCalledWith(
        { sub: TEST_USER_SUB },
        { phone: '+19998887777', isPhoneVerified: false },
      );
      expect(result.phoneChanged).toBe(true);
    });

    it('should not update the user or report a change when the number is unchanged', async () => {
      mockUserRepository.findOne.mockResolvedValueOnce(mockUser as any); // phone already +1234567890

      const result = await service.setPhoneAndSendVerification(
        createSetPhoneDto({ sub: 'user-sub-123', phone: '+1234567890' }),
      );

      expect(mockUserRepository.update).not.toHaveBeenCalled();
      expect(mockHookRegistry.executeUserProfileUpdated).not.toHaveBeenCalled();
      expect(service.sendVerificationSMS).toHaveBeenCalled();
      expect(result).toEqual({ tokenId: 999, phoneChanged: false });
    });

    it('should update the phone, reset verification, and fire hooks when the number changes', async () => {
      const verifiedUser = { ...mockUser, isPhoneVerified: true, phone: '+1234567890' };
      mockUserRepository.findOne.mockResolvedValueOnce(verifiedUser as any);

      const result = await service.setPhoneAndSendVerification(
        createSetPhoneDto({ sub: 'user-sub-123', phone: '+19998887777' }),
      );

      expect(mockUserRepository.update).toHaveBeenCalledWith(
        { sub: TEST_USER_SUB },
        { phone: '+19998887777', isPhoneVerified: false },
      );
      expect(mockHookRegistry.executeUserProfileUpdated).toHaveBeenCalledWith(
        expect.objectContaining({
          changedFields: [
            { fieldName: 'phone', oldValue: '+1234567890', newValue: '+19998887777' },
            { fieldName: 'isPhoneVerified', oldValue: true, newValue: false },
          ],
        }),
      );
      expect(mockHookRegistry.executePhoneChanged).toHaveBeenCalledWith(
        expect.objectContaining({ oldPhone: '+1234567890', newPhone: '+19998887777' }),
      );
      expect(result.phoneChanged).toBe(true);
    });

    it('should only report the phone field when the old phone was not verified', async () => {
      mockUserRepository.findOne.mockResolvedValueOnce({ ...mockUser, isPhoneVerified: false } as any);

      await service.setPhoneAndSendVerification(createSetPhoneDto({ sub: 'user-sub-123', phone: '+19998887777' }));

      expect(mockHookRegistry.executeUserProfileUpdated).toHaveBeenCalledWith(
        expect.objectContaining({
          changedFields: [{ fieldName: 'phone', oldValue: '+1234567890', newValue: '+19998887777' }],
        }),
      );
    });

    it('should not fire executePhoneChanged when the account had no previous phone', async () => {
      mockUserRepository.findOne.mockResolvedValueOnce({ ...mockUser, phone: null } as any);

      await service.setPhoneAndSendVerification(createSetPhoneDto({ sub: 'user-sub-123', phone: '+19998887777' }));

      expect(mockHookRegistry.executeUserProfileUpdated).toHaveBeenCalled();
      expect(mockHookRegistry.executePhoneChanged).not.toHaveBeenCalled();
    });

    it('should forward challengeSessionId into the verification send', async () => {
      mockUserRepository.findOne.mockResolvedValueOnce(mockUser as any);

      await service.setPhoneAndSendVerification(
        createSetPhoneDto({ sub: 'user-sub-123', phone: '+1234567890', challengeSessionId: 42 }),
      );

      expect(service.sendVerificationSMS).toHaveBeenCalledWith(
        expect.objectContaining({ sub: TEST_USER_SUB, skipAlreadyVerifiedCheck: false, challengeSessionId: 42 }),
      );
    });

    it('should not block the request when hooks fail', async () => {
      mockUserRepository.findOne.mockResolvedValueOnce(mockUser as any);
      mockHookRegistry.executeUserProfileUpdated.mockRejectedValueOnce(new Error('hook boom'));

      const result = await service.setPhoneAndSendVerification(
        createSetPhoneDto({ sub: 'user-sub-123', phone: '+19998887777' }),
      );

      expect(result.phoneChanged).toBe(true);
      expect(service.sendVerificationSMS).toHaveBeenCalled();
    });

    // ------------------------------------------------------------------------
    // SMS MFA device retirement on phone change
    // ------------------------------------------------------------------------
    describe('SMS MFA device retirement', () => {
      let mockMfaDeviceRepository: { find: jest.Mock; delete: jest.Mock };
      let retiringService: PhoneVerificationService;
      let callOrder: string[];

      const smsDevices = [{ id: 11 }, { id: 12 }];

      beforeEach(() => {
        callOrder = [];
        mockMfaDeviceRepository = {
          find: jest.fn(),
          delete: jest.fn().mockImplementation(async (id: number) => {
            callOrder.push(`delete:${id}`);
            return { affected: 1 };
          }),
        };
        mockHookRegistry.executePhoneChanged.mockImplementation(async () => {
          callOrder.push('executePhoneChanged');
        });

        retiringService = new PhoneVerificationService(
          mockVerificationTokenRepository,
          mockUserRepository,
          mockSmsProvider,
          mockStorageAdapter,
          mockConfig,
          mockClientInfoService,
          mockLogger,
          mockHookRegistry as any,
          mockAuditService,
          mockMfaDeviceRepository as unknown as Repository<BaseMFADevice>,
        );
        jest.spyOn(retiringService, 'sendVerificationSMS').mockResolvedValue({ tokenId: 999 });
      });

      /** Queue the SMS-device lookup and the "remaining active devices" lookup. */
      function queueDeviceLookups(sms: Array<{ id: number }>, remaining: Array<{ id: number }>): void {
        mockMfaDeviceRepository.find.mockResolvedValueOnce(sms).mockResolvedValueOnce(remaining);
      }

      it('should delete active SMS devices, audit the removal, and report counts to the hooks', async () => {
        const mfaUser = { ...mockUser, mfaEnabled: true, mfaMethods: ['sms', 'totp'], preferredMfaMethod: 'sms' };
        mockUserRepository.findOne.mockResolvedValueOnce(mfaUser as any);
        queueDeviceLookups(smsDevices, [{ id: 30 }]); // a TOTP device remains

        await retiringService.setPhoneAndSendVerification(
          createSetPhoneDto({ sub: 'user-sub-123', phone: '+19998887777' }),
        );

        expect(mockMfaDeviceRepository.find).toHaveBeenNthCalledWith(1, {
          where: { userId: 123, type: 'sms', isActive: true },
        });
        expect(mockMfaDeviceRepository.delete).toHaveBeenCalledTimes(2);
        expect(mockMfaDeviceRepository.delete).toHaveBeenCalledWith(11);
        expect(mockMfaDeviceRepository.delete).toHaveBeenCalledWith(12);
        expect(mockAuditService.recordEvent).toHaveBeenCalledWith(
          expect.objectContaining({
            userId: 123,
            eventType: AuthAuditEventType.MFA_DEVICE_REMOVED,
            reason: 'phone_changed',
            metadata: expect.objectContaining({
              method: 'sms',
              deletedCount: 2,
              oldPhone: expect.stringContaining('*'),
              newPhone: expect.stringContaining('*'),
            }),
          }),
        );
        const auditMeta = mockAuditService.recordEvent.mock.calls[0][0].metadata as Record<string, string>;
        expect(auditMeta.oldPhone).not.toContain('+1234567890');
        expect(auditMeta.newPhone).not.toContain('+19998887777');

        expect(mockHookRegistry.executeMFADeviceRemoved).toHaveBeenCalledWith(
          expect.objectContaining({
            deviceType: 'sms',
            removedBy: 'system',
            reason: 'phone_changed',
            remainingDeviceCount: 1,
          }),
        );
        expect(mockHookRegistry.executePhoneChanged).toHaveBeenCalledWith(
          expect.objectContaining({ deactivatedMFADevices: 2, mfaDisabled: false }),
        );
      });

      it('should not fire mfaDeviceRemoved when the user had no SMS devices', async () => {
        mockUserRepository.findOne.mockResolvedValueOnce({ ...mockUser, mfaEnabled: true } as any);
        mockMfaDeviceRepository.find.mockResolvedValueOnce([]);

        await retiringService.setPhoneAndSendVerification(
          createSetPhoneDto({ sub: 'user-sub-123', phone: '+19998887777' }),
        );

        expect(mockMfaDeviceRepository.delete).not.toHaveBeenCalled();
        expect(mockAuditService.recordEvent).not.toHaveBeenCalled();
        expect(mockHookRegistry.executeMFADeviceRemoved).not.toHaveBeenCalled();
        expect(mockUserRepository.update).toHaveBeenCalledTimes(1); // phone update only, MFA untouched
        expect(mockHookRegistry.executePhoneChanged).toHaveBeenCalledWith(
          expect.objectContaining({ deactivatedMFADevices: 0, mfaDisabled: false }),
        );
      });

      it('should disable MFA and report mfaDisabled when no active device remains', async () => {
        mockUserRepository.findOne.mockResolvedValueOnce({
          ...mockUser,
          mfaEnabled: true,
          mfaMethods: ['sms'],
          preferredMfaMethod: 'sms',
        } as any);
        queueDeviceLookups(smsDevices, []);

        await retiringService.setPhoneAndSendVerification(
          createSetPhoneDto({ sub: 'user-sub-123', phone: '+19998887777' }),
        );

        expect(mockUserRepository.update).toHaveBeenCalledWith(
          { id: 123 },
          { mfaEnabled: false, mfaMethods: [], preferredMfaMethod: null },
        );
        expect(mockHookRegistry.executeMFADeviceRemoved).toHaveBeenCalledWith(
          expect.objectContaining({
            remainingDeviceCount: 0,
            user: expect.objectContaining({ mfaEnabled: false, mfaMethods: [], preferredMfaMethod: null }),
          }),
        );
        expect(mockHookRegistry.executeUserProfileUpdated).toHaveBeenCalledWith(
          expect.objectContaining({
            changedFields: expect.arrayContaining([{ fieldName: 'mfaEnabled', oldValue: true, newValue: false }]),
          }),
        );
        expect(mockHookRegistry.executePhoneChanged).toHaveBeenCalledWith(
          expect.objectContaining({ deactivatedMFADevices: 2, mfaDisabled: true }),
        );
      });

      it('should report mfaDisabled false when MFA is cleared for a user that never had it enabled', async () => {
        mockUserRepository.findOne.mockResolvedValueOnce({ ...mockUser, mfaEnabled: false } as any);
        queueDeviceLookups([{ id: 11 }], []);

        await retiringService.setPhoneAndSendVerification(
          createSetPhoneDto({ sub: 'user-sub-123', phone: '+19998887777' }),
        );

        expect(mockUserRepository.update).toHaveBeenCalledWith(
          { id: 123 },
          { mfaEnabled: false, mfaMethods: [], preferredMfaMethod: null },
        );
        expect(mockHookRegistry.executePhoneChanged).toHaveBeenCalledWith(
          expect.objectContaining({ deactivatedMFADevices: 1, mfaDisabled: false }),
        );
        const changedFields = mockHookRegistry.executeUserProfileUpdated.mock.calls[0][0].changedFields as Array<{
          fieldName: string;
        }>;
        expect(changedFields.map((f) => f.fieldName)).not.toContain('mfaEnabled');
      });

      it('should keep MFA enabled when another active device remains', async () => {
        mockUserRepository.findOne.mockResolvedValueOnce({ ...mockUser, mfaEnabled: true } as any);
        queueDeviceLookups([{ id: 11 }], [{ id: 40 }, { id: 41 }]);

        await retiringService.setPhoneAndSendVerification(
          createSetPhoneDto({ sub: 'user-sub-123', phone: '+19998887777' }),
        );

        expect(mockUserRepository.update).toHaveBeenCalledTimes(1); // phone update only
        expect(mockHookRegistry.executeMFADeviceRemoved).toHaveBeenCalledWith(
          expect.objectContaining({ remainingDeviceCount: 2 }),
        );
        expect(mockHookRegistry.executePhoneChanged).toHaveBeenCalledWith(
          expect.objectContaining({ deactivatedMFADevices: 1, mfaDisabled: false }),
        );
        const changedFields = mockHookRegistry.executeUserProfileUpdated.mock.calls[0][0].changedFields as Array<{
          fieldName: string;
        }>;
        expect(changedFields.map((f) => f.fieldName)).not.toContain('mfaEnabled');
      });

      it('should not retire devices when the account had no previous phone', async () => {
        mockUserRepository.findOne.mockResolvedValueOnce({ ...mockUser, phone: null, mfaEnabled: true } as any);

        await retiringService.setPhoneAndSendVerification(
          createSetPhoneDto({ sub: 'user-sub-123', phone: '+19998887777' }),
        );

        expect(mockMfaDeviceRepository.find).not.toHaveBeenCalled();
        expect(mockMfaDeviceRepository.delete).not.toHaveBeenCalled();
        expect(mockHookRegistry.executeMFADeviceRemoved).not.toHaveBeenCalled();
      });

      it('should not retire devices when the phone is unchanged', async () => {
        mockUserRepository.findOne.mockResolvedValueOnce({ ...mockUser, mfaEnabled: true } as any);

        await retiringService.setPhoneAndSendVerification(
          createSetPhoneDto({ sub: 'user-sub-123', phone: '+1234567890' }),
        );

        expect(mockMfaDeviceRepository.find).not.toHaveBeenCalled();
        expect(mockMfaDeviceRepository.delete).not.toHaveBeenCalled();
        expect(mockHookRegistry.executeMFADeviceRemoved).not.toHaveBeenCalled();
      });

      it('should delete devices before executePhoneChanged fires', async () => {
        mockUserRepository.findOne.mockResolvedValueOnce({ ...mockUser, mfaEnabled: true } as any);
        queueDeviceLookups(smsDevices, [{ id: 30 }]);

        await retiringService.setPhoneAndSendVerification(
          createSetPhoneDto({ sub: 'user-sub-123', phone: '+19998887777' }),
        );

        expect(callOrder).toEqual(['delete:11', 'delete:12', 'executePhoneChanged']);
      });

      it('should still fire executePhoneChanged when the mfaDeviceRemoved hook throws', async () => {
        mockUserRepository.findOne.mockResolvedValueOnce({ ...mockUser, mfaEnabled: true } as any);
        queueDeviceLookups([{ id: 11 }], [{ id: 30 }]);
        mockHookRegistry.executeMFADeviceRemoved.mockRejectedValueOnce(new Error('listener boom'));

        const result = await retiringService.setPhoneAndSendVerification(
          createSetPhoneDto({ sub: 'user-sub-123', phone: '+19998887777' }),
        );

        expect(result.phoneChanged).toBe(true);
        expect(mockHookRegistry.executeUserProfileUpdated).toHaveBeenCalled();
        expect(mockHookRegistry.executePhoneChanged).toHaveBeenCalledWith(
          expect.objectContaining({ deactivatedMFADevices: 1 }),
        );
        expect(mockLogger.error).toHaveBeenCalledWith(
          expect.stringContaining('Failed to execute mfaDeviceRemoved hooks'),
          expect.anything(),
        );
      });

      it('should still retire devices when audit recording fails', async () => {
        mockUserRepository.findOne.mockResolvedValueOnce({ ...mockUser, mfaEnabled: true } as any);
        queueDeviceLookups([{ id: 11 }], []);
        mockAuditService.recordEvent.mockRejectedValueOnce(new Error('audit down'));

        const result = await retiringService.setPhoneAndSendVerification(
          createSetPhoneDto({ sub: 'user-sub-123', phone: '+19998887777' }),
        );

        expect(result.phoneChanged).toBe(true);
        expect(mockUserRepository.update).toHaveBeenCalledWith(
          { id: 123 },
          { mfaEnabled: false, mfaMethods: [], preferredMfaMethod: null },
        );
        expect(mockHookRegistry.executePhoneChanged).toHaveBeenCalled();
      });

      it('should fail closed when deleting a device throws', async () => {
        mockUserRepository.findOne.mockResolvedValueOnce({ ...mockUser, mfaEnabled: true } as any);
        mockMfaDeviceRepository.find.mockResolvedValueOnce([{ id: 11 }]);
        mockMfaDeviceRepository.delete.mockRejectedValueOnce(new Error('db down'));

        await expect(
          retiringService.setPhoneAndSendVerification(
            createSetPhoneDto({ sub: 'user-sub-123', phone: '+19998887777' }),
          ),
        ).rejects.toThrow('db down');

        expect(mockHookRegistry.executePhoneChanged).not.toHaveBeenCalled();
        expect(retiringService.sendVerificationSMS).not.toHaveBeenCalled();
      });

      it('should be a no-op without a device repository', async () => {
        mockUserRepository.findOne.mockResolvedValueOnce({ ...mockUser, mfaEnabled: true } as any);

        // `service` is constructed without the optional mfaDeviceRepository argument
        const result = await service.setPhoneAndSendVerification(
          createSetPhoneDto({ sub: 'user-sub-123', phone: '+19998887777' }),
        );

        expect(result.phoneChanged).toBe(true);
        expect(mockUserRepository.update).toHaveBeenCalledTimes(1);
        expect(mockHookRegistry.executeMFADeviceRemoved).not.toHaveBeenCalled();
        expect(mockHookRegistry.executePhoneChanged).toHaveBeenCalledWith(
          expect.objectContaining({ deactivatedMFADevices: 0, mfaDisabled: false }),
        );
      });
    });
  });

  // ============================================================================
  // verifyPhoneWithCode
  // ============================================================================

  describe('verifyPhoneWithCode', () => {
    it('should verify phone with valid code', async () => {
      mockVerificationTokenRepository.find.mockResolvedValue([mockVerificationToken] as any);
      mockConfig.signup!.verificationMethod = 'phone';
      mockUserRepository.findOne
        .mockResolvedValueOnce(mockUser as any) // user lookup by token.userId during matching loop
        .mockResolvedValueOnce({ ...mockUser, isPhoneVerified: true } as any); // refetch after update
      mockVerificationTokenRepository.save.mockResolvedValue(mockVerificationToken as any);

      const result = await service.verifyPhoneWithCode(
        createVerifyPhoneWithCodeDto({ phone: '+1234567890', code: '123456' }),
      );

      expect(result.message).toBe('Phone verified successfully. Please log in to continue.');
      expect(mockUserRepository.update).toHaveBeenCalledWith(123, {
        isPhoneVerified: true,
        isActive: true,
      });
      expect(mockAuditService.recordEvent).toHaveBeenCalled();
      expect(mockHookRegistry.executeOnboardingCompleted).toHaveBeenCalledTimes(1);
      expect(mockHookRegistry.executeOnboardingCompleted).toHaveBeenCalledWith(
        expect.objectContaining({ id: 123, isPhoneVerified: true }),
        expect.objectContaining({
          verificationMethod: 'phone',
          source: 'phone_verification',
          completedAt: expect.any(Date),
        }),
      );
    });

    it('should throw NAuthException for invalid code', async () => {
      mockVerificationTokenRepository.find.mockResolvedValue([]); // No matching tokens

      try {
        await service.verifyPhoneWithCode(createVerifyPhoneWithCodeDto({ phone: '+1234567890', code: 'wrong-code' }));
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
        // Invalid code format is caught at DTO validation level
        expect(error.code).toBe(AuthErrorCode.VALIDATION_FAILED);
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
        await service.verifyPhoneWithCode(createVerifyPhoneWithCodeDto({ phone: '+1234567890', code: '123456' }));
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
        await service.verifyPhoneWithCode(createVerifyPhoneWithCodeDto({ phone: '+1234567890', code: '123456' }));
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
        await service.verifyPhoneWithCode(createVerifyPhoneWithCodeDto({ phone: '+1234567890', code: '123456' }));
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
        await service.verifyPhoneWithCode(createVerifyPhoneWithCodeDto({ phone: '+1234567890', code: '123456' }));
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

      const result = await service.verifyPhoneWithCode(
        createVerifyPhoneWithCodeDto({ phone: '+1234567890', code: '123456' }),
      );

      // Should match token1 (user 123) because phone matches
      expect(result.message).toBeDefined();
      expect(mockUserRepository.update).toHaveBeenCalledWith(123, (expect as any).any(Object));
    });

    it('should handle audit service errors gracefully', async () => {
      mockVerificationTokenRepository.find.mockResolvedValue([mockVerificationToken] as any);
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockVerificationTokenRepository.save.mockResolvedValue(mockVerificationToken as any);
      mockAuditService.recordEvent.mockRejectedValue(new Error('Audit error'));

      const result = await service.verifyPhoneWithCode(
        createVerifyPhoneWithCodeDto({ phone: '+1234567890', code: '123456' }),
      );

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
        await service.verifyPhoneWithCode(createVerifyPhoneWithCodeDto({ phone: '+1234567890', code: '123456' }));
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
        await service.verifyPhoneWithCode(createVerifyPhoneWithCodeDto({ phone: '+1234567890', code: '123456' }));
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
        await service.verifyPhoneWithCode(createVerifyPhoneWithCodeDto({ phone: '+1234567890', code: '123456' }));
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
        await service.verifyPhoneWithCode(createVerifyPhoneWithCodeDto({ phone: '+1234567890', code: '123456' }));
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

      const result = await service.verifyPhoneWithCodeBySub(
        createVerifyPhoneWithCodeBySubDto({ sub: 'user-sub-123', code: '123456' }),
      );

      expect(result.message).toBe('Phone verified successfully. Please log in to continue.');
      expect(mockUserRepository.update).toHaveBeenCalledWith({ sub: TEST_USER_SUB } as any, {
        isPhoneVerified: true,
        isActive: true,
      });
      expect(mockAuditService.recordEvent).toHaveBeenCalled();
    });

    it('should throw NAuthException if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      try {
        await service.verifyPhoneWithCodeBySub(
          createVerifyPhoneWithCodeBySubDto({ sub: 'invalid-sub', code: '123456' }),
        );
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
        await service.verifyPhoneWithCodeBySub(
          createVerifyPhoneWithCodeBySubDto({ sub: 'user-sub-123', code: '123456' }),
        );
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
        await service.verifyPhoneWithCodeBySub(
          createVerifyPhoneWithCodeBySubDto({ sub: 'user-sub-123', code: 'wrong-code' }),
        );
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
        // Invalid code format is caught at DTO validation level
        expect(error.code).toBe(AuthErrorCode.VALIDATION_FAILED);
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
        await service.verifyPhoneWithCodeBySub(
          createVerifyPhoneWithCodeBySubDto({ sub: 'user-sub-123', code: '123456' }),
        );
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
        await service.verifyPhoneWithCodeBySub(
          createVerifyPhoneWithCodeBySubDto({ sub: 'user-sub-123', code: '123456' }),
        );
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
        await service.verifyPhoneWithCodeBySub(
          createVerifyPhoneWithCodeBySubDto({ sub: 'user-sub-123', code: '123456' }),
        );
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

      const result = await service.verifyPhoneWithCodeBySub(
        createVerifyPhoneWithCodeBySubDto({ sub: 'user-sub-123', code: '123456' }),
      );

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
        await service.verifyPhoneWithCodeBySub(
          createVerifyPhoneWithCodeBySubDto({ sub: 'user-sub-123', code: '123456' }),
        );
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
        await service.verifyPhoneWithCodeBySub(
          createVerifyPhoneWithCodeBySubDto({ sub: 'user-sub-123', code: '123456' }),
        );
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
        await service.verifyPhoneWithCodeBySub(
          createVerifyPhoneWithCodeBySubDto({ sub: 'user-sub-123', code: '123456' }),
        );
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
        await service.verifyPhoneWithCodeBySub(
          createVerifyPhoneWithCodeBySubDto({ sub: 'user-sub-123', code: '123456' }),
        );
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

      const result = await service.resendVerificationSMS(createResendVerificationSMSDto({ sub: 'user-sub-123' }));

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { sub: TEST_USER_SUB } as any });
      expect(mockSmsProvider.sendOTP).toHaveBeenCalled();
      expect(result).toEqual({ tokenId: 456 });
    });

    it('should enforce resend delay', async () => {
      const recentToken = {
        ...mockVerificationToken,
        createdAt: new Date(Date.now() - 30 * 1000), // 30 seconds ago
      };
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockVerificationTokenRepository.findOne.mockResolvedValue(recentToken as any);

      try {
        await service.resendVerificationSMS(createResendVerificationSMSDto({ sub: 'user-sub-123' }));
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

      await service.resendVerificationSMS(createResendVerificationSMSDto({ sub: 'user-sub-123' }));

      expect(mockSmsProvider.sendOTP).toHaveBeenCalled();
    });

    it('should throw NAuthException if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      try {
        await service.resendVerificationSMS(createResendVerificationSMSDto({ sub: 'invalid-sub' }));
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

      await service.resendVerificationSMS(createResendVerificationSMSDto({ sub: 'user-sub-123' }));

      // Should call sendVerificationSMS with same parameters
      expect(mockSmsProvider.sendOTP).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // resendVerificationSMSForPhone
  // ============================================================================

  describe('resendVerificationSMS with phone', () => {
    it('should resend verification SMS by phone number', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockVerificationTokenRepository.findOne.mockResolvedValue(null);
      mockStorageAdapter.incr.mockResolvedValue(1);
      mockStorageAdapter.ttl.mockResolvedValue(3600);
      mockVerificationTokenRepository.create.mockReturnValue(mockVerificationToken as any);
      mockVerificationTokenRepository.save.mockResolvedValue(mockVerificationToken as any);

      const result = await service.resendVerificationSMS(createResendVerificationSMSDto({ phone: '+1234567890' }));

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { phone: '+1234567890' } as any });
      expect(mockSmsProvider.sendOTP).toHaveBeenCalled();
      expect(result).toEqual({ tokenId: 456 });
    });

    it('should throw NAuthException if user not found by phone', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      try {
        await service.resendVerificationSMS(createResendVerificationSMSDto({ phone: '+9999999999' }));
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
        await service.resendVerificationSMS(createResendVerificationSMSDto({ phone: '+1234567890' }));
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
        expect(error.code).toBe(AuthErrorCode.ALREADY_VERIFIED);
      }
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
        mockHookRegistry as any, // hookRegistry (mock)
        undefined, // No audit service
      );

      mockStorageAdapter.incr.mockResolvedValue(1);
      mockStorageAdapter.ttl.mockResolvedValue(3600);
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockVerificationTokenRepository.findOne.mockResolvedValue(null);
      mockVerificationTokenRepository.create.mockReturnValue(mockVerificationToken as any);
      mockVerificationTokenRepository.save.mockResolvedValue(mockVerificationToken as any);

      await serviceWithoutAudit.sendVerificationSMS(createSendVerificationSMSDto({ sub: 'user-sub-123' }));

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

      await service.sendVerificationSMS(createSendVerificationSMSDto({ sub: 'user-sub-123' }));

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

      await service.sendVerificationSMS(createSendVerificationSMSDto({ sub: 'user-sub-123' }));

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

      await service.sendVerificationSMS(createSendVerificationSMSDto({ sub: 'user-sub-123' }));

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
        mockHookRegistry as any, // hookRegistry (mock)
        mockAuditService,
      );

      mockStorageAdapter.incr.mockResolvedValue(1);
      mockStorageAdapter.ttl.mockResolvedValue(-1);
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockVerificationTokenRepository.findOne.mockResolvedValue(null);
      mockVerificationTokenRepository.create.mockReturnValue(mockVerificationToken as any);
      mockVerificationTokenRepository.save.mockResolvedValue(mockVerificationToken as any);

      // Should use defaults (rateLimitMax: 3, rateLimitWindow: 3600, resendDelay: 60, expiresIn: 300, maxAttempts: 3)
      await service.sendVerificationSMS(createSendVerificationSMSDto({ sub: 'user-sub-123' }));

      expect(mockSmsProvider.sendOTP).toHaveBeenCalled();
    });
  });
});
