/**
 * TOTP MFA Provider Service Unit Tests
 *
 * Tests TOTP MFA provider functionality.
 */

import 'reflect-metadata';
import { Repository } from 'typeorm';
import { TOTPMFAProviderService } from './totp-mfa-provider.service';
import { TOTPService } from './totp.service';
import { BaseMFADevice, BaseUser, NAuthConfig, NAuthLogger, MFAMethod, ClientInfoService } from '@nauth-toolkit/core';
import { ChallengeService, AuthAuditService } from '@nauth-toolkit/core/internal';

// Mock TOTPService
jest.mock('./totp.service');

describe('TOTPMFAProviderService', () => {
  let service: TOTPMFAProviderService;
  let mockMfaDeviceRepository: jest.Mocked<Repository<BaseMFADevice>>;
  let mockUserRepository: jest.Mocked<Repository<BaseUser>>;
  let mockConfig: NAuthConfig;
  let mockLogger: jest.Mocked<NAuthLogger>;
  let mockPasswordService: unknown;
  let mockTotpService: jest.Mocked<TOTPService>;
  let mockChallengeService: jest.Mocked<ChallengeService>;
  let mockAuditService: jest.Mocked<AuthAuditService>;
  let mockClientInfoService: jest.Mocked<ClientInfoService>;

  beforeEach(() => {
    mockMfaDeviceRepository = {} as any;
    mockUserRepository = {} as any;

    mockConfig = {
      jwt: {
        accessToken: { secret: 'test', expiresIn: 3600 },
        refreshToken: { secret: 'test', expiresIn: 86400 },
      },
      mfa: {
        enabled: true,
        allowedMethods: ['totp', 'sms', 'email', 'passkey'],
      },
    } as NAuthConfig;

    mockLogger = {
      log: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    } as any;

    mockPasswordService = {};
    mockTotpService = {
      generateSecret: jest.fn().mockResolvedValue({
        secret: 'JBSWY3DPEHPK3PXP',
        qrCode: 'data:image/png;base64,test',
        manualEntryKey: 'JBSWY3DPEHPK3PXP',
        issuer: 'TestApp',
        accountName: 'user@example.com',
      }),
      verifyCode: jest.fn().mockReturnValue(true),
    } as any;

    mockChallengeService = {} as any;
    mockAuditService = {} as any;
    mockClientInfoService = {} as any;

    service = new TOTPMFAProviderService(
      mockMfaDeviceRepository,
      mockUserRepository,
      mockConfig,
      mockLogger,
      mockPasswordService,
      mockTotpService,
      mockChallengeService,
      mockAuditService,
      mockClientInfoService,
    );
  });

  describe('methodName', () => {
    it('should have correct method name', () => {
      expect(service.methodName).toBe(MFAMethod.TOTP);
    });
  });

  describe('isMethodAllowed', () => {
    it('should return true when TOTP is enabled', () => {
      expect(service.isMethodAllowed()).toBe(true);
    });

    it('should return false when TOTP is disabled', () => {
      mockConfig.mfa = { ...mockConfig.mfa!, allowedMethods: [] };
      service = new TOTPMFAProviderService(
        mockMfaDeviceRepository,
        mockUserRepository,
        mockConfig,
        mockLogger,
        mockPasswordService,
        mockTotpService,
        mockChallengeService,
        mockAuditService,
        mockClientInfoService,
      );

      expect(service.isMethodAllowed()).toBe(false);
    });
  });

  describe('setup', () => {
    let mockUser: any;

    beforeEach(() => {
      mockUser = {
        id: 1,
        sub: 'user-123',
        email: 'user@example.com',
      };
    });

    it('should generate TOTP secret and QR code', async () => {
      const { ContextStorage } = require('@nauth-toolkit/core');
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        const result = await service.setup();

        expect(mockTotpService.generateSecret).toHaveBeenCalledWith('user@example.com');
        expect(result).toHaveProperty('secret');
        expect(result).toHaveProperty('qrCode');
      });
    });

    it('should throw when TOTP is not enabled', async () => {
      mockConfig.mfa = { ...mockConfig.mfa!, allowedMethods: [] };
      service = new TOTPMFAProviderService(
        mockMfaDeviceRepository,
        mockUserRepository,
        mockConfig,
        mockLogger,
        mockPasswordService,
        mockTotpService,
        mockChallengeService,
        mockAuditService,
        mockClientInfoService,
      );
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);

      const { ContextStorage } = require('@nauth-toolkit/core');
      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        await expect(service.setup()).rejects.toThrow();
      });
    });

    it('should log setup initiation', async () => {
      const { ContextStorage } = require('@nauth-toolkit/core');
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        await service.setup();
        expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('Setting up TOTP'));
      });
    });
  });

  describe('verifySetup', () => {
    let mockUser: any;

    beforeEach(() => {
      mockUser = {
        id: 1,
        sub: 'user-123',
        email: 'user@example.com',
        mfaEnabled: false,
      };
      mockTotpService.isValidSecret = jest.fn().mockReturnValue(true);
      mockTotpService.verifyCodeWithDetails = jest.fn().mockResolvedValue({ valid: true });
      (service as any).createDevice = jest.fn().mockResolvedValue({ id: 123 });
      (service as any).enableMFAForUser = jest.fn().mockResolvedValue(undefined);
    });

    it('should verify and create device', async () => {
      const { ContextStorage } = require('@nauth-toolkit/core');
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        const result = await service.verifySetup({
          secret: 'JBSWY3DPEHPK3PXP',
          code: '123456',
        });

        expect(mockTotpService.isValidSecret).toHaveBeenCalledWith('JBSWY3DPEHPK3PXP');
        expect(mockTotpService.verifyCodeWithDetails).toHaveBeenCalled();
        expect((service as any).createDevice).toHaveBeenCalled();
        expect(result).toBe(123);
      });
    });

    it('should throw when secret is invalid', async () => {
      mockTotpService.isValidSecret = jest.fn().mockReturnValue(false);
      const { ContextStorage } = require('@nauth-toolkit/core');
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        await expect(
          service.verifySetup({
            secret: 'invalid',
            code: '123456',
          }),
        ).rejects.toThrow();
      });
    });

    it('should throw when code is invalid', async () => {
      mockTotpService.verifyCodeWithDetails = jest.fn().mockResolvedValue({
        valid: false,
        error: 'Invalid code',
      });
      const { ContextStorage } = require('@nauth-toolkit/core');
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        await expect(
          service.verifySetup({
            secret: 'JBSWY3DPEHPK3PXP',
            code: '000000',
          }),
        ).rejects.toThrow();
      });
    });

    it('should use deviceName from DTO when provided', async () => {
      const { ContextStorage } = require('@nauth-toolkit/core');
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        await service.verifySetup(
          {
            secret: 'JBSWY3DPEHPK3PXP',
            code: '123456',
            deviceName: 'My Authenticator',
          },
          'Override Name',
        );

        expect((service as any).createDevice).toHaveBeenCalledWith(
          1,
          expect.objectContaining({ name: 'Override Name' }),
        );
      });
    });

    it('should use deviceName from DTO when parameter not provided', async () => {
      const { ContextStorage } = require('@nauth-toolkit/core');
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        await service.verifySetup({
          secret: 'JBSWY3DPEHPK3PXP',
          code: '123456',
          deviceName: 'My Authenticator',
        });

        expect((service as any).createDevice).toHaveBeenCalledWith(
          1,
          expect.objectContaining({ name: 'My Authenticator' }),
        );
      });
    });

    it('should use default device name when neither provided', async () => {
      const { ContextStorage } = require('@nauth-toolkit/core');
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        await service.verifySetup({
          secret: 'JBSWY3DPEHPK3PXP',
          code: '123456',
        });

        expect((service as any).createDevice).toHaveBeenCalledWith(
          1,
          expect.objectContaining({ name: 'Authenticator App' }),
        );
      });
    });

    it('should set isPrimary to true when user has no MFA enabled', async () => {
      const { ContextStorage } = require('@nauth-toolkit/core');
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        await service.verifySetup({
          secret: 'JBSWY3DPEHPK3PXP',
          code: '123456',
        });

        expect((service as any).createDevice).toHaveBeenCalledWith(1, expect.objectContaining({ isPrimary: true }));
      });
    });

    it('should set isPrimary to false when user already has MFA enabled', async () => {
      const userWithMFA = { ...mockUser, mfaEnabled: true };
      const { ContextStorage } = require('@nauth-toolkit/core');
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(userWithMFA);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', userWithMFA);
        await service.verifySetup({
          secret: 'JBSWY3DPEHPK3PXP',
          code: '123456',
        });

        expect((service as any).createDevice).toHaveBeenCalledWith(1, expect.objectContaining({ isPrimary: false }));
      });
    });

    it('should enable MFA for user', async () => {
      const { ContextStorage } = require('@nauth-toolkit/core');
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        await service.verifySetup({
          secret: 'JBSWY3DPEHPK3PXP',
          code: '123456',
        });

        expect((service as any).enableMFAForUser).toHaveBeenCalledWith(mockUser);
      });
    });

    it('should log completion', async () => {
      const { ContextStorage } = require('@nauth-toolkit/core');
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        await service.verifySetup({
          secret: 'JBSWY3DPEHPK3PXP',
          code: '123456',
        });

        expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('TOTP setup completed'));
      });
    });
  });

  describe('verify', () => {
    let mockUser: any;
    let mockDevice: any;

    beforeEach(() => {
      mockUser = {
        id: 1,
        sub: 'user-123',
        email: 'user@example.com',
      };
      mockDevice = {
        id: 1,
        secret: 'JBSWY3DPEHPK3PXP',
      };
      (service as any).findDevice = jest.fn().mockResolvedValue(mockDevice);
      (service as any).updateDeviceUsage = jest.fn().mockResolvedValue(undefined);
    });

    it('should verify TOTP code successfully', async () => {
      const { ContextStorage } = require('@nauth-toolkit/core');
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        const result = await service.verify('123456');

        expect((service as any).findDevice).toHaveBeenCalledWith(1, undefined);
        expect(mockTotpService.verifyCode).toHaveBeenCalledWith('JBSWY3DPEHPK3PXP', '123456');
        expect((service as any).updateDeviceUsage).toHaveBeenCalledWith(1);
        expect(result).toBe(true);
      });
    });

    it('should verify with specific deviceId', async () => {
      const { ContextStorage } = require('@nauth-toolkit/core');
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        await service.verify('123456', 2);

        expect((service as any).findDevice).toHaveBeenCalledWith(1, 2);
      });
    });

    it('should return false when code is invalid format', async () => {
      const { ContextStorage } = require('@nauth-toolkit/core');
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        const result = await service.verify(null);

        expect(result).toBe(false);
        expect(mockLogger.warn).toHaveBeenCalled();
      });
    });

    it('should return false when code is not a string', async () => {
      const { ContextStorage } = require('@nauth-toolkit/core');
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        const result = await service.verify(123456 as any);

        expect(result).toBe(false);
      });
    });

    it('should return false when device is not found', async () => {
      (service as any).findDevice = jest.fn().mockResolvedValue(null);
      const { ContextStorage } = require('@nauth-toolkit/core');
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        const result = await service.verify('123456');

        expect(result).toBe(false);
        expect(mockLogger.warn).toHaveBeenCalled();
      });
    });

    it('should return false when device has no secret', async () => {
      (service as any).findDevice = jest.fn().mockResolvedValue({ id: 1, secret: null });
      const { ContextStorage } = require('@nauth-toolkit/core');
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        const result = await service.verify('123456');

        expect(result).toBe(false);
      });
    });

    it('should return false when code verification fails', async () => {
      mockTotpService.verifyCode = jest.fn().mockResolvedValue(false);
      const { ContextStorage } = require('@nauth-toolkit/core');
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        const result = await service.verify('000000');

        expect(result).toBe(false);
        expect(mockLogger.warn).toHaveBeenCalled();
      });
    });

    it('should not update device usage when verification fails', async () => {
      mockTotpService.verifyCode = jest.fn().mockResolvedValue(false);
      const { ContextStorage } = require('@nauth-toolkit/core');
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        await service.verify('000000');

        expect((service as any).updateDeviceUsage).not.toHaveBeenCalled();
      });
    });

    it('should log success when verification succeeds', async () => {
      const { ContextStorage } = require('@nauth-toolkit/core');
      (service as any).getCurrentUserOrThrow = jest.fn().mockReturnValue(mockUser);

      await ContextStorage.run(async () => {
        ContextStorage.set('CURRENT_USER', mockUser);
        await service.verify('123456');

        expect(mockLogger.log).toHaveBeenCalledWith(expect.stringContaining('verified successfully'));
      });
    });
  });
});
