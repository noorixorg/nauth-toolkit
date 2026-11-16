/**
 * Email MFA Provider Service Unit Tests
 */

import 'reflect-metadata';
import { Repository } from 'typeorm';
import { EmailMFAProviderService } from './email-mfa-provider.service';
import {
  BaseMFADevice,
  BaseUser,
  NAuthConfig,
  NAuthLogger,
  MFAMethod,
  ClientInfoService,
  EmailVerificationService,
  NAuthException,
  AuthErrorCode,
  IUser,
} from '@nauth-toolkit/core';
import { ChallengeService, AuthAuditService } from '@nauth-toolkit/core/internal';
import { ContextStorage } from '@nauth-toolkit/core';

describe('EmailMFAProviderService', () => {
  let service: EmailMFAProviderService;
  let mockConfig: NAuthConfig;
  let mockLogger: jest.Mocked<NAuthLogger>;
  let mockMfaDeviceRepository: jest.Mocked<Repository<BaseMFADevice>>;
  let mockUserRepository: jest.Mocked<Repository<BaseUser>>;
  let mockEmailVerificationService: jest.Mocked<EmailVerificationService>;
  let mockChallengeService: jest.Mocked<ChallengeService>;
  let mockAuditService: jest.Mocked<AuthAuditService>;
  let mockClientInfoService: jest.Mocked<ClientInfoService>;
  let mockUser: IUser;

  beforeEach(() => {
    mockConfig = {
      jwt: {
        accessToken: { secret: 'test', expiresIn: 3600 },
        refreshToken: { secret: 'test', expiresIn: 86400 },
      },
      mfa: {
        enabled: true,
        allowedMethods: ['email'],
      },
    } as NAuthConfig;

    mockLogger = {
      log: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as any;

    mockMfaDeviceRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
    } as any;

    mockUserRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
    } as any;

    mockEmailVerificationService = {
      sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
      sendMFAEmailCode: jest.fn().mockResolvedValue(undefined),
      verifyEmailWithCode: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockChallengeService = {} as any;
    mockAuditService = {} as any;
    mockClientInfoService = {} as any;

    mockUser = {
      id: 1,
      sub: 'user-123',
      email: 'user@example.com',
      mfaEnabled: false,
      isEmailVerified: false,
    } as IUser;

    service = new EmailMFAProviderService(
      mockMfaDeviceRepository,
      mockUserRepository,
      mockConfig,
      mockLogger,
      {},
      mockEmailVerificationService,
      mockChallengeService,
      mockAuditService,
      mockClientInfoService,
    );
  });

  describe('methodName', () => {
    it('should have correct method name', () => {
      expect(service.methodName).toBe(MFAMethod.EMAIL);
    });
  });

  describe('isMethodAllowed', () => {
    it('should return true when Email is enabled', () => {
      expect(service.isMethodAllowed()).toBe(true);
    });

    it('should return false when Email is not in allowedMethods', () => {
      mockConfig.mfa = { ...mockConfig.mfa!, allowedMethods: [] };
      expect(service.isMethodAllowed()).toBe(false);
    });
  });

  describe('setup', () => {
    it('should throw when Email MFA is not enabled', async () => {
      mockConfig.mfa!.allowedMethods = [];
      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        await expect(service.setup()).rejects.toThrow(NAuthException);
        try {
          await service.setup();
        } catch (e) {
          expect((e as NAuthException).code).toBe(AuthErrorCode.VALIDATION_FAILED);
        }
      });
    });

    it('should throw when email is not provided', async () => {
      const userWithoutEmail = { ...mockUser, email: undefined };
      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', userWithoutEmail);
        await expect(service.setup()).rejects.toThrow(NAuthException);
      });
    });

    it('should auto-complete setup when email is already verified', async () => {
      const verifiedUser = { ...mockUser, isEmailVerified: true };
      (service as any).verifySetup = jest.fn().mockResolvedValue(123);
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(verifiedUser);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', verifiedUser);
        const result = await service.setup({ email: 'user@example.com' });
        expect(result).toEqual({ deviceId: 123, autoCompleted: true });
      });
    });

    it('should send verification email when email is not verified', async () => {
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);
      (service as any).maskEmail = jest.fn().mockReturnValue('u***r@example.com');

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        const result = await service.setup({ email: 'user@example.com' });
        expect(mockEmailVerificationService.sendVerificationEmail).toHaveBeenCalled();
        expect(result).toEqual({ maskedEmail: 'u***r@example.com' });
      });
    });

    it('should throw when emailVerificationService is not available', async () => {
      const serviceWithoutEmailVerification = new EmailMFAProviderService(
        mockMfaDeviceRepository,
        mockUserRepository,
        mockConfig,
        mockLogger,
        {},
        undefined,
        mockChallengeService,
        mockAuditService,
        mockClientInfoService,
      );
      (serviceWithoutEmailVerification as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        await expect(serviceWithoutEmailVerification.setup({ email: 'user@example.com' })).rejects.toThrow(
          NAuthException,
        );
      });
    });
  });

  describe('verifySetup', () => {
    it('should throw when email is not provided', async () => {
      const userWithoutEmail = { ...mockUser, email: undefined };
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(userWithoutEmail);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', userWithoutEmail);
        await expect(service.verifySetup({ code: '123456' })).rejects.toThrow(NAuthException);
      });
    });

    it('should skip code verification when email is already verified', async () => {
      const verifiedUser = { ...mockUser, isEmailVerified: true, id: 1 };
      const mockDevice = { id: 123 } as BaseMFADevice;
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(verifiedUser);
      (service as any).createDevice = jest.fn().mockResolvedValue(mockDevice);
      (service as any).enableMFAForUser = jest.fn().mockResolvedValue(undefined);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', verifiedUser);
        const result = await service.verifySetup({ email: 'user@example.com', code: '' });
        expect(result).toBe(123);
        expect(mockEmailVerificationService.verifyEmailWithCode).not.toHaveBeenCalled();
      });
    });

    it('should verify email code when email is not verified', async () => {
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);
      const mockDevice = { id: 123 } as BaseMFADevice;
      (service as any).createDevice = jest.fn().mockResolvedValue(mockDevice);
      (service as any).enableMFAForUser = jest.fn().mockResolvedValue(undefined);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        const result = await service.verifySetup({ email: 'user@example.com', code: '123456' });
        expect(mockEmailVerificationService.verifyEmailWithCode).toHaveBeenCalled();
        expect(result).toBe(123);
      });
    });

    it('should throw when code is missing for unverified email', async () => {
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        await expect(service.verifySetup({ email: 'user@example.com', code: '' })).rejects.toThrow(NAuthException);
      });
    });
  });

  describe('verify', () => {
    it('should return false when emailVerificationService is not available', async () => {
      const serviceWithoutEmailVerification = new EmailMFAProviderService(
        mockMfaDeviceRepository,
        mockUserRepository,
        mockConfig,
        mockLogger,
        {},
        undefined,
        mockChallengeService,
        mockAuditService,
        mockClientInfoService,
      );
      (serviceWithoutEmailVerification as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        const result = await serviceWithoutEmailVerification.verify('123456');
        expect(result).toBe(false);
      });
    });

    it('should return false when code is invalid format', async () => {
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        const result = await service.verify(null);
        expect(result).toBe(false);
      });
    });

    it('should verify email code successfully', async () => {
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);
      (service as any).findDevice = jest.fn().mockResolvedValue({ id: 1 } as BaseMFADevice);
      (service as any).updateDeviceUsage = jest.fn().mockResolvedValue(undefined);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        const result = await service.verify('123456');
        expect(mockEmailVerificationService.verifyEmailWithCode).toHaveBeenCalled();
        expect(result).toBe(true);
      });
    });

    it('should return false on verification failure', async () => {
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);
      mockEmailVerificationService.verifyEmailWithCode.mockRejectedValue(new Error('Invalid code'));

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        const result = await service.verify('123456');
        expect(result).toBe(false);
      });
    });

    it('should re-throw NAuthException on verification failure', async () => {
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);
      const error = new NAuthException(AuthErrorCode.VERIFICATION_CODE_INVALID, 'Invalid code');
      mockEmailVerificationService.verifyEmailWithCode.mockRejectedValue(error);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        await expect(service.verify('123456')).rejects.toThrow(NAuthException);
      });
    });
  });

  describe('sendChallenge', () => {
    it('should throw when no Email device is found', async () => {
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);
      (service as any).findDevice = jest.fn().mockResolvedValue(null);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        await expect(service.sendChallenge()).rejects.toThrow(NAuthException);
      });
    });

    it('should throw when email address is not found', async () => {
      const mockDevice = { id: 1, email: null } as BaseMFADevice;
      const userWithoutEmail = { ...mockUser, email: undefined };
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(userWithoutEmail);
      (service as any).findDevice = jest.fn().mockResolvedValue(mockDevice);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', userWithoutEmail);
        await expect(service.sendChallenge()).rejects.toThrow(NAuthException);
      });
    });

    it('should send email code and return masked email', async () => {
      const mockDevice = { id: 1, email: 'user@example.com' } as BaseMFADevice;
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);
      (service as any).findDevice = jest.fn().mockResolvedValue(mockDevice);
      (service as any).maskEmail = jest.fn().mockReturnValue('u***r@example.com');

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        const result = await service.sendChallenge();
        expect(mockEmailVerificationService.sendMFAEmailCode).toHaveBeenCalled();
        expect(result).toBe('u***r@example.com');
      });
    });
  });

  describe('lifecycle hooks (hook registry wiring)', () => {
    let mockHookRegistry: { executeMFAFirstEnabled: jest.Mock; executeMFAMethodAdded: jest.Mock };
    let hookedClientInfoService: { get: jest.Mock };
    let hookedService: EmailMFAProviderService;

    /** Build a provider that receives the hook registry as its last constructor arg. */
    function buildProvider(withRegistry: boolean): EmailMFAProviderService {
      return new EmailMFAProviderService(
        (service as any).mfaDeviceRepository,
        (service as any).userRepository,
        (service as any).config,
        (service as any).logger,
        {},
        mockEmailVerificationService,
        undefined,
        undefined,
        hookedClientInfoService as any,
        withRegistry ? (mockHookRegistry as any) : undefined,
      );
    }

    beforeEach(() => {
      mockHookRegistry = {
        executeMFAFirstEnabled: jest.fn().mockResolvedValue(undefined),
        executeMFAMethodAdded: jest.fn().mockResolvedValue(undefined),
      };
      hookedClientInfoService = {
        get: jest.fn().mockReturnValue({ ipAddress: '10.0.0.1', userAgent: 'jest', ipCountry: 'US', ipCity: 'NYC' }),
      };
      hookedService = buildProvider(true);
    });

    /** Stub repositories so enableMFAForUser sees `previousMethods` and the given active devices. */
    function stubUserState(
      mfaEnabled: boolean,
      previousMethods: string[] | null,
      devices: Array<Record<string, unknown>>,
    ): void {
      const userRepository = (service as any).userRepository;
      const deviceRepository = (service as any).mfaDeviceRepository;
      userRepository.findOne = jest
        .fn()
        .mockResolvedValue({ id: 1, sub: 'user-123', mfaEnabled, mfaMethods: previousMethods });
      userRepository.save = jest.fn().mockResolvedValue(undefined);
      deviceRepository.find = jest.fn().mockResolvedValue(devices);
    }

    it('fires executeMFAFirstEnabled when the first device enables MFA', async () => {
      stubUserState(false, null, [{ type: 'email', isActive: true, isPrimary: true }]);

      await (hookedService as any).enableMFAForUser({ id: 1, sub: 'user-123' });

      expect(mockHookRegistry.executeMFAFirstEnabled).toHaveBeenCalledTimes(1);
      expect(mockHookRegistry.executeMFAFirstEnabled).toHaveBeenCalledWith(
        expect.objectContaining({
          firstMethod: 'email',
          clientInfo: expect.objectContaining({ ipAddress: '10.0.0.1', userAgent: 'jest' }),
        }),
      );
      expect(mockHookRegistry.executeMFAMethodAdded).not.toHaveBeenCalled();
    });

    it('fires executeMFAMethodAdded when a new method is added to an account that already has MFA', async () => {
      stubUserState(
        true,
        ['totp'],
        [
          { type: 'totp', isActive: true, isPrimary: true },
          { type: 'email', isActive: true, isPrimary: false },
        ],
      );

      await (hookedService as any).enableMFAForUser({ id: 1, sub: 'user-123' });

      expect(mockHookRegistry.executeMFAMethodAdded).toHaveBeenCalledWith(
        expect.objectContaining({ method: 'email', isFirstMethod: false }),
      );
      expect(mockHookRegistry.executeMFAFirstEnabled).not.toHaveBeenCalled();
    });

    it('does not throw or fire hooks when no hook registry was supplied', async () => {
      const unhooked = buildProvider(false);
      stubUserState(false, null, [{ type: 'email', isActive: true, isPrimary: true }]);

      await expect((unhooked as any).enableMFAForUser({ id: 1, sub: 'user-123' })).resolves.toBeUndefined();

      expect(mockHookRegistry.executeMFAFirstEnabled).not.toHaveBeenCalled();
    });

    it('does not fail setup when the mfaFirstEnabled hook throws', async () => {
      mockHookRegistry.executeMFAFirstEnabled.mockRejectedValueOnce(new Error('listener boom'));
      stubUserState(false, null, [{ type: 'email', isActive: true, isPrimary: true }]);

      await expect((hookedService as any).enableMFAForUser({ id: 1, sub: 'user-123' })).resolves.toBeUndefined();
    });
  });
});
