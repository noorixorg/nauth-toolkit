/**
 * Register MFA Providers Unit Tests
 *
 * Tests MFA provider registration functionality including:
 * - TOTP provider registration
 * - SMS provider registration
 * - Email provider registration
 * - Passkey provider registration
 * - Error handling for missing packages
 */

import { Repository } from 'typeorm';
import { registerMFAProviders } from './register-mfa';
import { NAuthConfig } from '../../interfaces/config.interface';
import {
  NAuthLogger,
  MFAService,
  EmailVerificationService,
  PhoneVerificationService,
  BaseMFADevice,
  BaseUser,
  HookRegistryService,
} from '../../index';
import { PasswordService, ChallengeService } from '../../internal';
import { AuthAuditService } from '../../services/auth-audit.service';
import { ClientInfoService } from '../../services/client-info.service';

// Mock dynamic imports
jest.mock(
  '@nauth-toolkit/mfa-totp',
  () => ({
    TOTPMFAProviderService: jest.fn(),
    TOTPService: jest.fn(),
  }),
  { virtual: true },
);

jest.mock(
  '@nauth-toolkit/mfa-sms',
  () => ({
    SMSMFAProviderService: jest.fn(),
  }),
  { virtual: true },
);

jest.mock(
  '@nauth-toolkit/mfa-email',
  () => ({
    EmailMFAProviderService: jest.fn(),
  }),
  { virtual: true },
);

jest.mock(
  '@nauth-toolkit/mfa-passkey',
  () => ({
    PasskeyMFAProviderService: jest.fn(),
    PasskeyService: jest.fn(),
  }),
  { virtual: true },
);

/* eslint-disable @typescript-eslint/no-var-requires */
const totpModule = require('@nauth-toolkit/mfa-totp') as { TOTPMFAProviderService: jest.Mock };
const smsModule = require('@nauth-toolkit/mfa-sms') as { SMSMFAProviderService: jest.Mock };
const emailModule = require('@nauth-toolkit/mfa-email') as { EmailMFAProviderService: jest.Mock };
const passkeyModule = require('@nauth-toolkit/mfa-passkey') as { PasskeyMFAProviderService: jest.Mock };
/* eslint-enable @typescript-eslint/no-var-requires */

describe('registerMFAProviders', () => {
  let mockConfig: NAuthConfig;
  let mockMfaService: jest.Mocked<MFAService>;
  let mockMfaDeviceRepository: jest.Mocked<Repository<BaseMFADevice>>;
  let mockUserRepository: jest.Mocked<Repository<BaseUser>>;
  let mockLogger: jest.Mocked<NAuthLogger>;
  let mockPasswordService: jest.Mocked<PasswordService>;
  let mockEmailVerificationService: jest.Mocked<EmailVerificationService>;
  let mockPhoneVerificationService: jest.Mocked<PhoneVerificationService>;
  let mockChallengeService: jest.Mocked<ChallengeService>;
  let mockAuditService: jest.Mocked<AuthAuditService>;
  let mockClientInfoService: jest.Mocked<ClientInfoService>;

  beforeEach(() => {
    totpModule.TOTPMFAProviderService.mockClear();
    smsModule.SMSMFAProviderService.mockClear();
    emailModule.EmailMFAProviderService.mockClear();
    passkeyModule.PasskeyMFAProviderService.mockClear();

    mockConfig = {
      jwt: {
        accessToken: { secret: 'test', expiresIn: 3600 },
        refreshToken: { secret: 'test', expiresIn: 86400 },
      },
      mfa: {
        enabled: true,
      },
    } as NAuthConfig;

    mockMfaService = {
      registerProvider: jest.fn(),
    } as any;

    mockMfaDeviceRepository = {} as any;
    mockUserRepository = {} as any;

    mockLogger = {
      warn: jest.fn(),
      debug: jest.fn(),
      log: jest.fn(),
      error: jest.fn(),
    } as any;

    mockPasswordService = {} as any;
    mockEmailVerificationService = {} as any;
    mockPhoneVerificationService = {} as any;
    mockChallengeService = {} as any;
    mockAuditService = {} as any;
    mockClientInfoService = {} as any;
  });

  it('should return early if MFA is not enabled', async () => {
    mockConfig.mfa = { enabled: false };

    await registerMFAProviders(
      mockConfig,
      mockMfaService,
      mockMfaDeviceRepository,
      mockUserRepository,
      mockLogger,
      mockPasswordService,
      mockEmailVerificationService,
      mockPhoneVerificationService,
      mockChallengeService,
      mockAuditService,
      mockClientInfoService,
    );

    expect(mockMfaService.registerProvider).not.toHaveBeenCalled();
  });

  it('should skip SMS MFA when phoneVerificationService is not provided', async () => {
    await registerMFAProviders(
      mockConfig,
      mockMfaService,
      mockMfaDeviceRepository,
      mockUserRepository,
      mockLogger,
      mockPasswordService,
      mockEmailVerificationService,
      undefined,
      mockChallengeService,
      mockAuditService,
      mockClientInfoService,
    );

    expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Phone verification service not configured'));
  });

  describe('hook registry wiring', () => {
    it('should pass the hook registry as the last constructor arg to every provider', async () => {
      const mockHookRegistry = { executeMFAFirstEnabled: jest.fn() } as unknown as HookRegistryService;

      await registerMFAProviders(
        mockConfig,
        mockMfaService,
        mockMfaDeviceRepository,
        mockUserRepository,
        mockLogger,
        mockPasswordService,
        mockEmailVerificationService,
        mockPhoneVerificationService,
        mockChallengeService,
        mockAuditService,
        mockClientInfoService,
        mockHookRegistry,
      );

      const mocks = [
        totpModule.TOTPMFAProviderService,
        smsModule.SMSMFAProviderService,
        emailModule.EmailMFAProviderService,
        passkeyModule.PasskeyMFAProviderService,
      ];
      for (const ctor of mocks) {
        expect(ctor).toHaveBeenCalledTimes(1);
        const args = ctor.mock.calls[0];
        expect(args).toHaveLength(10);
        expect(args[8]).toBe(mockClientInfoService);
        expect(args[9]).toBe(mockHookRegistry);
      }
      expect(mockMfaService.registerProvider).toHaveBeenCalledTimes(4);
    });

    it('should pass undefined as the last constructor arg when no hook registry is supplied', async () => {
      await registerMFAProviders(
        mockConfig,
        mockMfaService,
        mockMfaDeviceRepository,
        mockUserRepository,
        mockLogger,
        mockPasswordService,
        mockEmailVerificationService,
        mockPhoneVerificationService,
        mockChallengeService,
        mockAuditService,
        mockClientInfoService,
      );

      expect(totpModule.TOTPMFAProviderService.mock.calls[0][9]).toBeUndefined();
      expect(smsModule.SMSMFAProviderService.mock.calls[0][9]).toBeUndefined();
      expect(emailModule.EmailMFAProviderService.mock.calls[0][9]).toBeUndefined();
      expect(passkeyModule.PasskeyMFAProviderService.mock.calls[0][9]).toBeUndefined();
    });
  });
});
