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
});
