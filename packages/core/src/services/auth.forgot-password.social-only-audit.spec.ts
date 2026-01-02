/**
 * AuthService forgotPassword() - Social-only support coverage
 *
 * Focused test suite to avoid coupling to the large legacy AuthService test file.
 * We verify:
 * - Social-only accounts (no passwordHash) are allowed to use forgot-password to set their first password.
 */

import { Repository } from 'typeorm';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { JwtService } from './jwt.service';
import { SessionService } from './session.service';
import { ChallengeService } from './challenge.service';
import { AuthChallengeHelperService } from './auth-challenge-helper.service';
import { EmailVerificationService } from './email-verification.service';
import { ClientInfoService } from './client-info.service';
import { AccountLockoutStorageService } from '../storage/account-lockout-storage.service';
import { InternalAuthAuditService as AuthAuditService } from './auth-audit.service';
import { PhoneVerificationService } from './phone-verification.service';
import { MFAService } from './mfa.service';
import { TrustedDeviceService } from './trusted-device.service';
import { PasswordResetService } from './password-reset.service';
import { HookRegistryService } from './hook-registry.service';
import { BaseLoginAttempt, BaseMFADevice, BaseUser } from '../entities';
import { ForgotPasswordDTO } from '../dto/forgot-password.dto';
import { LoggerService, NAuthConfig } from '../interfaces/config.interface';
import { NAuthLogger } from '../utils/nauth-logger';
import { IUser } from '../interfaces/entities.interface';

describe('AuthService.forgotPassword() (social-only)', () => {
  it('allows social-only account to request reset code (first-password flow)', async () => {
    const socialOnlyUser: IUser = {
      id: 2,
      sub: 'social-only-sub',
      email: 'social@example.com',
      passwordHash: null,
      isEmailVerified: true,
    } as unknown as IUser;

    const mockQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(socialOnlyUser),
    };

    const mockUserRepository = {
      createQueryBuilder: jest.fn(() => mockQueryBuilder),
    } as unknown as Repository<BaseUser>;
    const mockLoginAttemptRepository = {} as unknown as Repository<BaseLoginAttempt>;
    const mockMfaDeviceRepository = {} as unknown as Repository<BaseMFADevice>;

    const mockPasswordService = {} as unknown as PasswordService;
    const mockJwtService = {} as unknown as JwtService;
    const mockSessionService = {} as unknown as SessionService;
    const mockChallengeService = {} as unknown as ChallengeService;
    const mockChallengeHelper = {} as unknown as AuthChallengeHelperService;
    const mockEmailVerificationService = {} as unknown as EmailVerificationService;
    const mockClientInfoService = {} as unknown as ClientInfoService;
    const mockAccountLockoutStorage = {} as unknown as AccountLockoutStorageService;
    const mockPhoneVerificationService = {} as unknown as PhoneVerificationService;
    const mockMfaService = {} as unknown as MFAService;
    const mockTrustedDeviceService = {} as unknown as TrustedDeviceService;

    const mockAuditService = {
      recordEvent: jest.fn().mockResolvedValue(null),
    } as unknown as AuthAuditService;

    const mockHookRegistry = {
      registerPreSignup: jest.fn(),
      registerAfterSignup: jest.fn(),
      executePreSignup: jest.fn().mockResolvedValue(undefined),
      executePostSignup: jest.fn().mockResolvedValue(undefined),
    } as unknown as HookRegistryService;

    const baseLogger: LoggerService = {
      log: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      verbose: jest.fn(),
    } as unknown as LoggerService;

    const mockLogger = new NAuthLogger({
      instance: baseLogger,
      enablePiiRedaction: false,
      logLevel: 'debug',
    });

    const mockPasswordResetService = {
      requestReset: jest.fn().mockResolvedValue({
        destination: 's***@example.com',
        deliveryMedium: 'email',
        expiresIn: 900,
      }),
    } as unknown as PasswordResetService;

    const mockConfig: NAuthConfig = {
      jwt: {
        algorithm: 'HS256',
        accessToken: { secret: 'test', expiresIn: 900 },
        refreshToken: { secret: 'test', expiresIn: 2592000, rotation: true, reuseDetection: true },
      },
      signup: { enabled: true, verificationMethod: 'none' },
      password: { historyCount: 5 },
    };

    const service = new AuthService(
      mockUserRepository,
      mockLoginAttemptRepository,
      mockPasswordService,
      mockJwtService,
      mockSessionService,
      mockChallengeService,
      mockChallengeHelper,
      mockEmailVerificationService,
      mockClientInfoService,
      mockAccountLockoutStorage,
      mockConfig,
      mockLogger,
      mockHookRegistry,
      mockAuditService,
      mockPhoneVerificationService,
      mockMfaService,
      mockMfaDeviceRepository,
      mockTrustedDeviceService,
      mockPasswordResetService,
    );

    const dto = Object.assign(new ForgotPasswordDTO(), { identifier: 'social@example.com' });
    const res = await service.forgotPassword(dto);

    expect(res.success).toBe(true);
    expect(mockPasswordResetService.requestReset).toHaveBeenCalledWith(socialOnlyUser, 'email');
  });
});


