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

jest.mock(
  '@nauth-toolkit/social-microsoft',
  () => ({
    MicrosoftSocialAuthService: jest.fn(),
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

  it('should initialize Microsoft provider when enabled and register it', async () => {
    mockConfig.social = {
      microsoft: { enabled: true, clientId: 'id', clientSecret: 'secret', tenant: 'common' },
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

    expect(result.microsoftAuth).toBeDefined();
    expect(mockProviderRegistry.registerProvider).toHaveBeenCalledWith(result.microsoftAuth);
  });

  it('should pass hookRegistry and tokenVerifier in the positions the provider declares', async () => {
    // Regression: these two were swapped on the Express/Fastify path, so providers
    // received a token verifier where they expected a hook registry and vice versa.
    // The NestJS modules always got it right, which is why it went unnoticed.
    const { GoogleSocialAuthService } = jest.requireMock('@nauth-toolkit/social-google');
    // This suite has no global mock reset, so earlier tests have already recorded calls.
    (GoogleSocialAuthService as jest.Mock).mockClear();

    mockConfig.social = { google: { enabled: true } } as any;

    const hookRegistry = { executePreSignup: jest.fn() } as any;

    await initSocialAuth(
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
      undefined, // phoneVerificationService
      undefined, // auditService
      undefined, // trustedDeviceService
      undefined, // socialProviderSecretRepository
      hookRegistry,
    );

    // Positions 13 and 14 (0-indexed) are hookRegistry then tokenVerifier.
    const args = (GoogleSocialAuthService as jest.Mock).mock.calls[0];
    expect(args[13]).toBe(hookRegistry);
    expect(args[14]).toBeDefined();
    expect(args[14]).not.toBe(hookRegistry);
  });

  it('should keep initializing other providers when one package is not installed', async () => {
    // Regression: a missing optional package used to `return` out of initSocialAuth
    // entirely, so an uninstalled Google package silently disabled Apple and Facebook.
    jest.resetModules();

    jest.doMock(
      '@nauth-toolkit/social-google',
      () => {
        throw new Error("Cannot find module '@nauth-toolkit/social-google'");
      },
      { virtual: true },
    );
    jest.doMock(
      '@nauth-toolkit/social-facebook',
      () => ({
        FacebookSocialAuthService: jest.fn(),
        TokenVerifierService: jest.fn(),
      }),
      { virtual: true },
    );

    const { initSocialAuth: freshInitSocialAuth } = await import('./init-social');

    mockConfig.social = {
      google: { enabled: true },
      facebook: { enabled: true },
    } as any;

    const result = await freshInitSocialAuth(
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
    expect(result.facebookAuth).toBeDefined();
  });
});
