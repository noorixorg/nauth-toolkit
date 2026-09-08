/**
 * AuthService forgot-password - locked account coverage
 *
 * Focused test suite to avoid coupling to the large legacy AuthService test file.
 * We verify:
 * - A permanently locked account (admin disableUser, lockedUntil === null) is skipped by
 *   forgotPassword without sending, while still returning the non-enumerating success.
 * - A temporarily locked account (failed-login lockout, lockedUntil in the future) is still
 *   served, because a password reset is the intended recovery path for it.
 * - confirmForgotPassword refuses a permanently locked account with ACCOUNT_LOCKED, and only
 *   after the reset code has been verified, so the lock is never disclosed to a caller who
 *   does not hold the code.
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
import { ConfirmForgotPasswordDTO } from '../dto/confirm-forgot-password.dto';
import { LoggerService, NAuthConfig } from '../interfaces/config.interface';
import { NAuthLogger } from '../utils/nauth-logger';
import { IUser } from '../interfaces/entities.interface';
import { NAuthException } from '../exceptions/nauth.exception';
import { AuthErrorCode } from '../enums/error-codes.enum';

/**
 * Build an AuthService wired to the supplied user, with only the collaborators the
 * forgot-password paths actually touch.
 */
function buildService(user: IUser): {
  service: AuthService;
  passwordResetService: {
    requestReset: jest.Mock;
    verifyValidCode: jest.Mock;
    consumeValidCode: jest.Mock;
  };
} {
  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(user),
  };

  const mockUserRepository = {
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
  } as unknown as Repository<BaseUser>;

  const baseLogger: LoggerService = {
    log: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    verbose: jest.fn(),
  } as unknown as LoggerService;

  const passwordResetService = {
    requestReset: jest.fn().mockResolvedValue({
      destination: 'l***@example.com',
      deliveryMedium: 'email',
      expiresIn: 900,
    }),
    verifyValidCode: jest.fn().mockResolvedValue(undefined),
    consumeValidCode: jest.fn().mockResolvedValue(undefined),
  };

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
    {} as unknown as Repository<BaseLoginAttempt>,
    {} as unknown as PasswordService,
    {} as unknown as JwtService,
    {} as unknown as SessionService,
    {} as unknown as ChallengeService,
    {} as unknown as AuthChallengeHelperService,
    {} as unknown as EmailVerificationService,
    {} as unknown as ClientInfoService,
    {} as unknown as AccountLockoutStorageService,
    mockConfig,
    new NAuthLogger({ instance: baseLogger, enablePiiRedaction: false, logLevel: 'debug' }),
    {} as unknown as HookRegistryService,
    { recordEvent: jest.fn().mockResolvedValue(null) } as unknown as AuthAuditService,
    {} as unknown as PhoneVerificationService,
    {} as unknown as MFAService,
    {} as unknown as Repository<BaseMFADevice>,
    {} as unknown as TrustedDeviceService,
    passwordResetService as unknown as PasswordResetService,
  );

  return { service, passwordResetService };
}

/** A user permanently locked by an admin: isLocked with no expiry. */
function permanentlyLockedUser(): IUser {
  return {
    id: 10,
    sub: 'locked-sub',
    email: 'locked@example.com',
    passwordHash: 'hash',
    isEmailVerified: true,
    isActive: true,
    isLocked: true,
    lockReason: 'Account disabled',
    lockedAt: new Date('2026-01-01T00:00:00.000Z'),
    lockedUntil: null,
  } as unknown as IUser;
}

describe('AuthService forgot-password (locked accounts)', () => {
  describe('forgotPassword()', () => {
    it('skips sending for a permanently locked account but still returns success', async () => {
      const { service, passwordResetService } = buildService(permanentlyLockedUser());

      const dto = Object.assign(new ForgotPasswordDTO(), { identifier: 'locked@example.com' });
      const res = await service.forgotPassword(dto);

      // Non-enumerating: indistinguishable from an unknown identifier.
      expect(res.success).toBe(true);
      expect(passwordResetService.requestReset).not.toHaveBeenCalled();
    });

    it('still sends for a temporarily locked account, which a reset can recover', async () => {
      const temporarilyLocked = {
        ...permanentlyLockedUser(),
        lockReason: 'Too many failed attempts',
        lockedUntil: new Date(Date.now() + 15 * 60 * 1000),
      } as unknown as IUser;
      const { service, passwordResetService } = buildService(temporarilyLocked);

      const dto = Object.assign(new ForgotPasswordDTO(), { identifier: 'locked@example.com' });
      const res = await service.forgotPassword(dto);

      expect(res.success).toBe(true);
      expect(passwordResetService.requestReset).toHaveBeenCalledWith(temporarilyLocked, 'email', {
        baseUrl: undefined,
      });
    });
  });

  describe('confirmForgotPassword()', () => {
    it('rejects a permanently locked account with ACCOUNT_LOCKED instead of reporting success', async () => {
      const user = permanentlyLockedUser();
      const { service } = buildService(user);

      const dto = Object.assign(new ConfirmForgotPasswordDTO(), {
        identifier: 'locked@example.com',
        code: '123456',
        newPassword: 'NewSecurePass123!',
      });

      await expect(service.confirmForgotPassword(dto)).rejects.toMatchObject({
        code: AuthErrorCode.ACCOUNT_LOCKED,
      });

      await expect(service.confirmForgotPassword(dto)).rejects.toBeInstanceOf(NAuthException);
    });

    it('verifies the reset code before disclosing the lock, and does not consume it', async () => {
      const { service, passwordResetService } = buildService(permanentlyLockedUser());

      const dto = Object.assign(new ConfirmForgotPasswordDTO(), {
        identifier: 'locked@example.com',
        code: '123456',
        newPassword: 'NewSecurePass123!',
      });

      await expect(service.confirmForgotPassword(dto)).rejects.toMatchObject({
        code: AuthErrorCode.ACCOUNT_LOCKED,
      });

      // The code must be proven first, otherwise the error is an oracle for lock state.
      expect(passwordResetService.verifyValidCode).toHaveBeenCalledTimes(1);
      // Refusing early leaves the code usable if an admin lifts the lock before it expires.
      expect(passwordResetService.consumeValidCode).not.toHaveBeenCalled();
    });
  });
});
