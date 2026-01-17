import 'reflect-metadata';
import { Repository } from 'typeorm';
import { EmailMFAProviderService } from './email-mfa-provider.service';
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
  EmailVerificationService,
} from '@nauth-toolkit/core';
import { SetupEmailMFADTO, VerifyEmailMFASetupDTO } from './dto/mfa.dto';

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
 * Email MFA Provider Service Unit Tests
 *
 * Tests Email MFA provider implementation including setup, verification,
 * challenge sending, and device management. Uses direct instantiation, no NestJS dependencies.
 */
describe('EmailMFAProviderService', () => {
  let service: EmailMFAProviderService;
  let mockMfaDeviceRepository: jest.Mocked<Repository<BaseMFADevice>>;
  let mockUserRepository: jest.Mocked<Repository<BaseUser>>;
  let mockConfig: NAuthConfig;
  let mockLogger: NAuthLogger;
  let mockPasswordService: unknown;
  let mockEmailVerificationService: jest.Mocked<EmailVerificationService>;
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
    // The transaction manager's getRepository is used for MFA device operations
    const createMockTransactionalEntityManager = () => {
      const mockDeviceRepo = {
        create: jest.fn((data) => ({ id: 1, userId: 1, type: MFAMethod.EMAIL, ...data })),
        save: jest.fn((data) => Promise.resolve({ id: 1, userId: 1, type: MFAMethod.EMAIL, ...data })),
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
        allowedMethods: [MFAMethod.EMAIL as any],
      },
    } as NAuthConfig;

    // Create mock password service
    mockPasswordService = {
      hashPassword: jest.fn(),
      verifyPassword: jest.fn(),
    };

    // Create mock email verification service
    mockEmailVerificationService = {
      sendVerificationEmail: jest.fn(),
      verifyEmailWithCode: jest.fn(),
    } as any;

    // Create mock user
    mockUser = {
      id: 1,
      sub: 'user-123',
      email: 'user@example.com',
      mfaEnabled: false,
    } as unknown as IUser;

    // Instantiate service directly
    service = new EmailMFAProviderService(
      mockMfaDeviceRepository,
      mockUserRepository,
      mockConfig,
      mockLogger,
      mockPasswordService,
      mockEmailVerificationService,
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
    expect(service.methodName).toBe(MFAMethod.EMAIL);
  });

  // ============================================================================
  // isMethodAllowed() Method
  // ============================================================================

  describe('isMethodAllowed', () => {
    it('should return true when Email is in allowed methods', () => {
      const result = service.isMethodAllowed();
      expect(result).toBe(true);
    });

    it('should return false when Email is not in allowed methods', () => {
      mockConfig.mfa!.allowedMethods = [MFAMethod.TOTP as any];
      const result = service.isMethodAllowed();
      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // setup() Method
  // ============================================================================

  describe('setup', () => {
    const setupDto: SetupEmailMFADTO = {
      email: 'user@example.com',
      deviceName: 'My Email',
    };

    it('should send verification Email', async () => {
      mockEmailVerificationService.sendVerificationEmail.mockResolvedValue({ tokenId: 1 } as any);

      await runAs(mockUser, async () => await service.setup(setupDto));

      expect(mockEmailVerificationService.sendVerificationEmail).toHaveBeenCalled();
      expect(mockLogger.log).toHaveBeenCalledWith((expect as any).stringContaining('Setting up Email MFA'));
    });

    it('should throw error when Email is not enabled', async () => {
      mockConfig.mfa!.allowedMethods = [MFAMethod.TOTP as any];

      try {
        await runAs(mockUser, async () => await service.setup(setupDto));
        fail('Should have thrown NAuthException');
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthException);
        expect((error as NAuthException).code).toBe(AuthErrorCode.VALIDATION_FAILED);
        expect((error as NAuthException).message).toContain('Email MFA is not enabled');
      }
    });

    it('should throw error when email verification service is not available', async () => {
      const serviceWithoutEmail = new EmailMFAProviderService(
        mockMfaDeviceRepository,
        mockUserRepository,
        mockConfig,
        mockLogger,
        mockPasswordService,
        undefined, // No email verification service
      );

      try {
        await serviceWithoutEmail.setup(mockUser, setupDto);
        fail('Should have thrown NAuthException');
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthException);
        expect((error as NAuthException).code).toBe(AuthErrorCode.VALIDATION_FAILED);
        expect((error as NAuthException).message).toContain('Email verification service is not available');
      }
    });

    it('should auto-complete setup when email is already verified', async () => {
      const verifiedUser = {
        ...mockUser,
        isEmailVerified: true,
      } as unknown as IUser;

      const mockDevice = {
        id: 1,
        userId: 1,
        type: MFAMethod.EMAIL,
        name: 'Email',
        email: 'user@example.com',
        isActive: true,
        isPrimary: true,
      };

      mockMfaDeviceRepository.create.mockReturnValue(mockDevice as any);
      mockMfaDeviceRepository.save.mockResolvedValue(mockDevice as any);
      mockMfaDeviceRepository.find.mockResolvedValue([]);
      mockUserRepository.findOne.mockResolvedValue({ ...verifiedUser, mfaEnabled: false } as any);
      mockUserRepository.save.mockResolvedValue({ ...verifiedUser, mfaEnabled: true } as any);

      const result = await runAs(verifiedUser, async () => await service.setup(setupDto));

      expect(result).toEqual({ deviceId: 1, autoCompleted: true });
      expect(mockEmailVerificationService.sendVerificationEmail).not.toHaveBeenCalled();
      // Device is created via transaction manager's getRepository
      expect(mockUserRepository.manager.transaction).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // verifySetup() Method
  // ============================================================================

  describe('verifySetup', () => {
    const verifyDto: VerifyEmailMFASetupDTO = {
      email: 'user@example.com',
      code: '123456',
    };

    it('should verify Email code and create device', async () => {
      const mockDevice = {
        id: 1,
        userId: 1,
        type: MFAMethod.EMAIL,
        name: 'Email',
        email: 'user@example.com',
        isActive: true,
        isPrimary: true,
      };

      mockEmailVerificationService.verifyEmailWithCode.mockResolvedValue({ message: 'Verified' });
      mockMfaDeviceRepository.create.mockReturnValue(mockDevice as any);
      mockMfaDeviceRepository.save.mockResolvedValue(mockDevice as any);
      // Mock getUserDevices to return empty array (no existing devices)
      mockMfaDeviceRepository.find.mockResolvedValue([]);
      // Mock findOne for enableMFAForUser to reload user
      mockUserRepository.findOne.mockResolvedValue({ ...mockUser, mfaEnabled: false } as any);
      mockUserRepository.save.mockResolvedValue({ ...mockUser, mfaEnabled: true } as any);

      const result = await runAs(mockUser, async () => await service.verifySetup(verifyDto));

      expect(result).toBe(1);
      expect(mockEmailVerificationService.verifyEmailWithCode).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'user@example.com',
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

    it('should throw error when email verification service is not available', async () => {
      const serviceWithoutEmail = new EmailMFAProviderService(
        mockMfaDeviceRepository,
        mockUserRepository,
        mockConfig,
        mockLogger,
        mockPasswordService,
        undefined,
      );

      try {
        await serviceWithoutEmail.verifySetup(mockUser, verifyDto);
        fail('Should have thrown NAuthException');
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthException);
        expect((error as NAuthException).code).toBe(AuthErrorCode.VALIDATION_FAILED);
        expect((error as NAuthException).message).toContain('Email verification service is not available');
      }
    });

    it('should throw error for invalid Email code', async () => {
      mockEmailVerificationService.verifyEmailWithCode.mockRejectedValue(
        new NAuthException(AuthErrorCode.VERIFICATION_CODE_INVALID, 'Invalid code'),
      );

      try {
        await runAs(mockUser, async () => await service.verifySetup(verifyDto));
        fail('Should have thrown NAuthException');
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthException);
        expect((error as NAuthException).code).toBe(AuthErrorCode.VERIFICATION_CODE_INVALID);
        expect((error as NAuthException).message).toContain('Invalid Email code');
      }
    });

    it('should use deviceName parameter if provided', async () => {
      const mockDevice = {
        id: 1,
        userId: 1,
        type: MFAMethod.EMAIL,
        name: 'Custom Device Name',
        email: 'user@example.com',
        isActive: true,
        isPrimary: true,
      };

      mockEmailVerificationService.verifyEmailWithCode.mockResolvedValue({ message: 'Verified' });
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
      // Verify device name was passed correctly by checking transaction was called
      const transactionCall = (mockUserRepository.manager.transaction as jest.Mock).mock.calls[0];
      expect(transactionCall).toBeDefined();
    });

    it('should skip code verification when email is already verified', async () => {
      const verifiedUser = {
        ...mockUser,
        isEmailVerified: true,
      } as unknown as IUser;

      const mockDevice = {
        id: 1,
        userId: 1,
        type: MFAMethod.EMAIL,
        name: 'Email',
        email: 'user@example.com',
        isActive: true,
        isPrimary: true,
      };

      mockMfaDeviceRepository.create.mockReturnValue(mockDevice as any);
      mockMfaDeviceRepository.save.mockResolvedValue(mockDevice as any);
      mockMfaDeviceRepository.find.mockResolvedValue([]);
      mockUserRepository.findOne.mockResolvedValue({ ...verifiedUser, mfaEnabled: false } as any);
      mockUserRepository.save.mockResolvedValue({ ...verifiedUser, mfaEnabled: true } as any);

      await runAs(verifiedUser, async () => await service.verifySetup(verifyDto));

      expect(mockEmailVerificationService.verifyEmailWithCode).not.toHaveBeenCalled();
      // Device is created via transaction manager's getRepository
      expect(mockUserRepository.manager.transaction).toHaveBeenCalled();
    });

    it('should fall back to user email when dto.email is undefined', async () => {
      const verifyDtoWithoutEmail = {
        code: '123456',
      } as VerifyEmailMFASetupDTO;

      const mockDevice = {
        id: 1,
        userId: 1,
        type: MFAMethod.EMAIL,
        name: 'Email',
        email: 'user@example.com',
        isActive: true,
        isPrimary: true,
      };

      mockEmailVerificationService.verifyEmailWithCode.mockResolvedValue({ message: 'Verified' });
      mockMfaDeviceRepository.create.mockReturnValue(mockDevice as any);
      mockMfaDeviceRepository.save.mockResolvedValue(mockDevice as any);
      mockMfaDeviceRepository.find.mockResolvedValue([]);
      mockUserRepository.findOne.mockResolvedValue({ ...mockUser, mfaEnabled: false } as any);
      mockUserRepository.save.mockResolvedValue({ ...mockUser, mfaEnabled: true } as any);

      const result = await runAs(mockUser, async () => await service.verifySetup(verifyDtoWithoutEmail));

      expect(result).toBe(1);
      // Device is created via transaction manager's getRepository
      expect(mockUserRepository.manager.transaction).toHaveBeenCalled();
    });

    it('should throw error when both dto.email and user.email are missing', async () => {
      const verifyDtoWithoutEmail = {
        code: '123456',
      } as VerifyEmailMFASetupDTO;

      const mockUserNoEmail = {
        id: 1,
        sub: 'user-123',
        email: null,
        mfaEnabled: false,
      } as unknown as IUser;

      try {
        await runAs(mockUserNoEmail, async () => await service.verifySetup(verifyDtoWithoutEmail));
        fail('Should have thrown NAuthException');
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthException);
        expect((error as NAuthException).code).toBe(AuthErrorCode.VALIDATION_FAILED);
        expect((error as NAuthException).message).toContain('Email address is required');
      }
    });
  });

  // ============================================================================
  // verify() Method
  // ============================================================================

  describe('verify', () => {
    it('should verify Email code successfully', async () => {
      mockEmailVerificationService.verifyEmailWithCode.mockResolvedValue({ message: 'Verified' });

      const result = await runAs(mockUser, async () => await service.verify('123456'));

      expect(result).toBe(true);
      expect(mockEmailVerificationService.verifyEmailWithCode).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'user@example.com',
          code: '123456',
        }),
      );
      expect(mockLogger.log).toHaveBeenCalledWith((expect as any).stringContaining('Email code verified successfully'));
    });

    it('should return false for invalid code format', async () => {
      const result = await runAs(mockUser, async () => await service.verify(null as any));

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith('Invalid Email code format');
    });

    it('should return false when email verification service is not available', async () => {
      const serviceWithoutEmail = new EmailMFAProviderService(
        mockMfaDeviceRepository,
        mockUserRepository,
        mockConfig,
        mockLogger,
        mockPasswordService,
        undefined,
      );

      const result = await serviceWithoutEmail.verify(mockUser, '123456');

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        (expect as any).stringContaining('email verification service is not available'),
      );
    });

    it('should throw NAuthException when verification fails', async () => {
      mockEmailVerificationService.verifyEmailWithCode.mockRejectedValue(
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
        type: MFAMethod.EMAIL,
        name: 'Email',
        email: 'user@example.com',
        isActive: true,
        isPrimary: true,
      };

      mockMfaDeviceRepository.findOne.mockResolvedValue(mockDevice as any);
      mockEmailVerificationService.verifyEmailWithCode.mockResolvedValue({ message: 'Verified' });
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
    it('should send Email code and return masked email', async () => {
      const mockDevice = {
        id: 1,
        userId: 1,
        type: MFAMethod.EMAIL,
        name: 'Email',
        email: 'user@example.com',
        isActive: true,
        isPrimary: true,
      };

      mockMfaDeviceRepository.findOne.mockResolvedValue(mockDevice as any);
      mockEmailVerificationService.sendVerificationEmail.mockResolvedValue({ tokenId: 1 } as any);

      const result = await runAs(mockUser, async () => await service.sendChallenge());

      expect(result).toBe('u***r@example.com');
      expect(mockEmailVerificationService.sendVerificationEmail).toHaveBeenCalled();
      expect(mockLogger.log).toHaveBeenCalledWith((expect as any).stringContaining('Email MFA code sent'));
    });

    it('should throw error when no Email device registered', async () => {
      mockMfaDeviceRepository.findOne.mockResolvedValue(null);

      try {
        await runAs(mockUser, async () => await service.sendChallenge());
        fail('Should have thrown NAuthException');
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthException);
        expect((error as NAuthException).code).toBe(AuthErrorCode.NOT_FOUND);
        expect((error as NAuthException).message).toContain('No Email device registered');
      }
    });

    it('should fall back to user email when device has no email', async () => {
      const mockDevice = {
        id: 1,
        userId: 1,
        type: MFAMethod.EMAIL,
        name: 'Email',
        email: null,
        isActive: true,
        isPrimary: true,
      };

      mockMfaDeviceRepository.findOne.mockResolvedValue(mockDevice as any);
      mockEmailVerificationService.sendVerificationEmail.mockResolvedValue({ tokenId: 1 } as any);

      const result = await runAs(mockUser, async () => await service.sendChallenge());

      expect(result).toBe('u***r@example.com');
      expect(mockEmailVerificationService.sendVerificationEmail).toHaveBeenCalled();
      expect(mockLogger.log).toHaveBeenCalledWith((expect as any).stringContaining('Email MFA code sent'));
    });

    it('should throw error when device and user have no email', async () => {
      const mockDevice = {
        id: 1,
        userId: 1,
        type: MFAMethod.EMAIL,
        name: 'Email',
        email: null,
        isActive: true,
        isPrimary: true,
      };

      const mockUserNoEmail = {
        id: 1,
        sub: 'user-123',
        email: null,
        mfaEnabled: false,
      };

      mockMfaDeviceRepository.findOne.mockResolvedValue(mockDevice as any);

      try {
        await runAs(mockUserNoEmail as any, async () => await service.sendChallenge());
        fail('Should have thrown NAuthException');
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthException);
        expect((error as NAuthException).code).toBe(AuthErrorCode.VALIDATION_FAILED);
        expect((error as NAuthException).message).toContain('No email address found');
      }
    });

    it('should throw error when email verification service is not available', async () => {
      const serviceWithoutEmail = new EmailMFAProviderService(
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
        type: MFAMethod.EMAIL,
        name: 'Email',
        email: 'user@example.com',
        isActive: true,
        isPrimary: true,
      };

      mockMfaDeviceRepository.findOne.mockResolvedValue(mockDevice as any);

      try {
        await serviceWithoutEmail.sendChallenge(mockUser);
        fail('Should have thrown NAuthException');
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthException);
        expect((error as NAuthException).code).toBe(AuthErrorCode.VALIDATION_FAILED);
        expect((error as NAuthException).message).toContain('Email verification service is not available');
      }
    });
  });
});
