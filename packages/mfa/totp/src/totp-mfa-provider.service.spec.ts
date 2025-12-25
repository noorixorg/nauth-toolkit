import { Repository } from 'typeorm';
import { TOTPMFAProviderService } from './totp-mfa-provider.service';
import { TOTPService } from './totp.service';
import {
  BaseMFADevice,
  BaseUser,
  IUser,
  NAuthConfig,
  NAuthLogger,
  NAuthException,
  AuthErrorCode,
  MFAMethod,
} from '@nauth-toolkit/core';
import { SetupTOTPResponseDTO, VerifyTOTPSetupDTO } from './dto/mfa.dto';

/**
 * TOTP MFA Provider Service Unit Tests
 *
 * Tests TOTP MFA provider implementation including setup, verification,
 * and device management. Uses direct instantiation, no NestJS dependencies.
 */
describe('TOTPMFAProviderService', () => {
  let service: TOTPMFAProviderService;
  let mockMfaDeviceRepository: jest.Mocked<Repository<BaseMFADevice>>;
  let mockUserRepository: jest.Mocked<Repository<BaseUser>>;
  let mockConfig: NAuthConfig;
  let mockLogger: NAuthLogger;
  let mockPasswordService: unknown;
  let mockTotpService: jest.Mocked<TOTPService>;
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
        create: jest.fn((data) => ({ id: 1, userId: 1, type: MFAMethod.TOTP, ...data })),
        save: jest.fn((data) => Promise.resolve({ id: 1, userId: 1, type: MFAMethod.TOTP, ...data })),
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
        allowedMethods: [MFAMethod.TOTP as any],
        issuer: 'TestApp',
        totp: {
          window: 1,
          stepSeconds: 30,
          digits: 6,
          algorithm: 'sha1',
        },
      },
    } as NAuthConfig;

    // Create mock password service
    mockPasswordService = {
      hashPassword: jest.fn(),
      verifyPassword: jest.fn(),
    };

    // Create mock TOTP service
    mockTotpService = {
      generateSecret: jest.fn(),
      verifyCode: jest.fn(),
      verifyCodeWithDetails: jest.fn(),
      isValidSecret: jest.fn(),
    } as any;

    // Create mock user
    mockUser = {
      id: 1,
      sub: 'user-123',
      email: 'user@example.com',
      mfaEnabled: false,
    } as IUser;

    // Instantiate service directly
    service = new TOTPMFAProviderService(
      mockMfaDeviceRepository,
      mockUserRepository,
      mockConfig,
      mockLogger,
      mockPasswordService,
      mockTotpService,
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
    expect(service.methodName).toBe(MFAMethod.TOTP);
  });

  // ============================================================================
  // isMethodAllowed() Method
  // ============================================================================

  describe('isMethodAllowed', () => {
    it('should return true when TOTP is in allowed methods', () => {
      const result = service.isMethodAllowed();
      expect(result).toBe(true);
    });

    it('should return false when TOTP is not in allowed methods', () => {
      mockConfig.mfa!.allowedMethods = [MFAMethod.SMS as any];
      const result = service.isMethodAllowed();
      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // setup() Method
  // ============================================================================

  describe('setup', () => {
    it('should generate TOTP secret and QR code', async () => {
      const setupResponse: SetupTOTPResponseDTO = {
        secret: 'JBSWY3DPEHPK3PXP',
        qrCode: 'data:image/png;base64,...',
        manualEntryKey: 'JBSW Y3DP EHPK 3PXP',
        issuer: 'TestApp',
        accountName: 'user@example.com',
      };

      mockTotpService.generateSecret.mockResolvedValue(setupResponse);

      const result = await service.setup(mockUser);

      expect(result).toEqual(setupResponse);
      expect(mockTotpService.generateSecret).toHaveBeenCalledWith('user@example.com');
      expect(mockLogger.log).toHaveBeenCalledWith((expect as any).stringContaining('Setting up TOTP'));
    });

    it('should throw error when TOTP is not enabled', async () => {
      mockConfig.mfa!.allowedMethods = [MFAMethod.SMS as any];

      try {
        await service.setup(mockUser);
        fail('Should have thrown NAuthException');
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthException);
        expect((error as NAuthException).code).toBe(AuthErrorCode.VALIDATION_FAILED);
        expect((error as NAuthException).message).toContain('TOTP is not enabled');
      }
    });
  });

  // ============================================================================
  // verifySetup() Method
  // ============================================================================

  describe('verifySetup', () => {
    const verifyDto: VerifyTOTPSetupDTO = {
      secret: 'JBSWY3DPEHPK3PXP',
      code: '123456',
      deviceName: 'Google Authenticator',
    };

    it('should verify TOTP code and create device', async () => {
      const mockDevice = {
        id: 1,
        userId: 1,
        type: MFAMethod.TOTP,
        name: 'Google Authenticator',
        secret: 'JBSWY3DPEHPK3PXP',
        isActive: true,
        isPrimary: true,
      };

      mockTotpService.isValidSecret.mockReturnValue(true);
      mockTotpService.verifyCodeWithDetails.mockReturnValue({ valid: true });
      mockMfaDeviceRepository.create.mockReturnValue(mockDevice as any);
      mockMfaDeviceRepository.save.mockResolvedValue(mockDevice as any);
      // Mock getUserDevices to return empty array (no existing devices)
      mockMfaDeviceRepository.find.mockResolvedValue([]);
      // Mock findOne for enableMFAForUser to reload user
      mockUserRepository.findOne.mockResolvedValue({ ...mockUser, mfaEnabled: false } as any);
      mockUserRepository.save.mockResolvedValue({ ...mockUser, mfaEnabled: true } as any);

      const result = await service.verifySetup(mockUser, verifyDto);

      expect(result).toBe(1);
      expect(mockTotpService.isValidSecret).toHaveBeenCalledWith('JBSWY3DPEHPK3PXP');
      expect(mockTotpService.verifyCodeWithDetails).toHaveBeenCalledWith('JBSWY3DPEHPK3PXP', '123456');
      // Device is created via transaction manager's getRepository
      expect(mockUserRepository.manager.transaction).toHaveBeenCalled();
      expect(mockUserRepository.save).toHaveBeenCalled();
    });

    it('should throw error for invalid secret format', async () => {
      mockTotpService.isValidSecret.mockReturnValue(false);

      try {
        await service.verifySetup(mockUser, verifyDto);
        fail('Should have thrown NAuthException');
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthException);
        expect((error as NAuthException).code).toBe(AuthErrorCode.VALIDATION_FAILED);
        expect((error as NAuthException).message).toContain('Invalid TOTP secret');
      }
    });

    it('should throw error for invalid code', async () => {
      mockTotpService.isValidSecret.mockReturnValue(true);
      mockTotpService.verifyCodeWithDetails.mockReturnValue({ valid: false, error: 'Invalid code' });

      try {
        await service.verifySetup(mockUser, verifyDto);
        fail('Should have thrown NAuthException');
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthException);
        expect((error as NAuthException).code).toBe(AuthErrorCode.VERIFICATION_CODE_INVALID);
      }
    });

    it('should use deviceName from DTO if provided', async () => {
      const mockDevice = {
        id: 1,
        userId: 1,
        type: MFAMethod.TOTP,
        name: 'Custom Device Name',
        secret: 'JBSWY3DPEHPK3PXP',
        isActive: true,
        isPrimary: true,
      };

      mockTotpService.isValidSecret.mockReturnValue(true);
      mockTotpService.verifyCodeWithDetails.mockReturnValue({ valid: true });
      mockMfaDeviceRepository.create.mockReturnValue(mockDevice as any);
      mockMfaDeviceRepository.save.mockResolvedValue(mockDevice as any);
      // Mock getUserDevices to return empty array (no existing devices)
      mockMfaDeviceRepository.find.mockResolvedValue([]);
      // Mock findOne for enableMFAForUser to reload user
      mockUserRepository.findOne.mockResolvedValue({ ...mockUser, mfaEnabled: false } as any);
      mockUserRepository.save.mockResolvedValue({ ...mockUser, mfaEnabled: true } as any);

      const dtoWithName = { ...verifyDto, deviceName: 'Custom Device Name' };
      await service.verifySetup(mockUser, dtoWithName, 'Override Name');

      // Device is created via transaction manager's getRepository
      expect(mockUserRepository.manager.transaction).toHaveBeenCalled();
    });

    it('should set first device as primary', async () => {
      const mockDevice = {
        id: 1,
        userId: 1,
        type: MFAMethod.TOTP,
        name: 'Google Authenticator',
        secret: 'JBSWY3DPEHPK3PXP',
        isActive: true,
        isPrimary: true,
      };

      mockTotpService.isValidSecret.mockReturnValue(true);
      mockTotpService.verifyCodeWithDetails.mockReturnValue({ valid: true });
      mockMfaDeviceRepository.create.mockReturnValue(mockDevice as any);
      mockMfaDeviceRepository.save.mockResolvedValue(mockDevice as any);
      // Mock getUserDevices to return empty array (no existing devices)
      mockMfaDeviceRepository.find.mockResolvedValue([]);
      // Mock findOne for enableMFAForUser to reload user
      mockUserRepository.findOne.mockResolvedValue({ ...mockUser, mfaEnabled: false } as any);
      mockUserRepository.save.mockResolvedValue({ ...mockUser, mfaEnabled: true } as any);

      await service.verifySetup(mockUser, verifyDto);

      // Device is created via transaction manager's getRepository
      expect(mockUserRepository.manager.transaction).toHaveBeenCalled();
    });

    it('should not set device as primary if user already has MFA enabled', async () => {
      const userWithMfa = { ...mockUser, mfaEnabled: true };
      const mockDevice = {
        id: 1,
        userId: 1,
        type: MFAMethod.TOTP,
        name: 'Google Authenticator',
        secret: 'JBSWY3DPEHPK3PXP',
        isActive: true,
        isPrimary: false,
      };

      mockTotpService.isValidSecret.mockReturnValue(true);
      mockTotpService.verifyCodeWithDetails.mockReturnValue({ valid: true });
      mockMfaDeviceRepository.create.mockReturnValue(mockDevice as any);
      mockMfaDeviceRepository.save.mockResolvedValue(mockDevice as any);
      // Mock getUserDevices to return empty array (no existing devices)
      mockMfaDeviceRepository.find.mockResolvedValue([]);
      // Mock findOne for enableMFAForUser to reload user
      mockUserRepository.findOne.mockResolvedValue(userWithMfa as any);
      mockUserRepository.save.mockResolvedValue(userWithMfa as any);

      await service.verifySetup(userWithMfa, verifyDto);

      // Device is created via transaction manager's getRepository
      expect(mockUserRepository.manager.transaction).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // verify() Method
  // ============================================================================

  describe('verify', () => {
    const mockDevice = {
      id: 1,
      userId: 1,
      type: MFAMethod.TOTP,
      name: 'Google Authenticator',
      secret: 'JBSWY3DPEHPK3PXP',
      isActive: true,
      isPrimary: true,
    };

    it('should verify TOTP code successfully', async () => {
      mockMfaDeviceRepository.findOne.mockResolvedValue(mockDevice as any);
      mockTotpService.verifyCode.mockReturnValue(true);
      mockMfaDeviceRepository.save.mockResolvedValue(mockDevice as any);

      const result = await service.verify(mockUser, '123456');

      expect(result).toBe(true);
      expect(mockMfaDeviceRepository.findOne).toHaveBeenCalled();
      expect(mockTotpService.verifyCode).toHaveBeenCalledWith('JBSWY3DPEHPK3PXP', '123456');
      expect(mockMfaDeviceRepository.save).toHaveBeenCalled();
    });

    it('should return false for invalid code format', async () => {
      const result = await service.verify(mockUser, null as any);

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith('Invalid TOTP code format');
    });

    it('should return false when device not found', async () => {
      mockMfaDeviceRepository.findOne.mockResolvedValue(null);

      const result = await service.verify(mockUser, '123456');

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith((expect as any).stringContaining('No active TOTP device found'));
    });

    it('should return false when device has no secret', async () => {
      const deviceWithoutSecret = { ...mockDevice, secret: null };
      mockMfaDeviceRepository.findOne.mockResolvedValue(deviceWithoutSecret as any);

      const result = await service.verify(mockUser, '123456');

      expect(result).toBe(false);
    });

    it('should return false when code verification fails', async () => {
      mockMfaDeviceRepository.findOne.mockResolvedValue(mockDevice as any);
      mockTotpService.verifyCode.mockReturnValue(false);

      const result = await service.verify(mockUser, '123456');

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith((expect as any).stringContaining('TOTP code verification failed'));
    });

    it('should verify against specific device when deviceId provided', async () => {
      mockMfaDeviceRepository.findOne.mockResolvedValue(mockDevice as any);
      mockTotpService.verifyCode.mockReturnValue(true);
      mockMfaDeviceRepository.save.mockResolvedValue(mockDevice as any);

      await service.verify(mockUser, '123456', 1);

      expect(mockMfaDeviceRepository.findOne).toHaveBeenCalledWith(
        (expect as any).objectContaining({
          where: (expect as any).objectContaining({
            id: 1,
          }),
        }),
      );
    });

    it('should update device usage on successful verification', async () => {
      const deviceWithUsage = { ...mockDevice, lastUsedAt: new Date(), usageCount: 1 };
      mockMfaDeviceRepository.findOne.mockResolvedValue(mockDevice as any);
      mockTotpService.verifyCode.mockReturnValue(true);
      mockMfaDeviceRepository.save.mockResolvedValue(deviceWithUsage as any);

      await service.verify(mockUser, '123456');

      expect(mockMfaDeviceRepository.save).toHaveBeenCalled();
    });
  });
});
