/**
 * AuthService Admin User Management Tests
 *
 * Tests for deleteUser(), getUsers(), disableUser(), and enableUser() methods
 */

import { Repository } from 'typeorm';
import { AuthService } from './auth.service';
import { NAuthException } from '../exceptions/nauth.exception';
import { PasswordService } from './password.service';
import { JwtService } from './jwt.service';
import { SessionService } from './session.service';
import { EmailVerificationService } from './email-verification.service';
import { PhoneVerificationService } from './phone-verification.service';
import { ClientInfoService } from './client-info.service';
import { AccountLockoutStorageService } from '../storage/account-lockout-storage.service';
import { ChallengeService } from './challenge.service';
import { AuthChallengeHelperService } from './auth-challenge-helper.service';
import { InternalAuthAuditService as AuthAuditService } from './auth-audit.service';
import { TrustedDeviceService } from './trusted-device.service';
import { MFAService } from './mfa.service';
import { SocialAuthService } from './social-auth.service';
import { DeleteUserDTO } from '../dto/delete-user.dto';
import { GetUsersDTO } from '../dto/get-users.dto';
import { DisableUserDTO } from '../dto/disable-user.dto';
import { EnableUserDTO } from '../dto/enable-user.dto';
import { IUser } from '../interfaces/entities.interface';
import {
  BaseUser,
  BaseLoginAttempt,
  BaseMFADevice,
  BaseSession,
  BaseVerificationToken,
  BaseSocialAccount,
  BaseChallengeSession,
  BaseAuthAudit,
  BaseTrustedDevice,
} from '../entities';
import { NAuthConfig } from '../interfaces/config.interface';
import { NAuthLogger } from '../utils/nauth-logger';
import { AuthErrorCode } from '../enums/error-codes.enum';
import { AuthAuditEventType } from '../enums/auth-audit-event-type.enum';
import { markDtoAsValidated } from '../utils/dto-validator';

