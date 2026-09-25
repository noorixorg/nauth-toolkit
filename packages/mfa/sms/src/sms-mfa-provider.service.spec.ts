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
  AuthAuditEventType,
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
      find: jest.fn().mockResolvedValue([]),
      delete: jest.fn(),
    } as any;

    mockUserRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    } as any;

    mockPhoneVerificationService = {
      sendVerificationSMS: jest.fn().mockResolvedValue(undefined),
      verifyPhoneWithCodeBySub: jest.fn().mockResolvedValue(undefined),
      setPhoneAndSendVerification: jest.fn().mockResolvedValue({ tokenId: 'token-id', phoneChanged: false }),
    } as any;

    mockChallengeService = {} as any;
    mockAuditService = { recordEvent: jest.fn().mockResolvedValue(undefined) } as any;
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

    it('should throw PHONE_REQUIRED and make no service calls when no phone is supplied and none is on file', async () => {
      const userWithoutPhone = { ...mockUser, phone: undefined };
      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', userWithoutPhone);
        await expect(service.setup()).rejects.toMatchObject({ code: AuthErrorCode.PHONE_REQUIRED });
      });
      expect(mockPhoneVerificationService.sendVerificationSMS).not.toHaveBeenCalled();
      expect(mockPhoneVerificationService.setPhoneAndSendVerification).not.toHaveBeenCalled();
    });

    it('should auto-complete setup when supplied phone equals the current verified phone', async () => {
      const verifiedUser = { ...mockUser, isPhoneVerified: true };
      (service as any).verifySetup = jest.fn().mockResolvedValue(123);
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(verifiedUser);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', verifiedUser);
        const result = await service.setup({ phoneNumber: '+1234567890' });
        expect(result).toEqual({ deviceId: 123, autoCompleted: true });
      });

      expect((service as any).verifySetup).toHaveBeenCalledWith({ code: '' }, undefined);
      expect(mockPhoneVerificationService.setPhoneAndSendVerification).not.toHaveBeenCalled();
      expect(mockPhoneVerificationService.sendVerificationSMS).not.toHaveBeenCalled();
    });

    it('should auto-complete setup when no phone is supplied and the phone on file is verified', async () => {
      const verifiedUser = { ...mockUser, isPhoneVerified: true };
      (service as any).verifySetup = jest.fn().mockResolvedValue(456);
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(verifiedUser);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', verifiedUser);
        const result = await service.setup();
        expect(result).toEqual({ deviceId: 456, autoCompleted: true });
      });
    });

    it('should NOT auto-complete when the supplied phone differs from the current verified phone', async () => {
      const verifiedUser = { ...mockUser, phone: '+1111111111', isPhoneVerified: true, id: 1 };
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(verifiedUser);
      (service as any).maskPhone = jest.fn((phone: string) => `masked:${phone}`);
      mockPhoneVerificationService.setPhoneAndSendVerification = jest
        .fn()
        .mockResolvedValue({ tokenId: 'token-id', phoneChanged: true });

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', verifiedUser);
        const result = await service.setup({ phoneNumber: '+222 222 2222', challengeSessionId: 99 });
        expect(result).toEqual({ maskedPhone: 'masked:+2222222222' });
      });

      expect(mockPhoneVerificationService.setPhoneAndSendVerification).toHaveBeenCalledWith(
        expect.objectContaining({ sub: verifiedUser.sub, phone: '+2222222222', challengeSessionId: 99 }),
      );
    });

    it('should send through setPhoneAndSendVerification when the supplied phone equals the current unverified phone', async () => {
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);
      (service as any).maskPhone = jest.fn().mockReturnValue('***-***-7890');

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        const result = await service.setup({ phoneNumber: '+1234567890' });
        expect(mockPhoneVerificationService.setPhoneAndSendVerification).toHaveBeenCalledWith(
          expect.objectContaining({ sub: mockUser.sub, phone: '+1234567890' }),
        );
        expect(mockPhoneVerificationService.sendVerificationSMS).not.toHaveBeenCalled();
        expect(result).toEqual({ maskedPhone: '***-***-7890' });
      });

      // Number is unchanged, so phoneChanged is false and no device retirement should occur
      expect(mockMfaDeviceRepository.delete).not.toHaveBeenCalled();
    });

    it('should resend via sendVerificationSMS when no number is supplied and the phone on file is unverified', async () => {
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);
      (service as any).maskPhone = jest.fn().mockReturnValue('***-***-7890');

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        const result = await service.setup();
        expect(mockPhoneVerificationService.sendVerificationSMS).toHaveBeenCalledWith(
          expect.objectContaining({ sub: mockUser.sub }),
        );
        expect(mockPhoneVerificationService.setPhoneAndSendVerification).not.toHaveBeenCalled();
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

    describe('retiring SMS devices on phone change', () => {
      it('deletes active SMS devices, records an audit event, and disables MFA when none remain', async () => {
        const currentUser = { ...mockUser, phone: '+1111111111', isPhoneVerified: false, id: 1 };
        (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(currentUser);
        (service as any).maskPhone = jest.fn((phone: string) => `masked:${phone}`);
        mockPhoneVerificationService.setPhoneAndSendVerification = jest
          .fn()
          .mockResolvedValue({ tokenId: 'token-id', phoneChanged: true });
        mockMfaDeviceRepository.find = jest
          .fn()
          .mockResolvedValueOnce([{ id: 55 }])
          .mockResolvedValueOnce([]) as any;

        await ContextStorage.run(async () => {
          ContextStorage.set('CURRENT_USER', currentUser);
          const result = await service.setup({ phoneNumber: '+2222222222' });
          expect(result).toEqual({ maskedPhone: 'masked:+2222222222' });
        });

        expect(mockMfaDeviceRepository.delete).toHaveBeenCalledWith(55);
        expect(mockAuditService.recordEvent).toHaveBeenCalledWith(
          expect.objectContaining({ userId: 1, eventType: AuthAuditEventType.MFA_DEVICE_REMOVED }),
        );
        expect(mockUserRepository.update).toHaveBeenCalledWith(
          { id: 1 },
          { mfaEnabled: false, mfaMethods: [], preferredMfaMethod: null },
        );
      });

      it('does not disable MFA when other active devices remain after retiring SMS devices', async () => {
        const currentUser = { ...mockUser, phone: '+1111111111', isPhoneVerified: false, id: 1 };
        (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(currentUser);
        (service as any).maskPhone = jest.fn((phone: string) => `masked:${phone}`);
        mockPhoneVerificationService.setPhoneAndSendVerification = jest
          .fn()
          .mockResolvedValue({ tokenId: 'token-id', phoneChanged: true });
        mockMfaDeviceRepository.find = jest
          .fn()
          .mockResolvedValueOnce([{ id: 55 }])
          .mockResolvedValueOnce([{ id: 99 }]) as any;

        await ContextStorage.run(async () => {
          ContextStorage.set('CURRENT_USER', currentUser);
          await service.setup({ phoneNumber: '+2222222222' });
        });

        expect(mockMfaDeviceRepository.delete).toHaveBeenCalledWith(55);
        expect(mockUserRepository.update).not.toHaveBeenCalled();
      });

      it('does nothing when no active SMS devices exist', async () => {
        const currentUser = { ...mockUser, phone: '+1111111111', isPhoneVerified: false, id: 1 };
        (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(currentUser);
        (service as any).maskPhone = jest.fn((phone: string) => `masked:${phone}`);
        mockPhoneVerificationService.setPhoneAndSendVerification = jest
          .fn()
          .mockResolvedValue({ tokenId: 'token-id', phoneChanged: true });
        mockMfaDeviceRepository.find = jest.fn().mockResolvedValue([]) as any;

        await ContextStorage.run(async () => {
          ContextStorage.set('CURRENT_USER', currentUser);
          await service.setup({ phoneNumber: '+2222222222' });
        });

        expect(mockMfaDeviceRepository.delete).not.toHaveBeenCalled();
        expect(mockAuditService.recordEvent).not.toHaveBeenCalled();
        expect(mockUserRepository.update).not.toHaveBeenCalled();
      });
    });
  });

  describe('verifySetup', () => {
    it('should skip code verification when phone is already verified', async () => {
      const verifiedUser = { ...mockUser, isPhoneVerified: true, id: 1 };
      const mockDevice = { id: 123, phoneNumber: '+1234567890', isActive: true } as BaseMFADevice;
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(verifiedUser);
      (service as any).createDevice = jest.fn().mockResolvedValue(mockDevice);
      (service as any).enableMFAForUser = jest.fn().mockResolvedValue(undefined);
      mockUserRepository.findOne.mockResolvedValue({ id: 1, phone: '+1234567890' } as any);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', verifiedUser);
        const result = await service.verifySetup({ phoneNumber: '+1234567890', code: '' });
        expect(result).toBe(123);
        expect(mockPhoneVerificationService.verifyPhoneWithCodeBySub).not.toHaveBeenCalled();
      });
    });

    it('should verify phone code when phone is not verified', async () => {
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);
      const mockDevice = { id: 123, phoneNumber: '+1234567890', isActive: true } as BaseMFADevice;
      (service as any).createDevice = jest.fn().mockResolvedValue(mockDevice);
      (service as any).enableMFAForUser = jest.fn().mockResolvedValue(undefined);
      mockUserRepository.findOne.mockResolvedValue({ id: 1, phone: '+1234567890' } as any);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        const result = await service.verifySetup({ phoneNumber: '+1234567890', code: '123456' });
        expect(mockPhoneVerificationService.verifyPhoneWithCodeBySub).toHaveBeenCalled();
        expect(result).toBe(123);
      });
    });

    it('should forward challengeSessionId into VerifyPhoneWithCodeBySubDTO', async () => {
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);
      const mockDevice = { id: 123, phoneNumber: '+1234567890', isActive: true } as BaseMFADevice;
      (service as any).createDevice = jest.fn().mockResolvedValue(mockDevice);
      (service as any).enableMFAForUser = jest.fn().mockResolvedValue(undefined);
      mockUserRepository.findOne.mockResolvedValue({ id: 1, phone: '+1234567890' } as any);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        await service.verifySetup({ code: '123456', challengeSessionId: 789 });
        expect(mockPhoneVerificationService.verifyPhoneWithCodeBySub).toHaveBeenCalledWith(
          expect.objectContaining({ sub: mockUser.sub, code: '123456', challengeSessionId: 789 }),
        );
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
    it('should forward challengeSessionId into setPhoneAndSendVerification when a phone number is supplied', async () => {
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);
      (service as any).maskPhone = jest.fn().mockReturnValue('***-***-7890');

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        await service.setup({ phoneNumber: '+1234567890', challengeSessionId: 123 });
        expect(mockPhoneVerificationService.setPhoneAndSendVerification).toHaveBeenCalledWith(
          expect.objectContaining({ challengeSessionId: 123 }),
        );
      });
    });

    it('should forward challengeSessionId into sendVerificationSMS when no phone number is supplied', async () => {
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);
      (service as any).maskPhone = jest.fn().mockReturnValue('***-***-7890');

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        await service.setup({ challengeSessionId: 456 });
        expect(mockPhoneVerificationService.sendVerificationSMS).toHaveBeenCalledWith(
          expect.objectContaining({ challengeSessionId: 456 }),
        );
      });
    });

    it('should debug-log when challengeSessionId is provided', async () => {
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);
      (service as any).maskPhone = jest.fn().mockReturnValue('***-***-7890');

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        await service.setup({ phoneNumber: '+1234567890', challengeSessionId: 123 });
        expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('challengeSessionId=123'));
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

    it('wraps a non-NAuthException error from verifyPhoneWithCodeBySub as VERIFICATION_CODE_INVALID', async () => {
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);
      mockPhoneVerificationService.verifyPhoneWithCodeBySub.mockRejectedValue(new Error('Invalid code'));

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        await expect(service.verifySetup({ phoneNumber: '+1234567890', code: '123456' })).rejects.toMatchObject({
          code: AuthErrorCode.VERIFICATION_CODE_INVALID,
        });
        expect(mockLogger.error).toHaveBeenCalled();
      });
    });

    it('propagates an NAuthException from verifyPhoneWithCodeBySub unchanged (e.g. VERIFICATION_CODE_EXPIRED)', async () => {
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);
      const expiredError = new NAuthException(AuthErrorCode.VERIFICATION_CODE_EXPIRED, 'Code expired');
      mockPhoneVerificationService.verifyPhoneWithCodeBySub.mockRejectedValue(expiredError);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        await expect(service.verifySetup({ phoneNumber: '+1234567890', code: '123456' })).rejects.toMatchObject({
          code: AuthErrorCode.VERIFICATION_CODE_EXPIRED,
        });
      });
    });

    it('propagates an NAuthException from verifyPhoneWithCodeBySub unchanged (e.g. VERIFICATION_TOO_MANY_ATTEMPTS)', async () => {
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);
      const tooManyAttemptsError = new NAuthException(
        AuthErrorCode.VERIFICATION_TOO_MANY_ATTEMPTS,
        'Too many attempts',
      );
      mockPhoneVerificationService.verifyPhoneWithCodeBySub.mockRejectedValue(tooManyAttemptsError);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        await expect(service.verifySetup({ phoneNumber: '+1234567890', code: '123456' })).rejects.toMatchObject({
          code: AuthErrorCode.VERIFICATION_TOO_MANY_ATTEMPTS,
        });
      });
    });

    it('binds the device to the reloaded account phone, not the stale phone on the context user', async () => {
      const staleContextUser = { ...mockUser, phone: '+1111111111', isPhoneVerified: true, id: 1 };
      const mockDevice = { id: 321, phoneNumber: '+2222222222', isActive: true } as BaseMFADevice;
      const createDeviceSpy = jest.fn().mockResolvedValue(mockDevice);
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(staleContextUser);
      (service as any).createDevice = createDeviceSpy;
      (service as any).enableMFAForUser = jest.fn().mockResolvedValue(undefined);
      mockUserRepository.findOne.mockResolvedValue({ id: 1, phone: '+2222222222' } as any);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', staleContextUser);
        await service.verifySetup({ code: '' });
      });

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(createDeviceSpy).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ phoneNumber: '+2222222222' }),
        expect.anything(),
      );
    });

    it('throws PHONE_REQUIRED when the reloaded user has no phone', async () => {
      const verifiedUser = { ...mockUser, isPhoneVerified: true, id: 1 };
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(verifiedUser);
      mockUserRepository.findOne.mockResolvedValue({ id: 1, phone: null } as any);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', verifiedUser);
        await expect(service.verifySetup({ code: '' })).rejects.toMatchObject({
          code: AuthErrorCode.PHONE_REQUIRED,
        });
      });
    });

    it('throws VALIDATION_FAILED when the supplied phoneNumber differs from the reloaded account phone', async () => {
      const verifiedUser = { ...mockUser, isPhoneVerified: true, id: 1 };
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(verifiedUser);
      mockUserRepository.findOne.mockResolvedValue({ id: 1, phone: '+1234567890' } as any);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', verifiedUser);
        await expect(service.verifySetup({ phoneNumber: '+9999999999', code: '' })).rejects.toMatchObject({
          code: AuthErrorCode.VALIDATION_FAILED,
        });
      });
    });

    it('realigns a deduped device that has a stale phone number or is inactive', async () => {
      const verifiedUser = { ...mockUser, isPhoneVerified: true, id: 1 };
      const dedupedDevice = { id: 55, phoneNumber: '+0000000000', isActive: false } as BaseMFADevice;
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(verifiedUser);
      (service as any).createDevice = jest.fn().mockResolvedValue(dedupedDevice);
      (service as any).enableMFAForUser = jest.fn().mockResolvedValue(undefined);
      mockUserRepository.findOne.mockResolvedValue({ id: 1, phone: '+1234567890' } as any);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', verifiedUser);
        const result = await service.verifySetup({ code: '' });
        expect(result).toBe(55);
      });

      expect(mockMfaDeviceRepository.update).toHaveBeenCalledWith(55, {
        phoneNumber: '+1234567890',
        isActive: true,
      });
    });

    it('does not update the device when it already matches the account phone and is active', async () => {
      const verifiedUser = { ...mockUser, isPhoneVerified: true, id: 1 };
      const matchingDevice = { id: 77, phoneNumber: '+1234567890', isActive: true } as BaseMFADevice;
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(verifiedUser);
      (service as any).createDevice = jest.fn().mockResolvedValue(matchingDevice);
      (service as any).enableMFAForUser = jest.fn().mockResolvedValue(undefined);
      mockUserRepository.findOne.mockResolvedValue({ id: 1, phone: '+1234567890' } as any);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', verifiedUser);
        await service.verifySetup({ code: '' });
      });

      expect(mockMfaDeviceRepository.update).not.toHaveBeenCalled();
    });
  });
});
