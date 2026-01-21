/**
 * UserService Unit Tests
 *
 * Platform-agnostic: Uses direct instantiation, no NestJS dependencies.
 *
 * Tests internal user data management service including:
 * - User query operations (getUsers, getUserById, getUserByEmail, getUserForAuthContext)
 * - User update operations (updateUserAttributes, updateVerifiedStatus)
 * - User lifecycle operations (deleteUser, disableUser, enableUser)
 * - Password management (setMustChangePassword)
 * - Edge cases and error handling
 */

import { Repository } from 'typeorm';
import { UserService } from './user.service';
import { SessionService } from './session.service';
import { ClientInfoService } from './client-info.service';
import { InternalAuthAuditService as AuthAuditService } from './auth-audit.service';
import { HookRegistryService } from './hook-registry.service';
import { AuthServiceInternalHelpers } from './auth-service-internal-helpers';
import { NAuthException } from '../exceptions/nauth.exception';
import { AuthErrorCode } from '../enums/error-codes.enum';
import { AuthAuditEventType } from '../enums/auth-audit-event-type.enum';
import { MFAMethod } from '../enums/mfa-method.enum';
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
import { IUser } from '../interfaces/entities.interface';
import { NAuthConfig } from '../interfaces/config.interface';
import { NAuthLogger } from '../utils/nauth-logger';
import { markDtoAsValidated } from '../utils/dto-validator';