describe('AuthService - Admin User Management', () => {
  let service: AuthService;
  let mockUserRepository: jest.Mocked<Repository<BaseUser>>;
  let mockLoginAttemptRepository: jest.Mocked<Repository<BaseLoginAttempt>>;
  let mockMfaDeviceRepository: jest.Mocked<Repository<BaseMFADevice>>;
  let mockSessionRepository: jest.Mocked<Repository<BaseSession>>;
  let mockVerificationTokenRepository: jest.Mocked<Repository<BaseVerificationToken>>;
  let mockSocialAccountRepository: jest.Mocked<Repository<BaseSocialAccount>>;
  let mockChallengeSessionRepository: jest.Mocked<Repository<BaseChallengeSession>>;
  let mockAuthAuditRepository: jest.Mocked<Repository<BaseAuthAudit>>;
  let mockTrustedDeviceRepository: jest.Mocked<Repository<BaseTrustedDevice>>;
  let mockPasswordService: jest.Mocked<PasswordService>;
  let mockJwtService: jest.Mocked<JwtService>;
  let mockSessionService: jest.Mocked<SessionService>;
  let mockEmailVerificationService: jest.Mocked<EmailVerificationService>;
  let mockPhoneVerificationService: jest.Mocked<PhoneVerificationService>;
  let mockClientInfoService: jest.Mocked<ClientInfoService>;
  let mockAccountLockoutStorage: jest.Mocked<AccountLockoutStorageService>;
  let mockChallengeService: jest.Mocked<ChallengeService>;
  let mockChallengeHelper: jest.Mocked<AuthChallengeHelperService>;
  let mockAuditService: jest.Mocked<AuthAuditService>;
  let mockTrustedDeviceService: jest.Mocked<TrustedDeviceService>;
  let mockMfaService: jest.Mocked<MFAService>;
  let mockSocialAuthService: jest.Mocked<SocialAuthService>;
  let mockLogger: jest.Mocked<NAuthLogger>;
  let mockConfig: NAuthConfig;

  const mockUser: IUser = {
    id: 1,
    sub: 'user-123',
    email: 'test@example.com',
    username: 'testuser',
    phone: null,
    firstName: 'John',
    lastName: 'Doe',
    passwordHash: 'hashed-password',
    passwordChangedAt: new Date(),
    passwordHistory: [],
    isEmailVerified: true,
    isPhoneVerified: false,
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

  const createDeleteUserDto = (sub: string): DeleteUserDTO => {
    const dto = Object.assign(new DeleteUserDTO(), { sub });
    markDtoAsValidated(dto);
    return dto;
  };

  const createGetUsersDto = (data: Partial<GetUsersDTO>): GetUsersDTO => {
    const dto = Object.assign(new GetUsersDTO(), data);
    markDtoAsValidated(dto);
    return dto;
  };

  const createDisableUserDto = (sub: string, reason?: string): DisableUserDTO => {
    const dto = Object.assign(new DisableUserDTO(), { sub, reason });
    markDtoAsValidated(dto);
    return dto;
  };

  const createEnableUserDto = (sub: string): EnableUserDTO => {
    const dto = Object.assign(new EnableUserDTO(), { sub });
    markDtoAsValidated(dto);
    return dto;
  };

  beforeEach(() => {
    // Create mock repositories
    mockUserRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn(),
    } as any;

    mockLoginAttemptRepository = {
      delete: jest.fn().mockResolvedValue({ affected: 0 }),
    } as any;

    mockMfaDeviceRepository = {
      delete: jest.fn().mockResolvedValue({ affected: 0 }),
    } as any;

    mockSessionRepository = {
      delete: jest.fn().mockResolvedValue({ affected: 0 }),
    } as any;

    mockVerificationTokenRepository = {
      delete: jest.fn().mockResolvedValue({ affected: 0 }),
    } as any;

    mockSocialAccountRepository = {
      delete: jest.fn().mockResolvedValue({ affected: 0 }),
    } as any;

    mockChallengeSessionRepository = {
      delete: jest.fn().mockResolvedValue({ affected: 0 }),
    } as any;

    mockAuthAuditRepository = {
      delete: jest.fn().mockResolvedValue({ affected: 0 }),
    } as any;

    mockTrustedDeviceRepository = {
      delete: jest.fn().mockResolvedValue({ affected: 0 }),
    } as any;

    // Create mock services
    mockPasswordService = {} as any;
    mockJwtService = {} as any;
    mockSessionService = {
      revokeAllUserSessions: jest.fn(),
    } as any;
    mockEmailVerificationService = {} as any;
    mockPhoneVerificationService = {} as any;
    mockClientInfoService = {
      get: jest.fn().mockReturnValue({ ipAddress: '127.0.0.1' }),
    } as any;
    mockAccountLockoutStorage = {} as any;
    mockChallengeService = {} as any;
    mockChallengeHelper = {} as any;
    mockAuditService = {
      recordEvent: jest.fn().mockResolvedValue(undefined),
    } as any;
    mockTrustedDeviceService = {} as any;
    mockMfaService = {} as any;
    mockSocialAuthService = {} as any;
    mockLogger = {
      log: jest.fn(),
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;

    mockConfig = {
      password: {},
      jwt: {},
      signup: { enabled: true },
      lockout: { enabled: true, maxAttempts: 5, duration: 900 },
      session: {},
    } as any;

    // Instantiate service
    service = new AuthService(
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
      undefined,
      mockSocialAuthService,
      mockSessionRepository,
      mockVerificationTokenRepository,
      mockSocialAccountRepository,
      mockChallengeSessionRepository,
      mockAuthAuditRepository,
      mockTrustedDeviceRepository,
    );
  });

  describe('deleteUser()', () => {
    it('should delete user and all associated data successfully', async () => {
      const deleteUserDto = createDeleteUserDto('user-123');
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockSessionRepository.delete.mockResolvedValue({ affected: 5 } as any);
      mockVerificationTokenRepository.delete.mockResolvedValue({ affected: 2 } as any);
      mockMfaDeviceRepository.delete.mockResolvedValue({ affected: 1 } as any);
      mockTrustedDeviceRepository.delete.mockResolvedValue({ affected: 3 } as any);
      mockSocialAccountRepository.delete.mockResolvedValue({ affected: 2 } as any);
      mockLoginAttemptRepository.delete.mockResolvedValue({ affected: 10 } as any);
      mockChallengeSessionRepository.delete.mockResolvedValue({ affected: 1 } as any);
      mockAuthAuditRepository.delete.mockResolvedValue({ affected: 50 } as any);
      mockUserRepository.delete.mockResolvedValue({ affected: 1 } as any);

      const result = await service.deleteUser(deleteUserDto);

      expect(result.success).toBe(true);
      expect(result.deletedUserId).toBe('user-123');
      expect(result.deletedRecords.sessions).toBe(5);
      expect(result.deletedRecords.verificationTokens).toBe(2);
      expect(result.deletedRecords.mfaDevices).toBe(1);
      expect(result.deletedRecords.trustedDevices).toBe(3);
      expect(result.deletedRecords.socialAccounts).toBe(2);
      expect(result.deletedRecords.loginAttempts).toBe(10);
      expect(result.deletedRecords.challengeSessions).toBe(1);
      expect(result.deletedRecords.auditLogs).toBe(50);
      expect(mockUserRepository.delete).toHaveBeenCalledWith({ id: mockUser.id });
      expect(mockAuditService.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: AuthAuditEventType.ACCOUNT_DELETED,
        }),
      );
    });

    it('should throw USER_NOT_FOUND if user does not exist', async () => {
      const deleteUserDto = createDeleteUserDto('user-123');
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.deleteUser(deleteUserDto)).rejects.toThrow(NAuthException);
      await expect(service.deleteUser(deleteUserDto)).rejects.toMatchObject({
        code: AuthErrorCode.USER_NOT_FOUND,
      });
    });
  });

  describe('getUsers()', () => {
    const mockQueryBuilder = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
    };

    beforeEach(() => {
      mockUserRepository.createQueryBuilder = jest.fn().mockReturnValue(mockQueryBuilder);
    });

    it('should return paginated users with default pagination', async () => {
      const getUsersDto = createGetUsersDto({});
      const users = [mockUser, { ...mockUser, id: 2, sub: 'user-456', email: 'test2@example.com' }];
      mockQueryBuilder.getManyAndCount.mockResolvedValue([users, 2]);

      const result = await service.getUsers(getUsersDto);

      expect(result.users).toHaveLength(2);
      expect(result.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1,
      });
    });

    it('should apply email filter', async () => {
      const getUsersDto = createGetUsersDto({ email: 'test@example.com' });
      mockQueryBuilder.getManyAndCount.mockResolvedValue([[mockUser], 1]);

      await service.getUsers(getUsersDto);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('LOWER(user.email) LIKE LOWER(:email)', {
        email: '%test@example.com%',
      });
    });
  });

  describe('disableUser()', () => {
    it('should disable user with permanent lock (lockedUntil=NULL)', async () => {
      const disableUserDto = createDisableUserDto('user-123', 'Suspicious activity detected');
      mockUserRepository.findOne.mockResolvedValueOnce(mockUser as any).mockResolvedValueOnce({
        ...mockUser,
        isLocked: true,
        lockedUntil: null,
        lockReason: 'Suspicious activity detected',
        lockedAt: new Date(),
      } as any);
      mockUserRepository.update.mockResolvedValue({ affected: 1 } as any);
      mockSessionService.revokeAllUserSessions.mockResolvedValue(3);

      const result = await service.disableUser(disableUserDto);

      expect(result.success).toBe(true);
      expect(result.revokedSessions).toBe(3);
      expect(mockUserRepository.update).toHaveBeenCalledWith(
        { id: mockUser.id },
        expect.objectContaining({
          isLocked: true,
          lockReason: 'Suspicious activity detected',
          lockedAt: expect.any(Date),
          lockedUntil: null,
        }),
      );
    });

    it('should throw USER_NOT_FOUND if user does not exist', async () => {
      const disableUserDto = createDisableUserDto('user-123', 'Suspicious activity detected');
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.disableUser(disableUserDto)).rejects.toThrow(NAuthException);
      await expect(service.disableUser(disableUserDto)).rejects.toMatchObject({
        code: AuthErrorCode.USER_NOT_FOUND,
      });
    });
  });

  describe('enableUser()', () => {
    it('should enable user by clearing all lock fields', async () => {
      const enableUserDto = createEnableUserDto('user-123');
      const lockedUser = {
        ...mockUser,
        isLocked: true,
        lockReason: 'Suspicious activity detected',
        lockedAt: new Date('2024-01-01'),
        lockedUntil: null,
        failedLoginAttempts: 5,
      };
      mockUserRepository.findOne
        .mockResolvedValueOnce(lockedUser as any)
        .mockResolvedValueOnce({
          ...lockedUser,
          isLocked: false,
          lockReason: null,
          lockedAt: null,
          lockedUntil: null,
          failedLoginAttempts: 0,
        } as any);
      mockUserRepository.update.mockResolvedValue({ affected: 1 } as any);

      const result = await service.enableUser(enableUserDto);

      expect(result.success).toBe(true);
      expect(result.user.isLocked).toBe(false);
      expect(mockUserRepository.update).toHaveBeenCalledWith(
        { id: mockUser.id },
        expect.objectContaining({
          isLocked: false,
          lockReason: null,
          lockedAt: null,
          lockedUntil: null,
          failedLoginAttempts: 0,
        }),
      );
      expect(mockAuditService.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: AuthAuditEventType.ACCOUNT_ENABLED,
        }),
      );
    });

    it('should throw USER_NOT_FOUND if user does not exist', async () => {
      const enableUserDto = createEnableUserDto('user-123');
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.enableUser(enableUserDto)).rejects.toThrow(NAuthException);
      await expect(service.enableUser(enableUserDto)).rejects.toMatchObject({
        code: AuthErrorCode.USER_NOT_FOUND,
      });
    });
  });
});

