import { Repository, IsNull } from 'typeorm';
import { PasswordResetService } from './password-reset.service';
import { BaseVerificationToken } from '../entities';
import { EmailProvider, SMSProvider } from '../interfaces/provider.interface';
import { StorageAdapter } from '../interfaces/storage-adapter.interface';
import { NAuthConfig } from '../interfaces/config.interface';
import { ClientInfoService } from './client-info.service';
import { NAuthLogger } from '../utils/nauth-logger';
import { InternalAuthAuditService as AuthAuditService } from './auth-audit.service';
import { IUser } from '../interfaces/entities.interface';
import { NAuthException } from '../exceptions/nauth.exception';
import { AuthErrorCode } from '../enums/error-codes.enum';

describe('PasswordResetService', () => {
  let service: PasswordResetService;
  let mockVerificationTokenRepo: jest.Mocked<Repository<BaseVerificationToken>>;
  let mockEmailProvider: jest.Mocked<EmailProvider>;
  let mockSmsProvider: jest.Mocked<SMSProvider>;
  let mockStorageAdapter: jest.Mocked<StorageAdapter>;
  let mockClientInfoService: jest.Mocked<ClientInfoService>;
  let mockLogger: jest.Mocked<NAuthLogger>;
  let mockAuditService: jest.Mocked<AuthAuditService>;
  let mockConfig: NAuthConfig;

  const mockUser: IUser = {
    id: 1,
    sub: 'user-123',
    email: 'test@example.com',
    username: 'testuser',
    phone: '+1234567890',
    firstName: null,
    lastName: null,
    passwordHash: 'hash',
    passwordChangedAt: null,
    passwordHistory: [],
    isEmailVerified: true,
    isPhoneVerified: true,
    isActive: true,
    mustChangePassword: false,
    isLocked: false,
    lockReason: null,
    lockedAt: null,
    lockedUntil: null,
    failedLoginAttempts: 0,
    lastFailedLoginAt: null,
    lastLoginAt: null,
    lastLoginIp: null,
    hasSocialAuth: false,
    socialProviders: null,
    mfaEnabled: false,
    mfaMethods: null,
    preferredMfaMethod: null,
    backupCodes: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(() => {
    mockVerificationTokenRepo = {
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      findOne: jest.fn(),
    } as any;

    mockEmailProvider = {
      sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
      sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
      sendWelcomeEmail: jest.fn().mockResolvedValue(undefined),
      sendAdminPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
      sendLockoutEmail: jest.fn().mockResolvedValue(undefined),
      sendPasswordChangedEmail: jest.fn().mockResolvedValue(undefined),
      sendMFADeviceRemovedEmail: jest.fn().mockResolvedValue(undefined),
      sendAdaptiveMFARiskAlertEmail: jest.fn().mockResolvedValue(undefined),
      sendAccountDisabledEmail: jest.fn().mockResolvedValue(undefined),
      sendAccountEnabledEmail: jest.fn().mockResolvedValue(undefined),
      sendEmailChangedAlertEmail: jest.fn().mockResolvedValue(undefined),
      sendEmailChangedConfirmationEmail: jest.fn().mockResolvedValue(undefined),
      sendAccountLockedEmail: jest.fn().mockResolvedValue(undefined),
      sendSessionsRevokedEmail: jest.fn().mockResolvedValue(undefined),
      sendMFAFirstEnabledEmail: jest.fn().mockResolvedValue(undefined),
    };

    mockSmsProvider = {
      sendOTP: jest.fn().mockResolvedValue(undefined),
    };

    mockStorageAdapter = {
      initialize: jest.fn(),
      isHealthy: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      incr: jest.fn(),
      decr: jest.fn(),
      expire: jest.fn(),
      ttl: jest.fn(),
      hget: jest.fn(),
      hset: jest.fn(),
      hgetall: jest.fn(),
      hdel: jest.fn(),
      lpush: jest.fn(),
      lrange: jest.fn(),
      llen: jest.fn(),
      keys: jest.fn(),
      scan: jest.fn(),
      cleanup: jest.fn(),
      disconnect: jest.fn(),
    };

    mockClientInfoService = {
      get: jest.fn().mockReturnValue({ ipAddress: '1.2.3.4', userAgent: 'test-agent' }),
    } as any;

    mockLogger = {
      log: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      verbose: jest.fn(),
    } as any;

    mockAuditService = {
      recordEvent: jest.fn().mockResolvedValue(null),
    } as any;

    mockConfig = {
      jwt: {
        accessToken: { secret: 'test-secret', expiresIn: '15m' },
        refreshToken: { secret: 'test-refresh-secret', expiresIn: '7d' },
      },
      password: {
        passwordReset: {
          codeLength: 6,
          expiresIn: 900,
          rateLimitMax: 3,
          rateLimitWindow: 3600,
          maxAttempts: 3,
        },
      },
    };

    service = new PasswordResetService(
      mockVerificationTokenRepo,
      mockEmailProvider,
      mockStorageAdapter,
      mockConfig,
      mockClientInfoService,
      mockLogger,
      mockAuditService,
      mockSmsProvider,
    );
  });

  describe('requestReset()', () => {
    it('should rate limit when exceeding max requests', async () => {
      mockStorageAdapter.incr.mockResolvedValue(4);
      mockStorageAdapter.ttl.mockResolvedValue(120);

      await expect(service.requestReset(mockUser, 'email')).rejects.toMatchObject({
        code: AuthErrorCode.RATE_LIMIT_PASSWORD_RESET,
      });
    });

    it('should invalidate existing unused tokens and send email code', async () => {
      mockStorageAdapter.incr.mockResolvedValue(1);
      mockStorageAdapter.ttl.mockResolvedValue(3600);

      const created = { id: 123 } as any;
      mockVerificationTokenRepo.create.mockReturnValue(created);
      mockVerificationTokenRepo.save.mockResolvedValue({ id: 123 } as unknown as BaseVerificationToken);

      const result = await service.requestReset(mockUser, 'email');

      expect(mockVerificationTokenRepo.update).toHaveBeenCalledWith(
        { userId: mockUser.id, type: 'password_reset', usedAt: IsNull() },
        { usedAt: expect.any(Date) },
      );
      expect(mockEmailProvider.sendPasswordResetEmail).toHaveBeenCalledWith(
        mockUser.email,
        expect.any(String), // token
        expect.any(String), // code
        undefined, // link (not provided)
        expect.any(Number), // expiryMinutes
      );
      expect(result.deliveryMedium).toBe('email');
      expect(result.destination).toContain('@');
    });

    it('should send SMS code when delivery is sms', async () => {
      mockStorageAdapter.incr.mockResolvedValue(1);
      mockStorageAdapter.ttl.mockResolvedValue(3600);

      const created = { id: 1 } as any;
      mockVerificationTokenRepo.create.mockReturnValue(created);
      mockVerificationTokenRepo.save.mockResolvedValue({ id: 1 } as unknown as BaseVerificationToken);

      const result = await service.requestReset(mockUser, 'sms');

      expect(mockSmsProvider.sendOTP).toHaveBeenCalledWith(
        mockUser.phone!,
        expect.any(String),
        'passwordReset',
        expect.any(Object),
      );
      expect(result.deliveryMedium).toBe('sms');
    });
  });

  describe('consumeValidCode()', () => {
    it('should throw PASSWORD_RESET_CODE_INVALID when no token', async () => {
      mockVerificationTokenRepo.findOne.mockResolvedValue(null);

      await expect(service.consumeValidCode(mockUser, '123456')).rejects.toMatchObject({
        code: AuthErrorCode.PASSWORD_RESET_CODE_INVALID,
      });
    });

    it('should throw PASSWORD_RESET_CODE_EXPIRED when token expired', async () => {
      const tokenEntity = {
        id: 1,
        userId: mockUser.id,
        type: 'password_reset',
        usedAt: null,
        code: '123456',
        attempts: 0,
        expiresAt: new Date(Date.now() - 1000),
      } as any;
      mockVerificationTokenRepo.findOne.mockResolvedValue(tokenEntity);

      await expect(service.consumeValidCode(mockUser, '123456')).rejects.toMatchObject({
        code: AuthErrorCode.PASSWORD_RESET_CODE_EXPIRED,
      });
    });

    it('should increment attempts and throw PASSWORD_RESET_CODE_INVALID on wrong code', async () => {
      const tokenEntity = {
        id: 1,
        userId: mockUser.id,
        type: 'password_reset',
        usedAt: null,
        code: '999999',
        attempts: 1,
        expiresAt: new Date(Date.now() + 60_000),
      } as any;
      mockVerificationTokenRepo.findOne.mockResolvedValue(tokenEntity);

      await expect(service.consumeValidCode(mockUser, '123456')).rejects.toBeInstanceOf(NAuthException);
      expect(mockVerificationTokenRepo.update).toHaveBeenCalledWith({ id: 1 }, { attempts: 2 });
    });

    it('should mark token used when code matches', async () => {
      const tokenEntity = {
        id: 1,
        userId: mockUser.id,
        type: 'password_reset',
        usedAt: null,
        code: '123456',
        attempts: 0,
        expiresAt: new Date(Date.now() + 60_000),
      } as any;
      mockVerificationTokenRepo.findOne.mockResolvedValue(tokenEntity);
      mockVerificationTokenRepo.save.mockResolvedValue(tokenEntity);

      await service.consumeValidCode(mockUser, '123456');

      expect(mockVerificationTokenRepo.save).toHaveBeenCalledWith(expect.objectContaining({ usedAt: expect.any(Date) }));
    });
  });
});