describe('UserService', () => {
  let service: UserService;
  let mockUserRepository: jest.Mocked<Repository<BaseUser>>;
  let mockLoginAttemptRepository: jest.Mocked<Repository<BaseLoginAttempt>>;
  let mockSessionService: jest.Mocked<SessionService>;
  let mockMfaDeviceRepository: jest.Mocked<Repository<BaseMFADevice>>;
  let mockAuditService: jest.Mocked<AuthAuditService>;
  let mockHookRegistry: jest.Mocked<HookRegistryService>;
  let mockClientInfoService: jest.Mocked<ClientInfoService>;
  let mockSessionRepository: jest.Mocked<Repository<BaseSession>>;
  let mockVerificationTokenRepository: jest.Mocked<Repository<BaseVerificationToken>>;
  let mockSocialAccountRepository: jest.Mocked<Repository<BaseSocialAccount>>;
  let mockChallengeSessionRepository: jest.Mocked<Repository<BaseChallengeSession>>;
  let mockAuthAuditRepository: jest.Mocked<Repository<BaseAuthAudit>>;
  let mockTrustedDeviceRepository: jest.Mocked<Repository<BaseTrustedDevice>>;
  let mockHelpers: jest.Mocked<AuthServiceInternalHelpers>;
  let mockConfig: NAuthConfig;
  let mockLogger: jest.Mocked<NAuthLogger>;

  const mockUserSub = 'a21b654c-2746-4168-acee-c175083a65cd';
  const mockUser: IUser = {
    id: 1,
    sub: mockUserSub,
    email: 'test@example.com',
    username: 'testuser',
    phone: '+1234567890',
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
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    deletedAt: null,
  };

  const createMockQueryBuilder = () => {
    const qb: any = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    return qb;
  };

  beforeEach(() => {
    mockUserRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      save: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 } as any),
      create: jest.fn(),
      createQueryBuilder: jest.fn(createMockQueryBuilder),
      delete: jest.fn().mockResolvedValue({ affected: 1 } as any),
    } as any;

    mockLoginAttemptRepository = {
      delete: jest.fn().mockResolvedValue({ affected: 1 } as any),
    } as any;

    mockSessionService = {
      revokeAllUserSessions: jest.fn().mockResolvedValue(0),
    } as any;

    mockMfaDeviceRepository = {
      find: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue({ affected: 1 } as any),
    } as any;

    mockAuditService = {
      recordEvent: jest.fn().mockResolvedValue(null),
    } as any;

    mockHookRegistry = {
      executePreUserUpdate: jest.fn().mockResolvedValue(undefined),
      executePostUserUpdate: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockClientInfoService = {
      get: jest.fn().mockReturnValue({
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      }),
    } as any;

    mockSessionRepository = {
      delete: jest.fn().mockResolvedValue({ affected: 1 } as any),
    } as any;

    mockVerificationTokenRepository = {
      delete: jest.fn().mockResolvedValue({ affected: 1 } as any),
    } as any;

    mockSocialAccountRepository = {
      delete: jest.fn().mockResolvedValue({ affected: 1 } as any),
    } as any;

    mockChallengeSessionRepository = {
      delete: jest.fn().mockResolvedValue({ affected: 1 } as any),
    } as any;

    mockAuthAuditRepository = {
      delete: jest.fn().mockResolvedValue({ affected: 1 } as any),
    } as any;

    mockTrustedDeviceRepository = {
      delete: jest.fn().mockResolvedValue({ affected: 1 } as any),
    } as any;

    mockHelpers = {
      validateUniquenessConstraints: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockConfig = {
      signup: {
        allowDuplicateEmails: false,
        allowDuplicatePhones: false,
        allowDuplicateUsernames: false,
      },
      password: {
        minLength: 8,
        requireUppercase: false,
        requireLowercase: false,
        requireNumbers: false,
        requireSpecialChars: false,
      },
      jwt: {
        accessToken: {
          secret: 'test-secret',
          expiresIn: 3600,
        },
        refreshToken: {
          secret: 'test-secret',
          expiresIn: 86400,
        },
      },
    } as NAuthConfig;

    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    } as any;

    service = new UserService(
      mockUserRepository,
      mockLoginAttemptRepository,
      mockSessionService,
      mockConfig,
      mockLogger,
      mockMfaDeviceRepository,
      mockAuditService,
      mockHookRegistry,
      mockClientInfoService,
      mockSessionRepository,
      mockVerificationTokenRepository,
      mockSocialAccountRepository,
      mockChallengeSessionRepository,
      mockAuthAuditRepository,
      mockTrustedDeviceRepository,
      mockHelpers,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Service Initialization
  // ============================================================================

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should initialize with minimal helpers when helpers not provided', () => {
    const serviceWithoutHelpers = new UserService(
      mockUserRepository,
      mockLoginAttemptRepository,
      mockSessionService,
      mockConfig,
      mockLogger,
      mockMfaDeviceRepository,
      mockAuditService,
      mockHookRegistry,
      mockClientInfoService,
    );
    expect(serviceWithoutHelpers).toBeDefined();
  });

  // ============================================================================
  // getUsers
  // ============================================================================

  describe('getUsers', () => {
    it('should return paginated users with default pagination', async () => {
      const qb = createMockQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[mockUser], 1]);
      mockUserRepository.createQueryBuilder.mockReturnValue(qb as any);

      const result = await service.getUsers({});

      expect(result.users).toHaveLength(1);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
      expect(result.pagination.total).toBe(1);
    });

    it('should apply email filter', async () => {
      const qb = createMockQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[mockUser], 1]);
      mockUserRepository.createQueryBuilder.mockReturnValue(qb as any);

      await service.getUsers({ email: 'test' });

      expect(qb.andWhere).toHaveBeenCalledWith('LOWER(user.email) LIKE LOWER(:email)', { email: '%test%' });
    });

    it('should apply phone filter', async () => {
      const qb = createMockQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[mockUser], 1]);
      mockUserRepository.createQueryBuilder.mockReturnValue(qb as any);

      await service.getUsers({ phone: '123' });

      expect(qb.andWhere).toHaveBeenCalledWith('LOWER(user.phone) LIKE LOWER(:phone)', { phone: '%123%' });
    });

    it('should apply boolean filters', async () => {
      const qb = createMockQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[mockUser], 1]);
      mockUserRepository.createQueryBuilder.mockReturnValue(qb as any);

      await service.getUsers({
        isEmailVerified: true,
        isPhoneVerified: false,
        hasSocialAuth: true,
        isLocked: false,
        mfaEnabled: true,
      });

      expect(qb.andWhere).toHaveBeenCalledWith('user.isEmailVerified = :isEmailVerified', {
        isEmailVerified: true,
      });
      expect(qb.andWhere).toHaveBeenCalledWith('user.isPhoneVerified = :isPhoneVerified', {
        isPhoneVerified: false,
      });
      expect(qb.andWhere).toHaveBeenCalledWith('user.hasSocialAuth = :hasSocialAuth', { hasSocialAuth: true });
      expect(qb.andWhere).toHaveBeenCalledWith('user.isLocked = :isLocked', { isLocked: false });
      expect(qb.andWhere).toHaveBeenCalledWith('user.mfaEnabled = :mfaEnabled', { mfaEnabled: true });
    });

    it('should apply date filters with operators', async () => {
      const qb = createMockQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[mockUser], 1]);
      mockUserRepository.createQueryBuilder.mockReturnValue(qb as any);
      const testDate = new Date('2024-01-01');

      await service.getUsers({
        createdAt: { operator: 'gte', value: testDate },
        updatedAt: { operator: 'lt', value: testDate },
      });

      // Verify andWhere was called with date filters
      expect(qb.andWhere).toHaveBeenCalled();
      const andWhereCalls = (qb.andWhere as jest.Mock).mock.calls;
      const createdAtCall = andWhereCalls.find((call) => call[0].includes('createdAt'));
      const updatedAtCall = andWhereCalls.find((call) => call[0].includes('updatedAt'));
      expect(createdAtCall).toBeDefined();
      expect(updatedAtCall).toBeDefined();
    });

    it('should apply custom sorting', async () => {
      const qb = createMockQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[mockUser], 1]);
      mockUserRepository.createQueryBuilder.mockReturnValue(qb as any);

      await service.getUsers({ sortBy: 'email', sortOrder: 'ASC' });

      expect(qb.orderBy).toHaveBeenCalledWith('user.email', 'ASC');
    });

    it('should apply pagination', async () => {
      const qb = createMockQueryBuilder();
      qb.getManyAndCount.mockResolvedValue([[mockUser], 1]);
      mockUserRepository.createQueryBuilder.mockReturnValue(qb as any);

      await service.getUsers({ page: 2, limit: 20 });

      expect(qb.skip).toHaveBeenCalledWith(20);
      expect(qb.take).toHaveBeenCalledWith(20);
    });
  });

  // ============================================================================
  // getUserById
  // ============================================================================

  describe('getUserById', () => {
    it('should return user by sub', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);

      const result = await service.getUserById({ sub: mockUserSub });

      expect(result).toBeDefined();
      expect(result?.sub).toBe(mockUserSub);
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { sub: mockUserSub } });
    });

    it('should return null when user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const result = await service.getUserById({ sub: mockUserSub });

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // getUserByEmail
  // ============================================================================

  describe('getUserByEmail', () => {
    it('should return user by email', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);

      const result = await service.getUserByEmail({ email: 'test@example.com' });

      expect(result).toBeDefined();
      expect(result?.email).toBe('test@example.com');
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { email: 'test@example.com' } });
    });

    it('should return null when user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const result = await service.getUserByEmail({ email: 'notfound@example.com' });

      expect(result).toBeNull();
    });
  });

  // ============================================================================
  // getUserForAuthContext
  // ============================================================================

  describe('getUserForAuthContext', () => {
    it('should return user for auth context without sensitive fields', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);

      const result = await service.getUserForAuthContext(mockUserSub);

      expect(result.sub).toBe(mockUserSub);
      expect(result.hasPasswordHash).toBe(true);
      expect((result as any).passwordHash).toBeUndefined();
      expect((result as any).totpSecret).toBeUndefined();
      expect((result as any).backupCodes).toBeUndefined();
      expect((result as any).passwordHistory).toBeUndefined();
    });

    it('should throw NAuthException when user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.getUserForAuthContext(mockUserSub)).rejects.toThrow(NAuthException);
      await expect(service.getUserForAuthContext(mockUserSub)).rejects.toMatchObject({
        code: AuthErrorCode.NOT_FOUND,
      });
    });

    it('should throw NAuthException when account is inactive', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      mockUserRepository.findOne.mockResolvedValue(inactiveUser as any);

      await expect(service.getUserForAuthContext(mockUserSub)).rejects.toThrow(NAuthException);
      await expect(service.getUserForAuthContext(mockUserSub)).rejects.toMatchObject({
        code: AuthErrorCode.ACCOUNT_INACTIVE,
      });
    });

    it('should compute hasPasswordHash correctly when passwordHash exists', async () => {
      const userWithPassword = { ...mockUser, passwordHash: 'hashed', hasPasswordHash: undefined };
      mockUserRepository.findOne.mockResolvedValue(userWithPassword as any);

      const result = await service.getUserForAuthContext(mockUserSub);

      expect(result.hasPasswordHash).toBe(true);
    });

    it('should compute hasPasswordHash correctly when passwordHash is null', async () => {
      const userWithoutPassword = { ...mockUser, passwordHash: null, hasPasswordHash: undefined };
      mockUserRepository.findOne.mockResolvedValue(userWithoutPassword as any);

      const result = await service.getUserForAuthContext(mockUserSub);

      expect(result.hasPasswordHash).toBe(false);
    });
  });

  // ============================================================================
  // updateUserAttributes
  // ============================================================================

  describe('updateUserAttributes', () => {
    beforeEach(() => {
      // Default setup - will be overridden in individual tests
      mockUserRepository.findOne.mockReset();
    });

    it('should update user attributes successfully', async () => {
      const updatedUser = { ...mockUser, firstName: 'Updated' };
      mockUserRepository.findOne
        .mockResolvedValueOnce(mockUser as any) // Initial lookup by sub
        .mockResolvedValueOnce(updatedUser as any); // Final fetch by id after update

      const result = await service.updateUserAttributes({
        sub: mockUserSub,
        firstName: 'Updated',
      });

      expect(result).toBeDefined();
      expect(mockUserRepository.update).toHaveBeenCalled();
      expect(mockHelpers.validateUniquenessConstraints).toHaveBeenCalled();
    });

    it('should reset email verification when email changes', async () => {
      const updatedUser = { ...mockUser, email: 'new@example.com', isEmailVerified: false };
      mockUserRepository.findOne
        .mockResolvedValueOnce(mockUser as any) // Initial lookup by sub
        .mockResolvedValueOnce(updatedUser as any); // Final fetch by id after update

      await service.updateUserAttributes({
        sub: mockUserSub,
        email: 'new@example.com',
      });

      expect(mockUserRepository.update).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({
          email: 'new@example.com',
          isEmailVerified: false,
        }),
      );
    });

    it('should retain email verification when retainVerification is true', async () => {
      const updatedUser = { ...mockUser, email: 'new@example.com', isEmailVerified: true };
      mockUserRepository.findOne
        .mockResolvedValueOnce(mockUser as any) // Initial lookup by sub
        .mockResolvedValueOnce(updatedUser as any); // Final fetch by id after update

      await service.updateUserAttributes({
        sub: mockUserSub,
        email: 'new@example.com',
        retainVerification: true,
      });

      expect(mockUserRepository.update).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({
          email: 'new@example.com',
          isEmailVerified: true,
        }),
      );
    });

    it('should delete Email MFA devices when email changes', async () => {
      const emailDevice = { id: 1, userId: mockUser.id, type: MFAMethod.EMAIL, isActive: true };
      const updatedUser = { ...mockUser, email: 'new@example.com' };
      mockMfaDeviceRepository.find
        .mockResolvedValueOnce([emailDevice] as any) // Email devices
        .mockResolvedValueOnce([]); // All active devices after deletion

      mockUserRepository.findOne
        .mockResolvedValueOnce(mockUser as any) // Initial lookup by sub
        .mockResolvedValueOnce(updatedUser as any); // Final fetch by id after update

      await service.updateUserAttributes({
        sub: mockUserSub,
        email: 'new@example.com',
      });

      expect(mockMfaDeviceRepository.delete).toHaveBeenCalledWith(1);
      expect(mockAuditService.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: AuthAuditEventType.MFA_DEVICE_REMOVED,
          reason: 'email_changed',
        }),
      );
    });

    it('should disable MFA when all devices removed after email change', async () => {
      const emailDevice = { id: 1, userId: mockUser.id, type: MFAMethod.EMAIL, isActive: true };
      const userWithMfa = { ...mockUser, mfaEnabled: true };
      const updatedUser = { ...userWithMfa, email: 'new@example.com', mfaEnabled: false };
      mockMfaDeviceRepository.find
        .mockResolvedValueOnce([emailDevice] as any) // Email devices
        .mockResolvedValueOnce([]); // No active devices after deletion

      mockUserRepository.findOne
        .mockResolvedValueOnce(userWithMfa as any) // Initial lookup by sub
        .mockResolvedValueOnce(updatedUser as any); // Final fetch by id after update

      await service.updateUserAttributes({
        sub: mockUserSub,
        email: 'new@example.com',
      });

      expect(mockUserRepository.update).toHaveBeenCalledWith(
        mockUser.id,
        expect.objectContaining({
          mfaEnabled: false,
          mfaMethods: [],
          preferredMfaMethod: null,
        }),
      );
    });

    it('should include phone before/after in PROFILE_UPDATED audit metadata', async () => {
      const updatedUser = { ...mockUser, phone: '+1987654321', isPhoneVerified: false };
      mockUserRepository.findOne
        .mockResolvedValueOnce(mockUser as any) // Initial lookup by sub
        .mockResolvedValueOnce(updatedUser as any); // Final fetch by id after update

      await service.updateUserAttributes({
        sub: mockUserSub,
        phone: '+1987654321',
      });

      expect(mockAuditService.recordEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: AuthAuditEventType.PROFILE_UPDATED,
          metadata: expect.objectContaining({
            fieldChanges: expect.objectContaining({
              phone: {
                before: '+1234567890',
                after: '+1987654321',
              },
            }),
          }),
        }),
      );
    });

    it('should throw NAuthException when user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateUserAttributes({
          sub: mockUserSub,
          firstName: 'Updated',
        }),
      ).rejects.toThrow(NAuthException);
    });
  });

  // ============================================================================
  // updateVerifiedStatus
  // ============================================================================

  describe('updateVerifiedStatus', () => {
    it('should update email verification status', async () => {
      const userWithEmail = { ...mockUser, email: 'test@example.com', isEmailVerified: false };
      mockUserRepository.findOne
        .mockResolvedValueOnce(userWithEmail as any)
        .mockResolvedValueOnce({ ...userWithEmail, isEmailVerified: true } as any);

      const result = await service.updateVerifiedStatus({
        sub: mockUserSub,
        isEmailVerified: true,
      });

      expect(result.isEmailVerified).toBe(true);
      expect(mockUserRepository.update).toHaveBeenCalled();
    });

    it('should throw error when trying to verify email that does not exist', async () => {
      const userWithoutEmail = { ...mockUser, email: null };
      mockUserRepository.findOne.mockResolvedValue(userWithoutEmail as any);

      await expect(
        service.updateVerifiedStatus({
          sub: mockUserSub,
          isEmailVerified: true,
        }),
      ).rejects.toThrow(NAuthException);
    });

    it('should throw error when trying to verify phone that does not exist', async () => {
      const userWithoutPhone = { ...mockUser, phone: null };
      mockUserRepository.findOne.mockResolvedValue(userWithoutPhone as any);

      await expect(
        service.updateVerifiedStatus({
          sub: mockUserSub,
          isPhoneVerified: true,
        }),
      ).rejects.toThrow(NAuthException);
    });

    it('should throw error when user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateVerifiedStatus({
          sub: mockUserSub,
          isEmailVerified: true,
        }),
      ).rejects.toThrow(NAuthException);
    });
  });

  // ============================================================================
  // deleteUser
  // ============================================================================

  describe('deleteUser', () => {
    it('should delete user and cascade delete related records', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockSessionRepository.delete.mockResolvedValue({ affected: 1 } as any);
      mockVerificationTokenRepository.delete.mockResolvedValue({ affected: 1 } as any);
      mockSocialAccountRepository.delete.mockResolvedValue({ affected: 1 } as any);
      mockChallengeSessionRepository.delete.mockResolvedValue({ affected: 1 } as any);
      mockAuthAuditRepository.delete.mockResolvedValue({ affected: 1 } as any);
      mockTrustedDeviceRepository.delete.mockResolvedValue({ affected: 1 } as any);
      mockUserRepository.delete.mockResolvedValue({ affected: 1 } as any);

      const result = await service.deleteUser({ sub: mockUserSub });

      expect(result.success).toBe(true);
      expect(mockSessionRepository.delete).toHaveBeenCalledWith({ userId: mockUser.id });
      expect(mockVerificationTokenRepository.delete).toHaveBeenCalledWith({ userId: mockUser.id });
      expect(mockSocialAccountRepository.delete).toHaveBeenCalledWith({ userId: mockUser.id });
      expect(mockChallengeSessionRepository.delete).toHaveBeenCalledWith({ userId: mockUser.id } as any);
      expect(mockAuthAuditRepository.delete).toHaveBeenCalledWith({ userId: mockUser.id });
      expect(mockTrustedDeviceRepository.delete).toHaveBeenCalledWith({ userId: mockUser.id });
      expect(mockUserRepository.delete).toHaveBeenCalledWith({ id: mockUser.id });
    });

    it('should revoke all user sessions before deletion', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockUserRepository.delete.mockResolvedValue({ affected: 1 } as any);

      await service.deleteUser({ sub: mockUserSub });

      // Note: deleteUser deletes sessions directly via repository, not via sessionService
      expect(mockSessionRepository.delete).toHaveBeenCalledWith({ userId: mockUser.id });
    });

    it('should throw NAuthException when user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.deleteUser({ sub: mockUserSub })).rejects.toThrow(NAuthException);
    });
  });

  // ============================================================================
  // disableUser
  // ============================================================================

  describe('disableUser', () => {
    it('should disable user account', async () => {
      const disabledUser = { ...mockUser, isLocked: true, isActive: false };
      mockUserRepository.findOne
        .mockResolvedValueOnce(mockUser as any)
        .mockResolvedValueOnce(disabledUser as any);
      mockSessionService.revokeAllUserSessions.mockResolvedValue(3);

      const result = await service.disableUser({ sub: mockUserSub });

      expect(result.success).toBe(true);
      expect(result.user.isLocked).toBe(true);
      expect(result.revokedSessions).toBe(3);
      expect(mockUserRepository.update).toHaveBeenCalledWith(
        { id: mockUser.id },
        expect.objectContaining({
          isLocked: true,
          lockedUntil: null,
        }),
      );
    });

    it('should revoke all user sessions when disabling', async () => {
      const disabledUser = { ...mockUser, isLocked: true, isActive: false };
      mockUserRepository.findOne
        .mockResolvedValueOnce(mockUser as any)
        .mockResolvedValueOnce(disabledUser as any);
      mockSessionService.revokeAllUserSessions.mockResolvedValue(3);

      await service.disableUser({ sub: mockUserSub });

      expect(mockSessionService.revokeAllUserSessions).toHaveBeenCalledWith(mockUser.id, 'Account disabled');
    });

    it('should throw NAuthException when user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.disableUser({ sub: mockUserSub })).rejects.toThrow(NAuthException);
    });
  });

  // ============================================================================
  // enableUser
  // ============================================================================

  describe('enableUser', () => {
    it('should enable user account', async () => {
      const disabledUser = { ...mockUser, isLocked: true, isActive: false };
      const enabledUser = { ...disabledUser, isLocked: false, isActive: true };
      mockUserRepository.findOne
        .mockResolvedValueOnce(disabledUser as any)
        .mockResolvedValueOnce(enabledUser as any);

      const result = await service.enableUser({ sub: mockUserSub });

      expect(result.success).toBe(true);
      expect(result.user.isLocked).toBe(false);
      expect(mockUserRepository.update).toHaveBeenCalledWith(
        { id: mockUser.id },
        expect.objectContaining({
          isLocked: false,
          lockReason: null,
          lockedAt: null,
          lockedUntil: null,
        }),
      );
    });

    it('should throw NAuthException when user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.enableUser({ sub: mockUserSub })).rejects.toThrow(NAuthException);
    });
  });

  // ============================================================================
  // setMustChangePassword
  // ============================================================================

  describe('setMustChangePassword', () => {
    it('should set mustChangePassword flag', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);

      const result = await service.setMustChangePassword({
        sub: mockUserSub,
      });

      expect(result.success).toBe(true);
      expect(mockUserRepository.update).toHaveBeenCalledWith({ sub: mockUserSub }, { mustChangePassword: true });
    });

    it('should throw NAuthException when user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(
        service.setMustChangePassword({
          sub: mockUserSub,
        }),
      ).rejects.toThrow(NAuthException);
    });

    it('should throw NAuthException when user has no password', async () => {
      const socialUser = { ...mockUser, passwordHash: null };
      mockUserRepository.findOne.mockResolvedValue(socialUser as any);

      await expect(
        service.setMustChangePassword({
          sub: mockUserSub,
        }),
      ).rejects.toThrow(NAuthException);
      await expect(
        service.setMustChangePassword({
          sub: mockUserSub,
        }),
      ).rejects.toMatchObject({
        code: AuthErrorCode.PASSWORD_CHANGE_NOT_ALLOWED,
      });
    });
  });
});
