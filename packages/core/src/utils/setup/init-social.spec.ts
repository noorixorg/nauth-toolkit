/**
 * Init Social Auth Unit Tests
 *
 * Tests social authentication provider initialization functionality.
 */

import { Repository } from 'typeorm';
import { initSocialAuth } from './init-social';
import { NAuthConfig } from '../../interfaces/config.interface';
import { NAuthLogger, SocialAuthService, AuthService, ClientInfoService, BaseUser } from '../../index';
import {
  JwtService,
  SessionService,
  AuthChallengeHelperService,
  SocialProviderRegistry,
  TrustedDeviceService,
} from '../../internal';
import { ISocialAuthStateStore } from '../../interfaces/social-auth-state-store.interface';

// Mock dynamic imports
jest.mock(
  '@nauth-toolkit/social-google',
  () => ({
    GoogleSocialAuthService: jest.fn(),
    TokenVerifierService: jest.fn(),
  }),
  { virtual: true },
);

jest.mock(
  '@nauth-toolkit/social-apple',
  () => ({
    AppleSocialAuthService: jest.fn(),
    TokenVerifierService: jest.fn(),
  }),
  { virtual: true },
);

jest.mock(
  '@nauth-toolkit/social-facebook',
  () => ({
    FacebookSocialAuthService: jest.fn(),
    TokenVerifierService: jest.fn(),
  }),
  { virtual: true },
);

describe('initSocialAuth', () => {
  let mockConfig: NAuthConfig;
  let mockProviderRegistry: jest.Mocked<SocialProviderRegistry>;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockSocialAuthService: jest.Mocked<SocialAuthService>;
  let mockJwtService: jest.Mocked<JwtService>;
  let mockSessionService: jest.Mocked<SessionService>;
  let mockChallengeHelper: jest.Mocked<AuthChallengeHelperService>;
  let mockClientInfoService: jest.Mocked<ClientInfoService>;
  let mockLogger: jest.Mocked<NAuthLogger>;
  let mockSocialAuthStateStore: jest.Mocked<ISocialAuthStateStore>;
  let mockUserRepository: jest.Mocked<Repository<BaseUser>>;

  beforeEach(() => {
    mockConfig = {
      jwt: {
        accessToken: { secret: 'test', expiresIn: 3600 },
        refreshToken: { secret: 'test', expiresIn: 86400 },
      },
    } as NAuthConfig;

    mockProviderRegistry = {
      registerProvider: jest.fn(),
    } as any;

    mockAuthService = {} as any;
    mockSocialAuthService = {} as any;
    mockJwtService = {} as any;
    mockSessionService = {} as any;
    mockChallengeHelper = {} as any;
    mockClientInfoService = {} as any;

    mockLogger = {
      warn: jest.fn(),
      debug: jest.fn(),
      log: jest.fn(),
      error: jest.fn(),
    } as any;

    mockSocialAuthStateStore = {} as any;
    mockUserRepository = {} as any;
  });

  it('should return empty providers when no social providers are enabled', async () => {
    mockConfig.social = undefined;

    const result = await initSocialAuth(
      mockConfig,
      mockProviderRegistry,
      mockAuthService,
      mockSocialAuthService,
      mockJwtService,
      mockSessionService,
      mockChallengeHelper,
      mockClientInfoService,
      mockLogger,
      mockSocialAuthStateStore,
      mockUserRepository,
    );

    expect(result).toEqual({});
    expect(mockProviderRegistry.registerProvider).not.toHaveBeenCalled();
  });

  it('should skip Google provider when not enabled', async () => {
    mockConfig.social = {
      google: { enabled: false },
    } as any;

    const result = await initSocialAuth(
      mockConfig,
      mockProviderRegistry,
      mockAuthService,
      mockSocialAuthService,
      mockJwtService,
      mockSessionService,
      mockChallengeHelper,
      mockClientInfoService,
      mockLogger,
      mockSocialAuthStateStore,
      mockUserRepository,
    );

    expect(result.googleAuth).toBeUndefined();
  });

  it('should skip Apple provider when not enabled', async () => {
    mockConfig.social = {
      apple: { enabled: false },
    } as any;

    const result = await initSocialAuth(
      mockConfig,
      mockProviderRegistry,
      mockAuthService,
      mockSocialAuthService,
      mockJwtService,
      mockSessionService,
      mockChallengeHelper,
      mockClientInfoService,
      mockLogger,
      mockSocialAuthStateStore,
      mockUserRepository,
    );

    expect(result.appleAuth).toBeUndefined();
  });

  it('should skip Facebook provider when not enabled', async () => {
    mockConfig.social = {
      facebook: { enabled: false },
    } as any;

    const result = await initSocialAuth(
      mockConfig,
      mockProviderRegistry,
      mockAuthService,
      mockSocialAuthService,
      mockJwtService,
      mockSessionService,
      mockChallengeHelper,
      mockClientInfoService,
      mockLogger,
      mockSocialAuthStateStore,
      mockUserRepository,
    );

    expect(result.facebookAuth).toBeUndefined();
  });

  it('should initialize Google provider when enabled and register it', async () => {
    mockConfig.social = {
      google: { enabled: true },
    } as any;

    const result = await initSocialAuth(
      mockConfig,
      mockProviderRegistry,
      mockAuthService,
      mockSocialAuthService,
      mockJwtService,
      mockSessionService,
      mockChallengeHelper,
      mockClientInfoService,
      mockLogger,
      mockSocialAuthStateStore,
      mockUserRepository,
    );

    expect(result.googleAuth).toBeDefined();
    expect(mockProviderRegistry.registerProvider).toHaveBeenCalledWith(result.googleAuth);
  });
});
