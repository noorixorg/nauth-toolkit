/**
 * AuthService forgotPassword() - Social-only audit coverage
 *
 * Focused test suite to avoid coupling to the large legacy AuthService test file.
 * We only verify the new security requirement:
 * - When a social-only account (no passwordHash) requests forgot-password,
 *   we should NOT send a code, but SHOULD write an audit event for the user.
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
import { BaseLoginAttempt, BaseMFADevice, BaseUser } from '../entities';
import { ForgotPasswordDTO } from '../dto/forgot-password.dto';
import { AuthAuditEventType } from '../enums/auth-audit-event-type.enum';
import { LoggerService, NAuthConfig } from '../interfaces/config.interface';
import { NAuthLogger } from '../utils/nauth-logger';
import { IUser } from '../interfaces/entities.interface';

describe('AuthService.forgotPassword() (social-only audit)', () => {
  it('records PASSWORD_RESET_REQUESTED audit event for social-only account and does not send code', async () => {
    const mockUserRepository = {} as unknown as Repository<BaseUser>;
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
      requestReset: jest.fn(),
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
      mockAuditService,
      mockPhoneVerificationService,
      mockMfaService,
      mockMfaDeviceRepository,
      mockTrustedDeviceService,
      mockPasswordResetService,
    );

    const socialOnlyUser: IUser = {
      id: 2,
      sub: 'social-only-sub',
      email: 'social@example.com',
      passwordHash: null,
    } as unknown as IUser;

    // Avoid mocking TypeORM query builders: override the private lookup method.
    (service as unknown as { findUserByIdentifier: (id: string) => Promise<IUser | null> }).findUserByIdentifier =
      jest.fn().mockResolvedValue(socialOnlyUser);

    const dto = Object.assign(new ForgotPasswordDTO(), { identifier: 'social@example.com' });
    const res = await service.forgotPassword(dto);

    expect(res.success).toBe(true);
    expect(mockPasswordResetService.requestReset).not.toHaveBeenCalled();
    expect(mockAuditService.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: socialOnlyUser.id,
        eventType: AuthAuditEventType.PASSWORD_RESET_REQUESTED,
        eventStatus: 'SUSPICIOUS',
        reason: 'forgot_password_social_only',
      }),
    );
  });
});


