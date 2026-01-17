import 'reflect-metadata';
import { Repository } from 'typeorm';
import { SMSMFAProviderService } from './sms-mfa-provider.service';
import {
  BaseMFADevice,
  BaseUser,
  IUser,
  ContextStorage,
  NAuthConfig,
  NAuthLogger,
  NAuthException,
  AuthErrorCode,
  MFAMethod,
  PhoneVerificationService,
} from '@nauth-toolkit/core';
import { SetupSMSMFADTO, VerifySMSMFASetupDTO } from './dto/mfa.dto';

/**
 * Execute a provider call with a CURRENT_USER bound into request context.
 *
 * Providers no longer accept `IUser` parameters; they derive the user from ContextStorage.
 */
async function runAs<T>(user: IUser, callback: () => Promise<T>): Promise<T> {
  return await ContextStorage.run(async () => {
    ContextStorage.set('CURRENT_USER', user);
    return await callback();
  });
}

/**
 * SMS MFA Provider Service Unit Tests
 *
 * Tests SMS MFA provider implementation including setup, verification,
 * challenge sending, and device management. Uses direct instantiation, no NestJS dependencies.
 */
describe('SMSMFAProviderService', () => {
  let service: SMSMFAProviderService;
  let mockMfaDeviceRepository: jest.Mocked<Repository<BaseMFADevice>>;
  let mockUserRepository: jest.Mocked<Repository<BaseUser>>;
  let mockConfig: NAuthConfig;
  let mockLogger: NAuthLogger;
  let mockPasswordService: unknown;
  let mockPhoneVerificationService: jest.Mocked<PhoneVerificationService>;
  let mockUser: IUser;

  beforeEach(() => {
    // Create mock repositories
    mockMfaDeviceRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
    } as any;

    // Create mock transactional entity manager factory
    const createMockTransactionalEntityManager = () => {
      const mockDeviceRepo = {
        create: jest.fn((data) => ({ id: 1, userId: 1, type: MFAMethod.SMS, ...data })),
        save: jest.fn((data) => Promise.resolve({ id: 1, userId: 1, type: MFAMethod.SMS, ...data })),
        createQueryBuilder: jest.fn(() => ({
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue(null), // No existing device
        })),
      };

      return {
        findOne: jest.fn(),
        save: jest.fn(),
        create: jest.fn(),
        createQueryBuilder: jest.fn(() => ({
          select: jest.fn().mockReturnThis(),
          from: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          setLock: jest.fn().mockReturnThis(),
          getOne: jest.fn().mockResolvedValue({ id: 1 }), // User exists
        })),
        getRepository: jest.fn(() => mockDeviceRepo),
      };
    };

    mockUserRepository = {
      save: jest.fn(),
      findOne: jest.fn(),
      target: BaseUser,
      manager: {
        transaction: jest.fn(async (callback) => {
          // Create fresh mock transactional entity manager for each transaction
          const mockTransactionalEntityManager = createMockTransactionalEntityManager();
          return await callback(mockTransactionalEntityManager);
        }),
      },
    } as any;

    // Create mock logger
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as any;

    // Create mock config
    mockConfig = {
      mfa: {
        enabled: true,
        allowedMethods: [MFAMethod.SMS as any],
      },
    } as NAuthConfig;

    // Create mock password service
    mockPasswordService = {
      hashPassword: jest.fn(),
      verifyPassword: jest.fn(),
    };

    // Create mock phone verification service
    mockPhoneVerificationService = {
      sendVerificationSMS: jest.fn(),
      verifyPhoneWithCodeBySub: jest.fn(),
    } as any;

    // Create mock user
    mockUser = {
      id: 1,
      sub: 'user-123',
      email: 'user@example.com',
      phone: '+1234567890',
      mfaEnabled: false,
    } as unknown as IUser;

    // Instantiate service directly
    service = new SMSMFAProviderService(
      mockMfaDeviceRepository,
      mockUserRepository,
      mockConfig,
      mockLogger,
      mockPasswordService,
      mockPhoneVerificationService,
      undefined, // challengeService (optional)
      undefined, // auditService (optional)
      undefined, // clientInfoService (optional)
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
    expect(service.methodName).toBe(MFAMethod.SMS);
  });

  // ============================================================================
  // isMethodAllowed() Method
  // ============================================================================

  describe('isMethodAllowed', () => {
    it('should return true when SMS is in allowed methods', () => {
      const result = service.isMethodAllowed();
      expect(result).toBe(true);
    });

    it('should return false when SMS is not in allowed methods', () => {
      mockConfig.mfa!.allowedMethods = [MFAMethod.TOTP as any];
      const result = service.isMethodAllowed();
      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // setup() Method
  // ============================================================================

  describe('setup', () => {
    const setupDto: SetupSMSMFADTO = {
      phoneNumber: '+1234567890',
      deviceName: 'My Phone',
    };

    it('should send verification SMS', async () => {
      mockPhoneVerificationService.sendVerificationSMS.mockResolvedValue({ tokenId: 1 });

      await runAs(mockUser, async () => await service.setup(setupDto));

      expect(mockPhoneVerificationService.sendVerificationSMS).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: 'user-123',
        }),
      );
      expect(mockLogger.log).toHaveBeenCalledWith((expect as any).stringContaining('Setting up SMS MFA'));
    });

    it('should throw error when SMS is not enabled', async () => {
      mockConfig.mfa!.allowedMethods = [MFAMethod.TOTP as any];

      try {
        await runAs(mockUser, async () => await service.setup(setupDto));
        fail('Should have thrown NAuthException');
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthException);
        expect((error as NAuthException).code).toBe(AuthErrorCode.VALIDATION_FAILED);
        expect((error as NAuthException).message).toContain('SMS MFA is not enabled');
      }
    });

    it('should throw error when phone verification service is not available', async () => {
      const serviceWithoutPhone = new SMSMFAProviderService(
        mockMfaDeviceRepository,
        mockUserRepository,
        mockConfig,
        mockLogger,
        mockPasswordService,
        undefined, // No phone verification service
      );

      try {
        await serviceWithoutPhone.setup(mockUser, setupDto);
        fail('Should have thrown NAuthException');
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthException);
        expect((error as NAuthException).code).toBe(AuthErrorCode.VALIDATION_FAILED);
        expect((error as NAuthException).message).toContain('Phone verification service is not available');
      }
    });
  });

  // ============================================================================
  // verifySetup() Method
  // ============================================================================

  describe('verifySetup', () => {
    const verifyDto: VerifySMSMFASetupDTO = {
      phoneNumber: '+1234567890',
      code: '123456',
    };

    it('should verify SMS code and create device', async () => {
      const mockDevice = {
        id: 1,
        userId: 1,
        type: MFAMethod.SMS,
        name: 'SMS Phone',
        phoneNumber: '+1234567890',
        isActive: true,
        isPrimary: true,
      };

      mockPhoneVerificationService.verifyPhoneWithCodeBySub.mockResolvedValue({ message: 'Verified' });
      mockMfaDeviceRepository.create.mockReturnValue(mockDevice as any);
      mockMfaDeviceRepository.save.mockResolvedValue(mockDevice as any);
      // Mock getUserDevices to return empty array (no existing devices)
      mockMfaDeviceRepository.find.mockResolvedValue([]);
      // Mock findOne for enableMFAForUser to reload user
      mockUserRepository.findOne.mockResolvedValue({ ...mockUser, mfaEnabled: false } as any);
      mockUserRepository.save.mockResolvedValue({ ...mockUser, mfaEnabled: true } as any);

      const result = await runAs(mockUser, async () => await service.verifySetup(verifyDto));

      expect(result).toBe(1);
      expect(mockPhoneVerificationService.verifyPhoneWithCodeBySub).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: 'user-123',
          code: '123456',
        }),
      );
      // Device is created via transaction manager's getRepository
      expect(mockUserRepository.manager.transaction).toHaveBeenCalled();
      expect(mockUserRepository.save).toHaveBeenCalled();
    });

    it('should throw error when code is missing', async () => {
      const dtoWithoutCode = { ...verifyDto, code: '' };

      try {
        await runAs(mockUser, async () => await service.verifySetup(dtoWithoutCode));
        fail('Should have thrown NAuthException');
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthException);
        expect((error as NAuthException).code).toBe(AuthErrorCode.VALIDATION_FAILED);
        expect((error as NAuthException).message).toContain('Verification code is required');
      }
    });

    it('should throw error when phone verification service is not available', async () => {
      const serviceWithoutPhone = new SMSMFAProviderService(
        mockMfaDeviceRepository,
        mockUserRepository,
        mockConfig,
        mockLogger,
        mockPasswordService,
        undefined,
      );

      try {
        await serviceWithoutPhone.verifySetup(mockUser, verifyDto);
        fail('Should have thrown NAuthException');
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthException);
        expect((error as NAuthException).code).toBe(AuthErrorCode.VALIDATION_FAILED);
        expect((error as NAuthException).message).toContain('Phone verification service is not available');
      }
    });

    it('should throw error for invalid SMS code', async () => {
      mockPhoneVerificationService.verifyPhoneWithCodeBySub.mockRejectedValue(
        new NAuthException(AuthErrorCode.VERIFICATION_CODE_INVALID, 'Invalid code'),
      );

      try {
        await runAs(mockUser, async () => await service.verifySetup(verifyDto));
        fail('Should have thrown NAuthException');
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthException);
        expect((error as NAuthException).code).toBe(AuthErrorCode.VERIFICATION_CODE_INVALID);
        expect((error as NAuthException).message).toContain('Invalid SMS code');
      }
    });

    it('should use deviceName parameter if provided', async () => {
      const mockDevice = {
        id: 1,
        userId: 1,
        type: MFAMethod.SMS,
        name: 'Custom Device Name',
        phoneNumber: '+1234567890',
        isActive: true,
        isPrimary: true,
      };

      mockPhoneVerificationService.verifyPhoneWithCodeBySub.mockResolvedValue({ message: 'Verified' });
      mockMfaDeviceRepository.create.mockReturnValue(mockDevice as any);
      mockMfaDeviceRepository.save.mockResolvedValue(mockDevice as any);
      // Mock getUserDevices to return empty array (no existing devices)
      mockMfaDeviceRepository.find.mockResolvedValue([]);
      // Mock findOne for enableMFAForUser to reload user
      mockUserRepository.findOne.mockResolvedValue({ ...mockUser, mfaEnabled: false } as any);
      mockUserRepository.save.mockResolvedValue({ ...mockUser, mfaEnabled: true } as any);

      await runAs(mockUser, async () => await service.verifySetup(verifyDto, 'Custom Device Name'));

      // Device is created via transaction manager's getRepository
      expect(mockUserRepository.manager.transaction).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // verify() Method
  // ============================================================================

  describe('verify', () => {
    it('should verify SMS code successfully', async () => {
      mockPhoneVerificationService.verifyPhoneWithCodeBySub.mockResolvedValue({ message: 'Verified' });

      const result = await runAs(mockUser, async () => await service.verify('123456'));

      expect(result).toBe(true);
      expect(mockPhoneVerificationService.verifyPhoneWithCodeBySub).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: 'user-123',
          code: '123456',
        }),
      );
      expect(mockLogger.log).toHaveBeenCalledWith((expect as any).stringContaining('SMS code verified successfully'));
    });

    it('should return false for invalid code format', async () => {
      const result = await runAs(mockUser, async () => await service.verify(null as any));

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith('Invalid SMS code format');
    });

    it('should return false when phone verification service is not available', async () => {
      const serviceWithoutPhone = new SMSMFAProviderService(
        mockMfaDeviceRepository,
        mockUserRepository,
        mockConfig,
        mockLogger,
        mockPasswordService,
        undefined,
      );

      const result = await serviceWithoutPhone.verify(mockUser, '123456');

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        (expect as any).stringContaining('phone verification service is not available'),
      );
    });

    it('should throw NAuthException when verification fails', async () => {
      mockPhoneVerificationService.verifyPhoneWithCodeBySub.mockRejectedValue(
        new NAuthException(AuthErrorCode.VERIFICATION_CODE_INVALID, 'Invalid code'),
      );

      try {
        await runAs(mockUser, async () => await service.verify('123456'));
        fail('Should have thrown NAuthException');
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthException);
        expect((error as NAuthException).code).toBe(AuthErrorCode.VERIFICATION_CODE_INVALID);
      }
    });

    it('should update device usage when device is found', async () => {
      const mockDevice = {
        id: 1,
        userId: 1,
        type: MFAMethod.SMS,
        name: 'SMS Phone',
        phoneNumber: '+1234567890',
        isActive: true,
        isPrimary: true,
      };

      mockMfaDeviceRepository.findOne.mockResolvedValue(mockDevice as any);
      mockPhoneVerificationService.verifyPhoneWithCodeBySub.mockResolvedValue({ message: 'Verified' });
      mockMfaDeviceRepository.save.mockResolvedValue(mockDevice as any);

      await runAs(mockUser, async () => await service.verify('123456', 1));

      expect(mockMfaDeviceRepository.findOne).toHaveBeenCalled();
      expect(mockMfaDeviceRepository.save).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // sendChallenge() Method
  // ============================================================================

  describe('sendChallenge', () => {
    it('should send SMS code and return masked phone', async () => {
      const mockDevice = {
        id: 1,
        userId: 1,
        type: MFAMethod.SMS,
        name: 'SMS Phone',
        phoneNumber: '+1234567890',
        isActive: true,
        isPrimary: true,
      };

      mockMfaDeviceRepository.findOne.mockResolvedValue(mockDevice as any);
      mockPhoneVerificationService.sendVerificationSMS.mockResolvedValue({ tokenId: 1 });

      const result = await runAs(mockUser, async () => await service.sendChallenge());

      expect(result).toBe('***-***-7890');
      expect(mockPhoneVerificationService.sendVerificationSMS).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: 'user-123',
          skipAlreadyVerifiedCheck: true,
        }),
      );
      expect(mockLogger.log).toHaveBeenCalledWith((expect as any).stringContaining('SMS MFA code sent'));
    });

    it('should throw error when no SMS device registered', async () => {
      mockMfaDeviceRepository.findOne.mockResolvedValue(null);

      try {
        await runAs(mockUser, async () => await service.sendChallenge());
        fail('Should have thrown NAuthException');
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthException);
        expect((error as NAuthException).code).toBe(AuthErrorCode.NOT_FOUND);
        expect((error as NAuthException).message).toContain('No SMS device registered');
      }
    });

    it('should throw error when device has no phone number', async () => {
      const mockDevice = {
        id: 1,
        userId: 1,
        type: MFAMethod.SMS,
        name: 'SMS Phone',
        phoneNumber: null,
        isActive: true,
        isPrimary: true,
      };

      // Create user without phone number
      const userWithoutPhone = {
        ...mockUser,
        phone: null,
      } as IUser;

      mockMfaDeviceRepository.findOne.mockResolvedValue(mockDevice as any);

      try {
        await runAs(userWithoutPhone, async () => await service.sendChallenge());
        fail('Should have thrown NAuthException');
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthException);
        expect((error as NAuthException).code).toBe(AuthErrorCode.VALIDATION_FAILED);
        expect((error as NAuthException).message).toContain('No phone number found for SMS MFA');
      }
    });

    it('should throw error when phone verification service is not available', async () => {
      const serviceWithoutPhone = new SMSMFAProviderService(
        mockMfaDeviceRepository,
        mockUserRepository,
        mockConfig,
        mockLogger,
        mockPasswordService,
        undefined,
      );

      const mockDevice = {
        id: 1,
        userId: 1,
        type: MFAMethod.SMS,
        name: 'SMS Phone',
        phoneNumber: '+1234567890',
        isActive: true,
        isPrimary: true,
      };

      mockMfaDeviceRepository.findOne.mockResolvedValue(mockDevice as any);

      try {
        await serviceWithoutPhone.sendChallenge(mockUser);
        fail('Should have thrown NAuthException');
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthException);
        expect((error as NAuthException).code).toBe(AuthErrorCode.VALIDATION_FAILED);
        expect((error as NAuthException).message).toContain('Phone verification service is not available');
      }
    });
  });
});
