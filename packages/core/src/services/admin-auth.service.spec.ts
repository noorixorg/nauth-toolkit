import { Repository } from 'typeorm';
import { AdminAuthService } from './admin-auth.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';
import { ChallengeService } from './challenge.service';
import { AuthChallengeHelperService } from './auth-challenge-helper.service';
import { EmailVerificationService } from './email-verification.service';
import { ClientInfoService } from './client-info.service';
import { HookRegistryService } from './hook-registry.service';
import { NAuthLogger } from '../utils/nauth-logger';
import { BaseUser, BaseLoginAttempt, BaseMFADevice } from '../entities';
import { NAuthConfig } from '../interfaces/config.interface';
import { AccountLockoutStorageService } from '../storage/account-lockout-storage.service';
import { AuthErrorCode } from '../enums/error-codes.enum';

describe('AdminAuthService', () => {
  it('should initialize successfully with required dependencies', () => {
    const mockUserRepository = {} as Repository<BaseUser>;
    const mockLoginAttemptRepository = {} as Repository<BaseLoginAttempt>;
    const mockPasswordService = {} as PasswordService;
    const mockSessionService = {} as SessionService;
    const mockChallengeService = {} as ChallengeService;
    const mockChallengeHelper = {} as AuthChallengeHelperService;
    const mockEmailVerificationService = {} as EmailVerificationService;
    const mockClientInfoService = {} as ClientInfoService;
    const mockAccountLockoutStorage = {} as AccountLockoutStorageService;
    const mockConfig = {} as NAuthConfig;
    const mockLogger = { log: jest.fn() } as unknown as NAuthLogger;
    const mockHookRegistry = {} as HookRegistryService;
    const mockMfaDeviceRepository = {} as Repository<BaseMFADevice>;

    const service = new AdminAuthService(
      mockUserRepository,
      mockLoginAttemptRepository,
      mockPasswordService,
      mockSessionService,
      mockChallengeService,
      mockChallengeHelper,
      mockEmailVerificationService,
      mockClientInfoService,
      mockAccountLockoutStorage,
      mockConfig,
      mockLogger,
      mockHookRegistry,
      undefined,
      undefined,
      mockMfaDeviceRepository,
      undefined,
      undefined,
      undefined,
    );

    expect(service).toBeDefined();
  });

  describe('authorization enforcement', () => {
    /**
     * Build a service whose privileged methods are wired to a stub authorization
     * service, so we can assert which action each method asks for.
     */
    const buildService = (
      authorize: jest.Mock,
    ): { service: AdminAuthService; userService: { [k: string]: jest.Mock } } => {
      const service = new AdminAuthService(
        {} as Repository<BaseUser>,
        {} as Repository<BaseLoginAttempt>,
        {} as PasswordService,
        {} as SessionService,
        {} as ChallengeService,
        {} as AuthChallengeHelperService,
        {} as EmailVerificationService,
        {} as ClientInfoService,
        {} as AccountLockoutStorageService,
        {} as NAuthConfig,
        { log: jest.fn() } as unknown as NAuthLogger,
        {} as HookRegistryService,
        undefined,
        undefined,
        {} as Repository<BaseMFADevice>,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        { authorize } as never,
      );

      // The delegating methods forward to an internally constructed UserService;
      // stub it so the test exercises authorization rather than persistence.
      const userService = {
        deleteUser: jest.fn().mockResolvedValue({ success: true }),
        getUsers: jest.fn().mockResolvedValue({ users: [] }),
        getUserById: jest.fn().mockResolvedValue(null),
      };
      (service as unknown as { userService: unknown }).userService = userService;

      return { service, userService };
    };

    it('authorizes each privileged method with its own action and target', async () => {
      const authorize = jest.fn().mockResolvedValue(undefined);
      const { service } = buildService(authorize);

      await service.deleteUser({ sub: 'victim-9' } as never);
      await service.getUsers({} as never);
      await service.getUserById({ sub: 'someone' } as never);

      expect(authorize).toHaveBeenNthCalledWith(1, 'admin.user.delete', { targetSub: 'victim-9' });
      // A non-targeted action passes no target rather than a misleading one.
      expect(authorize).toHaveBeenNthCalledWith(2, 'admin.user.list');
      expect(authorize).toHaveBeenNthCalledWith(3, 'admin.user.read', { targetSub: 'someone' });
    });

    it('does not perform the operation when authorization denies', async () => {
      const authorize = jest.fn().mockRejectedValue(new Error('FORBIDDEN'));
      const { service, userService } = buildService(authorize);

      await expect(service.deleteUser({ sub: 'victim-9' } as never)).rejects.toThrow('FORBIDDEN');

      // The point of enforcing in the service: the work never starts.
      expect(userService.deleteUser).not.toHaveBeenCalled();
    });

    it('leaves confirmResetPassword unauthorized, since its caller is the end user', () => {
      // A public route: the user clicks an emailed link and submits a code. Authorizing
      // it would break password recovery entirely.
      const source = AdminAuthService.prototype.confirmResetPassword.toString();
      expect(source).not.toContain('authorizationService');
    });
  });

  describe('trusted device management', () => {
    /**
     * Build a service with a stubbed trusted-device service and user repository, so the
     * tests exercise targeting and authorization rather than persistence.
     */
    const buildService = (
      trustedDeviceService: Record<string, jest.Mock>,
      authorize: jest.Mock = jest.fn().mockResolvedValue(undefined),
    ): AdminAuthService => {
      const userRepository = {
        findOne: jest.fn().mockResolvedValue({ id: 5, sub: 'target-sub' }),
      } as unknown as Repository<BaseUser>;

      return new AdminAuthService(
        userRepository,
        {} as Repository<BaseLoginAttempt>,
        {} as PasswordService,
        {} as SessionService,
        {} as ChallengeService,
        {} as AuthChallengeHelperService,
        {} as EmailVerificationService,
        {} as ClientInfoService,
        {} as AccountLockoutStorageService,
        {} as NAuthConfig,
        { log: jest.fn(), error: jest.fn() } as unknown as NAuthLogger,
        {} as HookRegistryService,
        undefined,
        undefined,
        {} as Repository<BaseMFADevice>,
        trustedDeviceService as never,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        { authorize } as never,
      );
    };

    const validSub = 'a21b654c-2746-4168-acee-c175083a65cd';

    it('lists a target user devices and authorizes with the target', async () => {
      const authorize = jest.fn().mockResolvedValue(undefined);
      const getUserTrustedDevices = jest.fn().mockResolvedValue([{ id: 1 }]);
      const service = buildService({ getUserTrustedDevices }, authorize);

      const result = await service.getUserTrustedDevices({ sub: validSub });

      expect(result.trustedDevices).toHaveLength(1);
      expect(getUserTrustedDevices).toHaveBeenCalledWith(5);
      expect(authorize).toHaveBeenCalledWith('admin.trustedDevice.list', { targetSub: validSub });
    });

    it('revokes one device scoped to the target user', async () => {
      const revokeTrustedDeviceById = jest.fn().mockResolvedValue(true);
      const service = buildService({ revokeTrustedDeviceById });

      const result = await service.revokeUserTrustedDevice({ sub: validSub, deviceId: 9 });

      expect(result).toEqual({ success: true });
      expect(revokeTrustedDeviceById).toHaveBeenCalledWith(9, 5);
    });

    it('throws NOT_FOUND when the device does not belong to the target user', async () => {
      const revokeTrustedDeviceById = jest.fn().mockResolvedValue(false);
      const service = buildService({ revokeTrustedDeviceById });

      await expect(service.revokeUserTrustedDevice({ sub: validSub, deviceId: 9 })).rejects.toMatchObject({
        code: AuthErrorCode.NOT_FOUND,
      });
    });

    it('revokes every device and reports the count', async () => {
      const revokeAllTrustedDevices = jest.fn().mockResolvedValue({ revokedCount: 4, devices: [] });
      const service = buildService({ revokeAllTrustedDevices });

      const result = await service.revokeAllUserTrustedDevices({ sub: validSub });

      expect(result).toEqual({ revokedCount: 4 });
      expect(revokeAllTrustedDevices).toHaveBeenCalledWith(5);
    });

    it('does not touch devices when authorization denies', async () => {
      const authorize = jest.fn().mockRejectedValue(new Error('FORBIDDEN'));
      const revokeAllTrustedDevices = jest.fn();
      const service = buildService({ revokeAllTrustedDevices }, authorize);

      await expect(service.revokeAllUserTrustedDevices({ sub: validSub })).rejects.toThrow('FORBIDDEN');
      expect(revokeAllTrustedDevices).not.toHaveBeenCalled();
    });
  });

});
