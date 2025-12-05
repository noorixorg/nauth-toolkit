import { Repository } from 'typeorm';
import { BaseMFAProviderService } from './mfa-base.service';
import { BaseMFADevice, BaseUser } from '../entities';
import { IUser } from '../interfaces/entities.interface';
import { NAuthConfig } from '../interfaces/config.interface';
import { NAuthLogger } from '../utils/nauth-logger';
import { NAuthException } from '../exceptions/nauth.exception';
import { AuthErrorCode } from '../enums/error-codes.enum';
import { MFAMethod } from '../enums/mfa-method.enum';
import { ChallengeService } from './challenge.service';
import { AuthAuditService } from './auth-audit.service';
import { ClientInfoService } from './client-info.service';

/**
 * Test implementation of BaseMFAProviderService
 */
class TestMFAProviderService extends BaseMFAProviderService {
  readonly methodName = 'test';

  async setup(user: IUser, _setupData?: unknown): Promise<unknown> {
    return { test: 'setup' };
  }

  async verifySetup(user: IUser, verificationData: unknown, deviceName?: string): Promise<number> {
    return 1;
  }

  async verify(user: IUser, code: unknown, deviceId?: number): Promise<boolean> {
    return true;
  }
}

/**
 * Base MFA Provider Service Unit Tests
 *
 * Tests shared functionality in BaseMFAProviderService including device management,
 * backup codes, and helper methods. Uses direct instantiation, no NestJS dependencies.
 */
describe('BaseMFAProviderService', () => {
  let service: TestMFAProviderService;
  let mockMfaDeviceRepository: jest.Mocked<Repository<BaseMFADevice>>;
  let mockUserRepository: jest.Mocked<Repository<BaseUser>>;
  let mockConfig: NAuthConfig;
  let mockLogger: NAuthLogger;
  let mockPasswordService: unknown;
  let mockChallengeService: jest.Mocked<ChallengeService>;
  let mockAuditService: jest.Mocked<AuthAuditService>;
  let mockClientInfoService: jest.Mocked<ClientInfoService>;
  let mockUser: IUser;

  beforeEach(() => {
    mockMfaDeviceRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
    } as any;

    mockUserRepository = {
      save: jest.fn(),
      findOne: jest.fn(),
    } as any;

    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as any;

    mockConfig = {
      mfa: {
        enabled: true,
        allowedMethods: [MFAMethod.TOTP as any],
      },
    } as NAuthConfig;

    mockPasswordService = {
      hashPassword: jest.fn().mockResolvedValue('hashed-password'),
      verifyPassword: jest.fn().mockResolvedValue(true),
    };

    mockChallengeService = {
      deleteUserChallengeSessions: jest.fn(),
    } as any;

    mockAuditService = {
      recordEvent: jest.fn(),
    } as any;

    mockClientInfoService = {
      getClientInfo: jest.fn().mockResolvedValue({
        ipAddress: '192.168.1.1',
        userAgent: 'test-agent',
      }),
    } as any;

    mockUser = {
      id: 1,
      sub: 'user-123',
      email: 'user@example.com',
      mfaEnabled: false,
    } as IUser;

    service = new TestMFAProviderService(
      mockMfaDeviceRepository,
      mockUserRepository,
      mockConfig,
      mockLogger,
      mockPasswordService,
      mockChallengeService,
      mockAuditService,
      mockClientInfoService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('isMethodAllowed', () => {
    it('should return true when method is in allowed methods', () => {
      mockConfig.mfa!.allowedMethods = ['test' as any];
      expect(service.isMethodAllowed()).toBe(true);
    });

    it('should return false when method is not in allowed methods', () => {
      mockConfig.mfa!.allowedMethods = [MFAMethod.TOTP as any];
      expect(service.isMethodAllowed()).toBe(false);
    });
  });

  describe('generateBackupCodes', () => {
    it('should generate backup codes', async () => {
      const codes = await service.generateBackupCodes(mockUser);

      expect(codes.length).toBe(10);
      expect(codes[0]).toMatch(/^[A-Z0-9]+$/);
      expect(mockUserRepository.save).toHaveBeenCalled();
    });

    it('should use custom code count from config', async () => {
      mockConfig.mfa!.backup = { codeCount: 5, codeLength: 8 };
      const codes = await service.generateBackupCodes(mockUser);

      expect(codes.length).toBe(5);
    });

    it('should throw error when password service is not available', async () => {
      const serviceWithoutPassword = new TestMFAProviderService(
        mockMfaDeviceRepository,
        mockUserRepository,
        mockConfig,
        mockLogger,
        undefined,
        mockChallengeService,
        mockAuditService,
        mockClientInfoService,
      );

      try {
        await serviceWithoutPassword.generateBackupCodes(mockUser);
        fail('Should have thrown NAuthException');
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthException);
        expect((error as NAuthException).code).toBe(AuthErrorCode.VALIDATION_FAILED);
      }
    });
  });

  describe('verifyBackupCode', () => {
    it('should verify and remove backup code', async () => {
      const userWithCodes = {
        ...mockUser,
        backupCodes: ['hashed-code-1', 'hashed-code-2'],
      };

      (mockPasswordService as any).verifyPassword.mockResolvedValueOnce(true);

      const result = await (service as any).verifyBackupCode(userWithCodes, 'code-1');

      expect(result).toBe(true);
      expect(mockUserRepository.save).toHaveBeenCalled();
    });

    it('should return false when no backup codes available', async () => {
      const result = await (service as any).verifyBackupCode(mockUser, 'code');

      expect(result).toBe(false);
    });

    it('should return false when code is invalid', async () => {
      const userWithCodes = {
        ...mockUser,
        backupCodes: ['hashed-code-1'],
      };

      (mockPasswordService as any).verifyPassword.mockResolvedValue(false);

      const result = await (service as any).verifyBackupCode(userWithCodes, 'invalid-code');

      expect(result).toBe(false);
    });
  });

  describe('generateRandomCode', () => {
    it('should generate random code of specified length', () => {
      const code = (service as any).generateRandomCode(8);

      expect(code.length).toBe(8);
      expect(code).toMatch(/^[A-Z0-9]+$/);
    });
  });

  describe('maskPhone', () => {
    it('should mask phone number', () => {
      const masked = (service as any).maskPhone('+1234567890');
      expect(masked).toBe('***-***-7890');
    });

    it('should return original phone if too short', () => {
      const masked = (service as any).maskPhone('123');
      expect(masked).toBe('123');
    });
  });

  describe('isMFARequired', () => {
    it('should return false when user is MFA exempt', async () => {
      const exemptUser = { ...mockUser, mfaExempt: true };
      const result = await (service as any).isMFARequired(exemptUser);
      expect(result).toBe(false);
    });

    it('should return false when MFA is not enabled', async () => {
      mockConfig.mfa!.enabled = false;
      const result = await (service as any).isMFARequired(mockUser);
      expect(result).toBe(false);
    });

    it('should return false when enforcement is OPTIONAL', async () => {
      mockConfig.mfa!.enforcement = 'OPTIONAL';
      const result = await (service as any).isMFARequired(mockUser);
      expect(result).toBe(false);
    });
  });
});
