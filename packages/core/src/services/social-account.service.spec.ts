import { Repository } from 'typeorm';
import { SocialAuthService } from './social-auth.service';
import { SocialProviderRegistry } from './social-provider-registry.service';
import { NAuthException } from '../exceptions/nauth.exception';
import { AuthService } from './auth.service';
import { IUser, ISocialAccount } from '../interfaces/entities.interface';
import { BaseUser, BaseSocialAccount } from '../entities';
import { AuthAuditService, InternalAuthAuditService } from './auth-audit.service';
import { NAuthLogger } from '../utils/nauth-logger';
import { AuthErrorCode } from '../enums/error-codes.enum';
import { AuthAuditEventType } from '../enums/auth-audit-event-type.enum';
import { ClientInfoService } from './client-info.service';
import { ContextStorage } from '../utils/context-storage';

/**
 * Social Auth Service Unit Tests
 *
 * Platform-agnostic: Uses direct instantiation, no NestJS dependencies.
 *
 * Tests social authentication and account management functionality including:
 * - OAuth authentication flows
 * - Listing linked accounts
 * - Unlinking accounts
 * - Password management for social-only users
 * - Internal methods for social auth provider integration
 */
describe('SocialAuthService', () => {
  let service: SocialAuthService;
  let mockProviderRegistry: jest.Mocked<SocialProviderRegistry>;
  let mockUserRepository: jest.Mocked<Repository<BaseUser>>;
  let mockSocialAccountRepository: jest.Mocked<Repository<BaseSocialAccount>>;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockClientInfoService: jest.Mocked<ClientInfoService>;
  let mockLogger: jest.Mocked<NAuthLogger>;
  let mockAuditService: jest.Mocked<InternalAuthAuditService>;

  // ============================================================================
  // Test Constants
  // ============================================================================
  // Use valid UUID v4 values to satisfy DTO validation (service now enforces ensureValidatedDto()).
  const mockUserSub = 'a21b654c-2746-4168-acee-c175083a65cd';
  const mockOtherUserSub = 'b21b654c-2746-4168-acee-c175083a65cd';

  const mockUser: IUser = {
    id: 1,
    sub: mockUserSub,
    email: 'user@example.com',
    username: 'testuser',
    phone: null,
    firstName: 'John',
    lastName: 'Doe',
    passwordHash: null, // Social-only user
    passwordChangedAt: null,
    passwordHistory: null,
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
    hasSocialAuth: true,
    socialProviders: ['google'],
    mfaEnabled: false,
    mfaMethods: null,
    preferredMfaMethod: null,
    backupCodes: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockSocialAccount: ISocialAccount = {
    id: 1,
    userId: 1,
    provider: 'google',
    providerId: 'google-123',
    providerEmail: 'user@gmail.com',
    linkedAt: new Date(),
    lastUsedAt: new Date(),
    metadata: { raw: 'data' },
    createdAt: new Date(),
    updatedAt: new Date(),
  } as ISocialAccount;

  /**
   * Run a service call with CURRENT_USER set.
   */
  const runAs = async <T>(user: IUser, callback: () => Promise<T>): Promise<T> => {
    return await ContextStorage.run(async () => {
      ContextStorage.set('CURRENT_USER', user);
      return await callback();
    });
  };

  const mockUserWithPassword: IUser = {
    ...mockUser,
    passwordHash: 'hashed-password',
  };

  beforeEach(() => {
    mockUserRepository = {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 } as any),
      save: jest.fn().mockResolvedValue(mockUser as any),
    } as any;

    mockSocialAccountRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      remove: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 } as any),
    } as any;

    mockAuthService = {
      changePassword: jest.fn().mockResolvedValue({ success: true }),
    } as any;

    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    } as any;

    mockAuditService = {
      recordEvent: jest.fn().mockResolvedValue(null),
    } as any;

    mockClientInfoService = {
      get: jest.fn().mockReturnValue({
        ipAddress: '1.2.3.4',
        userAgent: 'test-agent',
      }),
      getIpAddress: jest.fn().mockReturnValue('1.2.3.4'),
      getUserAgent: jest.fn().mockReturnValue('test-agent'),
      getDeviceToken: jest.fn().mockReturnValue(undefined),
    } as any;

    // Instantiate service directly
    mockProviderRegistry = {
      getProvider: jest.fn(),
      registerProvider: jest.fn(),
      hasProvider: jest.fn(),
      listProviders: jest.fn(),
    } as any;

    service = new SocialAuthService(
      mockProviderRegistry,
      mockUserRepository,
      mockSocialAccountRepository,
      mockAuthService,
      mockLogger,
      mockAuditService as unknown as InternalAuthAuditService,
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

  // ============================================================================
  // getLinkedAccounts
  // ============================================================================

  describe('getLinkedAccounts', () => {
    it('should return linked social accounts for user', async () => {
      const mockAccounts = [mockSocialAccount];
      mockSocialAccountRepository.find.mockResolvedValue(mockAccounts as any);

      const result = await runAs(mockUser, () => service.getLinkedAccounts({}));

      expect(result).toEqual({
        accounts: [
          {
            provider: 'google',
            providerEmail: 'user@gmail.com',
            linkedAt: mockSocialAccount.linkedAt,
            lastUsedAt: mockSocialAccount.lastUsedAt || undefined,
          },
        ],
      });
      expect(mockSocialAccountRepository.find).toHaveBeenCalledWith({
        where: { userId: 1 } as any,
        order: { linkedAt: 'DESC' } as any,
      });
    });

    it('should return empty accounts array when user has no social accounts', async () => {
      mockSocialAccountRepository.find.mockResolvedValue([]);

      const result = await runAs(mockUser, () => service.getLinkedAccounts({}));

      expect(result).toEqual({ accounts: [] });
    });

    it('should handle accounts without providerEmail', async () => {
      const accountWithoutEmail = { ...mockSocialAccount, providerEmail: null };
      mockSocialAccountRepository.find.mockResolvedValue([accountWithoutEmail] as any);

      const result = await runAs(mockUser, () => service.getLinkedAccounts({}));

      expect(result.accounts[0].providerEmail).toBeUndefined();
    });

    it('should handle accounts without lastUsedAt', async () => {
      const accountWithoutLastUsed = { ...mockSocialAccount, lastUsedAt: null };
      mockSocialAccountRepository.find.mockResolvedValue([accountWithoutLastUsed] as any);

      const result = await runAs(mockUser, () => service.getLinkedAccounts({}));

      expect(result.accounts[0].lastUsedAt).toBeUndefined();
    });

    it('should return multiple accounts sorted by linkedAt DESC', async () => {
      const account1 = { ...mockSocialAccount, id: 1, provider: 'google', linkedAt: new Date('2024-01-01') };
      const account2 = { ...mockSocialAccount, id: 2, provider: 'apple', linkedAt: new Date('2024-02-01') };
      mockSocialAccountRepository.find.mockResolvedValue([account2, account1] as any); // Repository returns sorted

      const result = await runAs(mockUser, () => service.getLinkedAccounts({}));

      expect(result.accounts.length).toBe(2);
      expect(result.accounts[0].provider).toBe('apple'); // Most recent first
      expect(result.accounts[1].provider).toBe('google');
    });
  });

  // ============================================================================
  // unlinkSocialAccount
  // ============================================================================

  describe('unlinkSocialAccount', () => {
    it('should unlink social account from user', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockSocialAccountRepository.findOne.mockResolvedValue(mockSocialAccount as any);
      mockSocialAccountRepository.remove.mockResolvedValue(mockSocialAccount as any);
      mockSocialAccountRepository.find.mockResolvedValue([]); // No accounts left after unlink

      const result = await runAs(mockUser, () => service.unlinkSocialAccount({ provider: 'google' }));

      expect(result).toEqual({ message: 'google account unlinked successfully' });
      expect(mockSocialAccountRepository.remove).toHaveBeenCalledWith(mockSocialAccount);
      expect(mockAuditService.recordEvent).toHaveBeenCalledWith(
        (expect as any).objectContaining({
          userId: 1,
          eventType: AuthAuditEventType.SOCIAL_ACCOUNT_UNLINKED,
          eventStatus: 'INFO',
          authMethod: 'google',
        }),
      );
    });

    it('should throw NAuthException when social account not found for user', async () => {
      mockSocialAccountRepository.findOne.mockResolvedValue(null);

      try {
        await runAs(mockUser, () => service.unlinkSocialAccount({ provider: 'google' }));
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
        expect(error.code).toBe(AuthErrorCode.SOCIAL_ACCOUNT_NOT_FOUND);
      }
    });

    it('should throw NAuthException when social account not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockSocialAccountRepository.findOne.mockResolvedValue(null);

      try {
        await runAs(mockUser, () => service.unlinkSocialAccount({ provider: 'google' }));
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
        expect(error.code).toBe(AuthErrorCode.SOCIAL_ACCOUNT_NOT_FOUND);
        expect(error.message).toContain('google account is not linked');
      }
      expect(mockSocialAccountRepository.remove).not.toHaveBeenCalled();
    });

    it('should update user social flags after unlinking', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockSocialAccountRepository.findOne.mockResolvedValue(mockSocialAccount as any);
      mockSocialAccountRepository.remove.mockResolvedValue(mockSocialAccount as any);
      mockSocialAccountRepository.find.mockResolvedValue([]); // No accounts left

      await runAs(mockUser, () => service.unlinkSocialAccount({ provider: 'google' }));

      // updateUserSocialFlags uses save() instead of update()
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          hasSocialAuth: false,
          socialProviders: null,
        }),
      );
    });

    it('should update user social flags when other accounts remain', async () => {
      const appleAccount = { ...mockSocialAccount, id: 2, provider: 'apple' };
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockSocialAccountRepository.findOne.mockResolvedValue(mockSocialAccount as any);
      mockSocialAccountRepository.remove.mockResolvedValue(mockSocialAccount as any);
      mockSocialAccountRepository.find.mockResolvedValue([appleAccount] as any); // Apple account remains

      await runAs(mockUser, () => service.unlinkSocialAccount({ provider: 'google' }));

      // updateUserSocialFlags uses save() instead of update()
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          hasSocialAuth: true,
          socialProviders: ['apple'],
        }),
      );
    });

    it('should handle unlink for different providers', async () => {
      const appleAccount = { ...mockSocialAccount, id: 2, provider: 'apple', providerId: 'apple-456' };
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockSocialAccountRepository.findOne.mockResolvedValue(appleAccount as any);
      mockSocialAccountRepository.remove.mockResolvedValue(appleAccount as any);
      mockSocialAccountRepository.find.mockResolvedValue([]);

      const result = await runAs(mockUser, () => service.unlinkSocialAccount({ provider: 'apple' }));

      expect(result.message).toContain('apple account unlinked successfully');
      expect(mockAuditService.recordEvent).toHaveBeenCalledWith(
        (expect as any).objectContaining({
          authMethod: 'apple',
        }),
      );
    });

    it('should handle audit logging errors gracefully', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockSocialAccountRepository.findOne.mockResolvedValue(mockSocialAccount as any);
      mockSocialAccountRepository.remove.mockResolvedValue(mockSocialAccount as any);
      mockSocialAccountRepository.find.mockResolvedValue([]);
      mockAuditService.recordEvent.mockRejectedValue(new Error('Audit error'));

      const result = await runAs(mockUser, () => service.unlinkSocialAccount({ provider: 'google' }));

      expect(result.message).toBeDefined(); // Should still unlink
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('should handle database errors during unlinking', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockSocialAccountRepository.findOne.mockResolvedValue(mockSocialAccount as any);
      mockSocialAccountRepository.remove.mockRejectedValue(new Error('Database error'));

      try {
        await runAs(mockUser, () => service.unlinkSocialAccount({ provider: 'google' }));
        fail('Should have thrown Error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Database error');
      }
    });

    it('should include providerEmail in audit metadata when available', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockSocialAccountRepository.findOne.mockResolvedValue(mockSocialAccount as any);
      mockSocialAccountRepository.remove.mockResolvedValue(mockSocialAccount as any);
      mockSocialAccountRepository.find.mockResolvedValue([]);

      await runAs(mockUser, () => service.unlinkSocialAccount({ provider: 'google' }));

      expect(mockAuditService.recordEvent).toHaveBeenCalledWith(
        (expect as any).objectContaining({
          metadata: {
            provider: 'google',
            providerEmail: 'user@gmail.com',
          },
        }),
      );
    });

    it('should include null providerEmail in audit metadata when not available', async () => {
      const accountWithoutEmail = { ...mockSocialAccount, providerEmail: null };
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockSocialAccountRepository.findOne.mockResolvedValue(accountWithoutEmail as any);
      mockSocialAccountRepository.remove.mockResolvedValue(accountWithoutEmail as any);
      mockSocialAccountRepository.find.mockResolvedValue([]);

      await runAs(mockUser, () => service.unlinkSocialAccount({ provider: 'google' }));

      expect(mockAuditService.recordEvent).toHaveBeenCalledWith(
        (expect as any).objectContaining({
          metadata: {
            provider: 'google',
            providerEmail: null,
          },
        }),
      );
    });
  });

  // ============================================================================
  // canSetPassword
  // ============================================================================

  describe('canSetPassword', () => {
    it('should return true for social-only user (no password hash)', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);

      const result = await service.canSetPassword({ sub: mockUserSub });

      expect(result.canSetPassword).toBe(true);
    });

    it('should return false for user with password', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUserWithPassword as any);

      const result = await service.canSetPassword({ sub: mockUserSub });

      expect(result.canSetPassword).toBe(false);
    });

    it('should return false when user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const result = await service.canSetPassword({ sub: mockOtherUserSub });

      expect(result.canSetPassword).toBe(false);
    });
  });

  // ============================================================================
  // setPasswordForSocialUser
  // ============================================================================

  describe('setPasswordForSocialUser', () => {
    it('should set password for social-only user', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockAuthService.changePassword.mockResolvedValue({ success: true });

      const result = await runAs(mockUser, () =>
        service.setPasswordForSocialUser({ sub: mockUserSub, password: 'newpassword' }),
      );

      expect(result).toEqual({ message: 'Password set successfully' });
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { sub: mockUserSub } });
      expect(mockAuthService.changePassword).toHaveBeenCalledWith(
        expect.objectContaining({
          oldPassword: '',
          newPassword: 'newpassword',
        }),
      );
    });

    it('should throw NAuthException when sub does not match current user', async () => {
      const otherUser = { ...mockUser, sub: mockOtherUserSub };
      mockUserRepository.findOne.mockResolvedValue(otherUser as any);

      try {
        await runAs(mockUser, () =>
          service.setPasswordForSocialUser({ sub: mockOtherUserSub, password: 'newpassword' }),
        );
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
        expect(error.code).toBe(AuthErrorCode.FORBIDDEN);
      }
    });

    it('should throw NAuthException when user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      try {
        await runAs(mockUser, () =>
          service.setPasswordForSocialUser({ sub: mockOtherUserSub, password: 'newpassword' }),
        );
        fail('Should have thrown NAuthException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(NAuthException);
        expect(error.code).toBe(AuthErrorCode.NOT_FOUND);
      }
    });

    it('should handle database errors during password setting', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockAuthService.changePassword.mockRejectedValue(new Error('Database error'));

      try {
        await runAs(mockUser, () =>
          service.setPasswordForSocialUser({ sub: mockUserSub, password: 'newpassword' }),
        );
        fail('Should have thrown Error');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Database error');
      }
    });
  });

  // ============================================================================
  // updateUserSocialFlags (tested through public methods)
  // ============================================================================

  describe('updateUserSocialFlags', () => {
    it('should update user flags when social accounts exist', async () => {
      mockSocialAccountRepository.find.mockResolvedValue([mockSocialAccount] as any);
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);

      // Access private method through type assertion
      await (service as any).updateUserSocialFlags(1);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          hasSocialAuth: true,
          socialProviders: ['google'],
        }),
      );
    });

    it('should update user flags when no social accounts remain', async () => {
      mockSocialAccountRepository.find.mockResolvedValue([]);
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);

      await (service as any).updateUserSocialFlags(1);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          hasSocialAuth: false,
          socialProviders: null,
        }),
      );
    });

    it('should handle multiple social providers', async () => {
      const accountsWithMultipleProviders = [
        { ...mockSocialAccount, provider: 'google' },
        { ...mockSocialAccount, provider: 'apple', id: 2 },
      ];
      mockSocialAccountRepository.find.mockResolvedValue(accountsWithMultipleProviders as any);
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);

      await (service as any).updateUserSocialFlags(1);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          hasSocialAuth: true,
          socialProviders: ['google', 'apple'],
        }),
      );
    });

    it('should handle null user id in social account', async () => {
      const accountWithNullUserId = { ...mockSocialAccount, userId: null, provider: 'google' };
      mockSocialAccountRepository.find.mockResolvedValue([accountWithNullUserId] as any);
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);

      await (service as any).updateUserSocialFlags(1);

      // Should still update with the providers found
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          hasSocialAuth: true,
          socialProviders: ['google'],
        }),
      );
    });

    it('should handle empty social accounts array', async () => {
      mockSocialAccountRepository.find.mockResolvedValue([]);
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);

      await (service as any).updateUserSocialFlags(1);

      expect(mockUserRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
      expect(mockUserRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          hasSocialAuth: false,
          socialProviders: null,
        }),
      );
    });
  });

  // ============================================================================
  // Internal Methods (for social auth provider integration)
  // ============================================================================

  describe('findSocialAccountByProvider', () => {
    it('should find social account by provider and provider ID', async () => {
      mockSocialAccountRepository.findOne.mockResolvedValue(mockSocialAccount as any);

      const result = await service.findSocialAccountByProvider('google', 'google-123');

      expect(result).toEqual(mockSocialAccount);
      expect(mockSocialAccountRepository.findOne).toHaveBeenCalledWith({
        where: { provider: 'google', providerId: 'google-123' } as any,
        relations: ['user'],
      });
    });

    it('should return null when account not found', async () => {
      mockSocialAccountRepository.findOne.mockResolvedValue(null);

      const result = await service.findSocialAccountByProvider('google', 'nonexistent-id');

      expect(result).toBeNull();
    });
  });

  describe('findSocialAccountByUser', () => {
    it('should find social account by user ID and provider', async () => {
      mockSocialAccountRepository.findOne.mockResolvedValue(mockSocialAccount as any);

      const result = await service.findSocialAccountByUser(1, 'google');

      expect(result).toEqual(mockSocialAccount);
      expect(mockSocialAccountRepository.findOne).toHaveBeenCalledWith({
        where: { userId: 1, provider: 'google' } as any,
      });
    });

    it('should return null when account not found', async () => {
      mockSocialAccountRepository.findOne.mockResolvedValue(null);

      const result = await service.findSocialAccountByUser(1, 'nonexistent-provider');

      expect(result).toBeNull();
    });
  });

  describe('createOrUpdateSocialAccount', () => {
    it('should create new social account when not exists', async () => {
      mockSocialAccountRepository.findOne.mockResolvedValue(null);
      const createdAccount = { ...mockSocialAccount };
      mockSocialAccountRepository.create.mockReturnValue(createdAccount as any);
      mockSocialAccountRepository.save.mockResolvedValue(createdAccount as any);
      mockSocialAccountRepository.find.mockResolvedValue([createdAccount] as any);
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);

      await service.createOrUpdateSocialAccount(1, 'google', 'google-123', 'user@gmail.com', { raw: 'data' });

      expect(mockSocialAccountRepository.create).toHaveBeenCalledWith({
        userId: 1,
        provider: 'google',
        providerId: 'google-123',
        providerEmail: 'user@gmail.com',
        linkedAt: (expect as any).any(Date),
        lastUsedAt: (expect as any).any(Date),
        metadata: { raw: 'data' },
      });
      expect(mockSocialAccountRepository.save).toHaveBeenCalled();
      expect(mockUserRepository.save).toHaveBeenCalled(); // Flags updated
    });

    it('should update existing social account', async () => {
      const existingAccount = { ...mockSocialAccount };
      mockSocialAccountRepository.findOne.mockResolvedValue(existingAccount as any);
      mockSocialAccountRepository.save.mockResolvedValue(existingAccount as any);
      mockSocialAccountRepository.find.mockResolvedValue([existingAccount] as any);
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);

      await service.createOrUpdateSocialAccount(1, 'google', 'google-123', 'updated@gmail.com', { new: 'data' });

      expect(existingAccount.providerEmail).toBe('updated@gmail.com');
      expect(existingAccount.lastUsedAt).toBeInstanceOf(Date);
      expect(existingAccount.metadata).toEqual({ new: 'data' });
      expect(mockSocialAccountRepository.save).toHaveBeenCalledWith(existingAccount);
      expect(mockUserRepository.save).toHaveBeenCalled(); // Flags updated
    });

    it('should handle null providerEmail', async () => {
      mockSocialAccountRepository.findOne.mockResolvedValue(null);
      const createdAccount = { ...mockSocialAccount };
      mockSocialAccountRepository.create.mockReturnValue(createdAccount as any);
      mockSocialAccountRepository.save.mockResolvedValue(createdAccount as any);
      mockSocialAccountRepository.find.mockResolvedValue([createdAccount] as any);

      await service.createOrUpdateSocialAccount(1, 'google', 'google-123', null, undefined);

      expect(mockSocialAccountRepository.create).toHaveBeenCalledWith(
        (expect as any).objectContaining({
          providerEmail: null,
          metadata: null,
        }),
      );
    });

    it('should handle undefined providerEmail', async () => {
      mockSocialAccountRepository.findOne.mockResolvedValue(null);
      const createdAccount = { ...mockSocialAccount };
      mockSocialAccountRepository.create.mockReturnValue(createdAccount as any);
      mockSocialAccountRepository.save.mockResolvedValue(createdAccount as any);
      mockSocialAccountRepository.find.mockResolvedValue([createdAccount] as any);

      await service.createOrUpdateSocialAccount(1, 'google', 'google-123', undefined, undefined);

      expect(mockSocialAccountRepository.create).toHaveBeenCalledWith(
        (expect as any).objectContaining({
          providerEmail: null,
          metadata: null,
        }),
      );
    });

    it('should update lastUsedAt when updating existing account', async () => {
      const existingAccount = {
        ...mockSocialAccount,
        lastUsedAt: new Date('2024-01-01'),
      };
      mockSocialAccountRepository.findOne.mockResolvedValue(existingAccount as any);
      mockSocialAccountRepository.save.mockResolvedValue(existingAccount as any);
      mockSocialAccountRepository.find.mockResolvedValue([existingAccount] as any);

      const beforeUpdate = existingAccount.lastUsedAt.getTime();
      await service.createOrUpdateSocialAccount(1, 'google', 'google-123', 'user@gmail.com', undefined);

      // lastUsedAt should be updated to current time
      expect(existingAccount.lastUsedAt.getTime()).toBeGreaterThan(beforeUpdate);
    });
  });

  // ============================================================================
  // Service Without Optional Dependencies
  // ============================================================================

  describe('Service without optional dependencies', () => {
    it('should work without audit service', async () => {
      const serviceWithoutAudit = new SocialAuthService(
        mockProviderRegistry,
        mockUserRepository,
        mockSocialAccountRepository,
        mockAuthService,
        mockLogger,
        undefined, // No audit service
      );

      mockSocialAccountRepository.find.mockResolvedValue([mockSocialAccount] as any);

      const result = await runAs(mockUser, () => serviceWithoutAudit.getLinkedAccounts({}));

      // Should not throw error
      expect(result).toBeDefined();
    });
  });
});
