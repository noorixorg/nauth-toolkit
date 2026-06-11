/**
 * SMS MFA Provider Service Unit Tests
 */

import 'reflect-metadata';
import { Repository } from 'typeorm';
import { SMSMFAProviderService } from './sms-mfa-provider.service';
import {
  BaseMFADevice,
  BaseUser,
  NAuthConfig,
  NAuthLogger,
  MFAMethod,
  ClientInfoService,
  PhoneVerificationService,
  NAuthException,
  AuthErrorCode,
  IUser,
  ContextStorage,
} from '@nauth-toolkit/core';
import { ChallengeService, AuthAuditService } from '@nauth-toolkit/core/internal';

describe('SMSMFAProviderService', () => {
  let service: SMSMFAProviderService;
  let mockConfig: NAuthConfig;
  let mockLogger: jest.Mocked<NAuthLogger>;
  let mockMfaDeviceRepository: jest.Mocked<Repository<BaseMFADevice>>;
  let mockUserRepository: jest.Mocked<Repository<BaseUser>>;
  let mockPhoneVerificationService: jest.Mocked<PhoneVerificationService>;
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
        allowedMethods: ['sms'],
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

    mockPhoneVerificationService = {
      sendVerificationSMS: jest.fn().mockResolvedValue(undefined),
      verifyPhoneWithCodeBySub: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockChallengeService = {} as any;
    mockAuditService = {} as any;
    mockClientInfoService = {} as any;

    mockUser = {
      id: 1,
      sub: 'user-123',
      email: 'user@example.com',
      phone: '+1234567890',
      mfaEnabled: false,
      isPhoneVerified: false,
    } as IUser;

    service = new SMSMFAProviderService(
      mockMfaDeviceRepository,
      mockUserRepository,
      mockConfig,
      mockLogger,
      {},
      mockPhoneVerificationService,
      mockChallengeService,
      mockAuditService,
      mockClientInfoService,
    );
  });

  describe('methodName', () => {
    it('should have correct method name', () => {
      expect(service.methodName).toBe(MFAMethod.SMS);
    });
  });

  describe('isMethodAllowed', () => {
    it('should return true when SMS is enabled', () => {
      expect(service.isMethodAllowed()).toBe(true);
    });

    it('should return false when SMS is not in allowedMethods', () => {
      mockConfig.mfa = { ...mockConfig.mfa!, allowedMethods: [] };
      expect(service.isMethodAllowed()).toBe(false);
    });
  });

  describe('setup', () => {
    it('should throw when SMS MFA is not enabled', async () => {
      mockConfig.mfa = { ...mockConfig.mfa!, allowedMethods: [] };
      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        await expect(service.setup()).rejects.toThrow(NAuthException);
      });
    });

    it('should throw when phone number is not provided', async () => {
      const userWithoutPhone = { ...mockUser, phone: undefined };
      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', userWithoutPhone);
        await expect(service.setup()).rejects.toThrow(NAuthException);
      });
    });

    it('should auto-complete setup when phone is already verified', async () => {
      const verifiedUser = { ...mockUser, isPhoneVerified: true };
      (service as any).verifySetup = jest.fn().mockResolvedValue(123);
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(verifiedUser);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', verifiedUser);
        const result = await service.setup({ phoneNumber: '+1234567890' });
        expect(result).toEqual({ deviceId: 123, autoCompleted: true });
      });
    });

    it('should send SMS verification code when phone is not verified', async () => {
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);
      (service as any).maskPhone = jest.fn().mockReturnValue('***-***-7890');

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        const result = await service.setup({ phoneNumber: '+1234567890' });
        expect(mockPhoneVerificationService.sendVerificationSMS).toHaveBeenCalled();
        expect(result).toEqual({ maskedPhone: '***-***-7890' });
      });
    });

    it('should throw when phoneVerificationService is not available', async () => {
      const serviceWithoutPhoneVerification = new SMSMFAProviderService(
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
      (serviceWithoutPhoneVerification as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        await expect(serviceWithoutPhoneVerification.setup({ phoneNumber: '+1234567890' })).rejects.toThrow(
          NAuthException,
        );
      });
    });
  });

  describe('verifySetup', () => {
    it('should skip code verification when phone is already verified', async () => {
      const verifiedUser = { ...mockUser, isPhoneVerified: true, id: 1 };
      const mockDevice = { id: 123 } as BaseMFADevice;
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(verifiedUser);
      (service as any).createDevice = jest.fn().mockResolvedValue(mockDevice);
      (service as any).enableMFAForUser = jest.fn().mockResolvedValue(undefined);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', verifiedUser);
        const result = await service.verifySetup({ phoneNumber: '+1234567890', code: '' });
        expect(result).toBe(123);
        expect(mockPhoneVerificationService.verifyPhoneWithCodeBySub).not.toHaveBeenCalled();
      });
    });

    it('should verify phone code when phone is not verified', async () => {
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);
      const mockDevice = { id: 123 } as BaseMFADevice;
      (service as any).createDevice = jest.fn().mockResolvedValue(mockDevice);
      (service as any).enableMFAForUser = jest.fn().mockResolvedValue(undefined);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        const result = await service.verifySetup({ phoneNumber: '+1234567890', code: '123456' });
        expect(mockPhoneVerificationService.verifyPhoneWithCodeBySub).toHaveBeenCalled();
        expect(result).toBe(123);
      });
    });

    it('should throw when code is missing for unverified phone', async () => {
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        await expect(service.verifySetup({ phoneNumber: '+1234567890', code: '' })).rejects.toThrow(NAuthException);
      });
    });
  });

  describe('verify', () => {
    it('should return false when phoneVerificationService is not available', async () => {
      const serviceWithoutPhoneVerification = new SMSMFAProviderService(
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
      (serviceWithoutPhoneVerification as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        const result = await serviceWithoutPhoneVerification.verify('123456');
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

    it('should verify SMS code successfully', async () => {
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);
      (service as any).findDevice = jest.fn().mockResolvedValue({ id: 1 } as BaseMFADevice);
      (service as any).updateDeviceUsage = jest.fn().mockResolvedValue(undefined);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        const result = await service.verify('123456');
        expect(mockPhoneVerificationService.verifyPhoneWithCodeBySub).toHaveBeenCalled();
        expect(result).toBe(true);
      });
    });

    it('should return false on verification failure', async () => {
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);
      mockPhoneVerificationService.verifyPhoneWithCodeBySub.mockRejectedValue(new Error('Invalid code'));

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        const result = await service.verify('123456');
        expect(result).toBe(false);
      });
    });

    it('should re-throw NAuthException on verification failure', async () => {
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);
      const error = new NAuthException(AuthErrorCode.VERIFICATION_CODE_INVALID, 'Invalid code');
      mockPhoneVerificationService.verifyPhoneWithCodeBySub.mockRejectedValue(error);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        await expect(service.verify('123456')).rejects.toThrow(NAuthException);
      });
    });
  });

  describe('sendChallenge', () => {
    it('should throw when no SMS device is found', async () => {
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);
      (service as any).findDevice = jest.fn().mockResolvedValue(null);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        await expect(service.sendChallenge()).rejects.toThrow(NAuthException);
      });
    });

    it('should throw when phone number is not found', async () => {
      const mockDevice = { id: 1, phoneNumber: null } as BaseMFADevice;
      const userWithoutPhone = { ...mockUser, phone: undefined };
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(userWithoutPhone);
      (service as any).findDevice = jest.fn().mockResolvedValue(mockDevice);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', userWithoutPhone);
        await expect(service.sendChallenge()).rejects.toThrow(NAuthException);
      });
    });

    it('should send SMS code and return masked phone', async () => {
      const mockDevice = { id: 1, phoneNumber: '+1234567890' } as BaseMFADevice;
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);
      (service as any).findDevice = jest.fn().mockResolvedValue(mockDevice);
      (service as any).maskPhone = jest.fn().mockReturnValue('***-***-7890');

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        const result = await service.sendChallenge();
        expect(mockPhoneVerificationService.sendVerificationSMS).toHaveBeenCalled();
        expect(result).toBe('***-***-7890');
      });
    });

    it('should use phone from user when device phoneNumber is null', async () => {
      const mockDevice = { id: 1, phoneNumber: null } as BaseMFADevice;
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);
      (service as any).findDevice = jest.fn().mockResolvedValue(mockDevice);
      (service as any).maskPhone = jest.fn().mockReturnValue('***-***-7890');

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        const result = await service.sendChallenge();
        expect(mockPhoneVerificationService.sendVerificationSMS).toHaveBeenCalled();
        expect(result).toBe('***-***-7890');
      });
    });

    it('should throw when phoneVerificationService is not available', async () => {
      const serviceWithoutPhoneVerification = new SMSMFAProviderService(
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
      const mockDevice = { id: 1, phoneNumber: '+1234567890' } as BaseMFADevice;
      (serviceWithoutPhoneVerification as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);
      (serviceWithoutPhoneVerification as any).findDevice = jest.fn().mockResolvedValue(mockDevice);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        await expect(serviceWithoutPhoneVerification.sendChallenge()).rejects.toThrow(NAuthException);
      });
    });

    it('should call sendVerificationSMS with skipAlreadyVerifiedCheck', async () => {
      const mockDevice = { id: 1, phoneNumber: '+1234567890' } as BaseMFADevice;
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);
      (service as any).findDevice = jest.fn().mockResolvedValue(mockDevice);
      (service as any).maskPhone = jest.fn().mockReturnValue('***-***-7890');

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        await service.sendChallenge();
        expect(mockPhoneVerificationService.sendVerificationSMS).toHaveBeenCalledWith(
          expect.objectContaining({ skipAlreadyVerifiedCheck: true }),
        );
      });
    });
  });

  describe('setup - challengeSessionId handling', () => {
    it('should link SMS verification to challenge session when provided', async () => {
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);
      (service as any).maskPhone = jest.fn().mockReturnValue('***-***-7890');

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        await service.setup({ phoneNumber: '+1234567890', challengeSessionId: 123 });
        expect(mockPhoneVerificationService.sendVerificationSMS).toHaveBeenCalledWith(
          expect.objectContaining({ challengeSessionId: 123 }),
        );
      });
    });

    it('should log warning when challengeSessionId is not provided', async () => {
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);
      (service as any).maskPhone = jest.fn().mockReturnValue('***-***-7890');

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        await service.setup({ phoneNumber: '+1234567890' });
        expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('No challengeSessionId provided'));
      });
    });
  });

  describe('verify - edge cases', () => {
    it('should handle deviceId parameter', async () => {
      const mockDevice = { id: 2 } as BaseMFADevice;
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);
      (service as any).findDevice = jest.fn().mockResolvedValue(mockDevice);
      (service as any).updateDeviceUsage = jest.fn().mockResolvedValue(undefined);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        const result = await service.verify('123456', 2);
        expect((service as any).findDevice).toHaveBeenCalledWith(1, 2);
        expect(result).toBe(true);
      });
    });

    it('should handle verification when device is not found', async () => {
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);
      (service as any).findDevice = jest.fn().mockResolvedValue(null);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        const result = await service.verify('123456', 999);
        expect(mockPhoneVerificationService.verifyPhoneWithCodeBySub).toHaveBeenCalled();
        expect(result).toBe(true);
      });
    });

    it('should handle non-NAuthException errors', async () => {
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);
      const error = new Error('Network error');
      (error as any).code = 'NETWORK_ERROR';
      mockPhoneVerificationService.verifyPhoneWithCodeBySub.mockRejectedValue(error);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        const result = await service.verify('123456');
        expect(result).toBe(false);
        expect(mockLogger.warn).toHaveBeenCalled();
      });
    });

    it('should log when phone is already verified during MFA', async () => {
      const verifiedUser = { ...mockUser, isPhoneVerified: true };
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(verifiedUser);
      (service as any).findDevice = jest.fn().mockResolvedValue({ id: 1 } as BaseMFADevice);
      (service as any).updateDeviceUsage = jest.fn().mockResolvedValue(undefined);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', verifiedUser);
        await service.verify('123456');
        expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('phone already verified'));
      });
    });
  });

  describe('verifySetup - edge cases', () => {
    it('should throw when phoneVerificationService is not available for unverified phone', async () => {
      const serviceWithoutPhoneVerification = new SMSMFAProviderService(
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
      (serviceWithoutPhoneVerification as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        await expect(
          serviceWithoutPhoneVerification.verifySetup({ phoneNumber: '+1234567890', code: '123456' }),
        ).rejects.toThrow(NAuthException);
      });
    });

    it('should handle verification error and throw with specific message', async () => {
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);
      mockPhoneVerificationService.verifyPhoneWithCodeBySub.mockRejectedValue(new Error('Invalid code'));

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        await expect(service.verifySetup({ phoneNumber: '+1234567890', code: '123456' })).rejects.toThrow(
          NAuthException,
        );
        expect(mockLogger.error).toHaveBeenCalled();
      });
    });
  });
});
