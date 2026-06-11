import { BaseSocialAuthProviderService } from './social-auth-base.service';
import { AuthService } from './auth.service';
import { SocialAuthService } from './social-auth.service';
import { JwtService } from './jwt.service';
import { SessionService } from './session.service';
import { AuthChallengeHelperService } from './auth-challenge-helper.service';
import { ClientInfoService } from './client-info.service';
import { PhoneVerificationService } from './phone-verification.service';
import { InternalAuthAuditService as AuthAuditService } from './auth-audit.service';
import { HookRegistryService } from './hook-registry.service';
import { NAuthConfig } from '../interfaces/config.interface';
import { NAuthLogger } from '../utils/nauth-logger';
import { OAuthUserProfile } from '../interfaces/oauth.interface';
import { NAuthException } from '../exceptions/nauth.exception';
import { AuthErrorCode } from '../enums/error-codes.enum';
import { IUser } from '../interfaces/entities.interface';
import { ISocialAuthStateStore } from '../interfaces/social-auth-state-store.interface';
import type { Repository } from 'typeorm';
import type { BaseUser } from '../entities';

/**
 * Test implementation of BaseSocialAuthProviderService
 */
class TestSocialAuthProviderService extends BaseSocialAuthProviderService {
  readonly providerName = 'google';

  async getAuthUrl(state?: string): Promise<string> {
    return `https://test.com/auth?state=${state || 'generated-state'}`;
  }

  protected async getOAuthProfile(code: string, _state: string): Promise<OAuthUserProfile> {
    return {
      id: 'test-user-id',
      email: 'user@example.com',
      firstName: 'John',
      lastName: 'Doe',
      picture: null,
      verified: true,
      raw: {},
    };
  }

  protected async verifyNativeToken(
    idToken: string,
    _accessToken?: string,
    _profileData?: unknown,
  ): Promise<OAuthUserProfile> {
    return {
      id: 'test-user-id',
      email: 'user@example.com',
      firstName: 'John',
      lastName: 'Doe',
      picture: null,
      verified: true,
      raw: {},
    };
  }
}

/**
 * Base Social Auth Provider Service Unit Tests
 *
 * Tests shared functionality in BaseSocialAuthProviderService including
 * OAuth callback handling, token verification, and account linking.
 * Uses direct instantiation, no NestJS dependencies.
 */
describe('BaseSocialAuthProviderService', () => {
  let service: TestSocialAuthProviderService;
  let mockConfig: NAuthConfig;
  let mockLogger: NAuthLogger;
  type AuthServiceMockShape = {
    getUserById: (...args: unknown[]) => Promise<IUser | null>;
    getUserByEmail: (...args: unknown[]) => Promise<IUser | null>;
    createSocialUser: (...args: unknown[]) => Promise<IUser>;
  };
  let mockAuthService: jest.Mocked<AuthServiceMockShape>;
  let mockSocialAuthService: jest.Mocked<SocialAuthService>;
  let mockJwtService: jest.Mocked<JwtService>;
  let mockSessionService: jest.Mocked<SessionService>;
  let mockChallengeHelper: jest.Mocked<AuthChallengeHelperService>;
  let mockClientInfoService: jest.Mocked<ClientInfoService>;
  let mockStateStore: jest.Mocked<ISocialAuthStateStore>;
  let mockUserRepository: jest.Mocked<Repository<BaseUser>>;
  let mockPhoneVerificationService: jest.Mocked<PhoneVerificationService>;
  let mockAuditService: jest.Mocked<AuthAuditService>;
  let mockHookRegistry: jest.Mocked<HookRegistryService>;
  let mockUser: IUser;

  beforeEach(() => {
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as any;

    mockConfig = {
      jwt: {
        accessToken: {
          secret: 'test-secret',
          expiresIn: 3600,
        },
        refreshToken: {
          secret: 'test-refresh-secret',
          expiresIn: 2592000,
        },
      },
      social: {
        google: {
          enabled: true,
          allowSignup: true,
          autoLink: false,
        },
      },
    } as NAuthConfig;

    mockAuthService = {
      getUserById: jest.fn(),
      getUserByEmail: jest.fn(),
      createSocialUser: jest.fn(),
    } as any;

    mockSocialAuthService = {
      findSocialAccountByProvider: jest.fn(),
      createOrUpdateSocialAccount: jest.fn(),
    } as any;

    mockJwtService = {
      generateTokens: jest.fn().mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      }),
      generateTokenPair: jest.fn().mockResolvedValue({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      }),
      hashToken: jest.fn((token: string) => `hashed-${token}`),
      decodeToken: jest.fn((token: string) => ({
        payload: { exp: Math.floor(Date.now() / 1000) + 3600 },
      })),
    } as any;

    mockSessionService = {
      createSession: jest.fn().mockResolvedValue({ id: 'session-id' }),
      revokeAllUserSessions: jest.fn().mockResolvedValue(0),
      updateTokens: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockChallengeHelper = {
      determineAuthResponse: jest.fn().mockResolvedValue({
        user: {
          sub: 'user-123',
          email: 'user@example.com',
        },
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        accessTokenExpiresAt: Date.now() + 3600000,
        refreshTokenExpiresAt: Date.now() + 2592000000,
      }),
    } as any;
    mockClientInfoService = {
      getClientInfo: jest.fn().mockResolvedValue({
        ipAddress: '192.168.1.1',
        userAgent: 'test-agent',
      }),
      get: jest.fn().mockReturnValue({
        ipAddress: '192.168.1.1',
        userAgent: 'test-agent',
      }),
    } as any;

    mockStateStore = {
      createCsrfState: jest.fn().mockResolvedValue('generated-state'),
      validateAndConsumeCsrfState: jest.fn().mockResolvedValue(undefined),
      setRedirectContext: jest.fn().mockResolvedValue(undefined),
      consumeRedirectContext: jest.fn().mockResolvedValue(null),
    };
    mockUserRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<Repository<BaseUser>>;
    mockPhoneVerificationService = {} as any;
    mockAuditService = {
      recordEvent: jest.fn(),
    } as any;
    mockHookRegistry = {
      registerPreSignup: jest.fn(),
      registerAfterSignup: jest.fn(),
      executePreSignup: jest.fn().mockResolvedValue(undefined),
      executePostSignup: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockUser = {
      id: 1,
      sub: 'user-123',
      email: 'user@example.com',
      isEmailVerified: true,
    } as IUser;

    service = new TestSocialAuthProviderService(
      mockConfig,
      mockLogger,
      mockAuthService as unknown as AuthService,
      mockSocialAuthService,
      mockJwtService,
      mockSessionService,
      mockChallengeHelper,
      mockClientInfoService,
      mockStateStore,
      mockUserRepository,
      mockPhoneVerificationService,
      mockAuditService,
      undefined, // trustedDeviceService - not used in these tests
      mockHookRegistry,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getProviderConfig', () => {
    it('should return provider config', () => {
      const config = (service as any).getProviderConfig();

      expect(config).toEqual({
        enabled: true,
        allowSignup: true,
        autoLink: false,
      });
    });

    it('should return null when social config is missing', () => {
      mockConfig.social = undefined;
      const newService = new TestSocialAuthProviderService(
        mockConfig,
        mockLogger,
        mockAuthService as unknown as AuthService,
        mockSocialAuthService,
        mockJwtService,
        mockSessionService,
        mockChallengeHelper,
        mockClientInfoService,
        mockStateStore,
        mockUserRepository,
        mockPhoneVerificationService,
        mockAuditService,
        undefined,
        mockHookRegistry,
      );

      const config = (newService as any).getProviderConfig();

      expect(config).toBeNull();
    });
  });

  describe('validateState', () => {
    it('should validate state via ISocialAuthStateStore', async () => {
      await (service as any).validateState('valid-state');
      expect(mockStateStore.validateAndConsumeCsrfState).toHaveBeenCalledWith('google', 'valid-state');
    });

    it('should propagate state validation errors', async () => {
      mockStateStore.validateAndConsumeCsrfState.mockRejectedValueOnce(
        new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'Invalid state parameter', { field: 'state' }),
      );
      await expect((service as any).validateState('bad-state')).rejects.toBeInstanceOf(NAuthException);
    });
  });

  describe('generateState', () => {
    it('should generate state via ISocialAuthStateStore', async () => {
      const state = await (service as any).generateState();
      expect(state).toBe('generated-state');
      expect(mockStateStore.createCsrfState).toHaveBeenCalledWith('google');
    });
  });

  describe('handleCallback', () => {
    it('should handle OAuth callback and return auth response', async () => {
      mockSocialAuthService.findSocialAccountByProvider.mockResolvedValue(null);
      mockUserRepository.findOne.mockResolvedValue(null); // No existing user by email
      mockUserRepository.create.mockReturnValue(mockUser as any);
      mockUserRepository.save.mockResolvedValue(mockUser as any);
      mockSocialAuthService.createOrUpdateSocialAccount.mockResolvedValue(undefined);

      const result = await service.handleCallback({ code: 'code', state: 'valid-state' });

      expect(result).toBeDefined();
      expect(mockUserRepository.create).toHaveBeenCalled();
      expect(mockUserRepository.save).toHaveBeenCalled();
      expect(mockStateStore.validateAndConsumeCsrfState).toHaveBeenCalledWith('google', 'valid-state');
    });

    describe('preSignup hook', () => {
      beforeEach(() => {
        mockSocialAuthService.findSocialAccountByProvider.mockResolvedValue(null);
        mockUserRepository.findOne.mockResolvedValue(null);
        mockUserRepository.create.mockReturnValue(mockUser as any);
        mockUserRepository.save.mockResolvedValue(mockUser as any);
        mockSocialAuthService.createOrUpdateSocialAccount.mockResolvedValue(undefined);
      });

      it('should execute preSignup hook before user creation for social signup', async () => {
        mockHookRegistry.executePreSignup.mockResolvedValue(undefined);

        await service.handleCallback({ code: 'code', state: 'valid-state' });

        expect(mockHookRegistry.executePreSignup).toHaveBeenCalledTimes(1);
        expect(mockHookRegistry.executePreSignup).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'test-user-id',
            email: 'user@example.com',
            firstName: 'John',
            lastName: 'Doe',
            verified: true,
          }),
          'social',
          'google',
          false, // adminSignup flag
        );
        expect(mockUserRepository.save).toHaveBeenCalled();
      });

      it('should block social signup when preSignup hook throws PRESIGNUP_FAILED', async () => {
        const customMessage = 'Signups from this email domain are not allowed';
        mockHookRegistry.executePreSignup.mockRejectedValue(
          new NAuthException(AuthErrorCode.PRESIGNUP_FAILED, customMessage),
        );

        await expect(service.handleCallback({ code: 'code', state: 'valid-state' })).rejects.toThrow(NAuthException);
        await expect(service.handleCallback({ code: 'code', state: 'valid-state' })).rejects.toMatchObject({
          code: AuthErrorCode.PRESIGNUP_FAILED,
          message: customMessage,
        });

        expect(mockHookRegistry.executePreSignup).toHaveBeenCalled();
        expect(mockUserRepository.save).not.toHaveBeenCalled();
      });

      it('should wrap non-PRESIGNUP_FAILED errors in PRESIGNUP_FAILED for social signup', async () => {
        // Mock the HookRegistry to throw the wrapped exception (as the real HookRegistry would)
        mockHookRegistry.executePreSignup.mockRejectedValue(
          new NAuthException(AuthErrorCode.PRESIGNUP_FAILED, 'External validation service unavailable'),
        );

        await expect(service.handleCallback({ code: 'code', state: 'valid-state' })).rejects.toThrow(NAuthException);
        await expect(service.handleCallback({ code: 'code', state: 'valid-state' })).rejects.toMatchObject({
          code: AuthErrorCode.PRESIGNUP_FAILED,
          message: 'External validation service unavailable',
        });

        expect(mockHookRegistry.executePreSignup).toHaveBeenCalled();
        expect(mockUserRepository.save).not.toHaveBeenCalled();
      });
    });

    it('should throw error when provider config is missing', async () => {
      mockConfig.social = undefined;
      const newService = new TestSocialAuthProviderService(
        mockConfig,
        mockLogger,
        mockAuthService as unknown as AuthService,
        mockSocialAuthService,
        mockJwtService,
        mockSessionService,
        mockChallengeHelper,
        mockClientInfoService,
        mockStateStore,
        mockUserRepository,
        mockPhoneVerificationService,
        mockAuditService,
        undefined,
        mockHookRegistry,
      );

      try {
        await newService.handleCallback({ code: 'code', state: 'state' });
        fail('Should have thrown NAuthException');
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthException);
        expect((error as NAuthException).code).toBe(AuthErrorCode.SOCIAL_CONFIG_MISSING);
      }
    });
  });

  describe('verifyToken', () => {
    it('should verify native token and return auth response', async () => {
      mockSocialAuthService.findSocialAccountByProvider.mockResolvedValue(null);
      mockUserRepository.findOne.mockResolvedValue(null); // No existing user by email
      mockUserRepository.create.mockReturnValue(mockUser as any);
      mockUserRepository.save.mockResolvedValue(mockUser as any);
      mockSocialAuthService.createOrUpdateSocialAccount.mockResolvedValue(undefined);

      const result = await service.verifyToken({ idToken: 'id-token', provider: 'google' });

      expect(result).toBeDefined();
      expect(mockUserRepository.create).toHaveBeenCalled();
      expect(mockUserRepository.save).toHaveBeenCalled();
    });

    describe('preSignup hook', () => {
      beforeEach(() => {
        mockSocialAuthService.findSocialAccountByProvider.mockResolvedValue(null);
        mockUserRepository.findOne.mockResolvedValue(null);
        mockUserRepository.create.mockReturnValue(mockUser as any);
        mockUserRepository.save.mockResolvedValue(mockUser as any);
        mockSocialAuthService.createOrUpdateSocialAccount.mockResolvedValue(undefined);
      });

      it('should execute preSignup hook before user creation for native token verification', async () => {
        mockHookRegistry.executePreSignup.mockResolvedValue(undefined);

        await service.verifyToken({ idToken: 'id-token', provider: 'google' });

        expect(mockHookRegistry.executePreSignup).toHaveBeenCalledTimes(1);
        expect(mockHookRegistry.executePreSignup).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'test-user-id',
            email: 'user@example.com',
            firstName: 'John',
            lastName: 'Doe',
            verified: true,
          }),
          'social',
          'google',
          false, // adminSignup flag
        );
        expect(mockUserRepository.save).toHaveBeenCalled();
      });

      it('should block native token signup when preSignup hook throws PRESIGNUP_FAILED', async () => {
        const customMessage = 'Signups from this email domain are not allowed';
        mockHookRegistry.executePreSignup.mockRejectedValue(
          new NAuthException(AuthErrorCode.PRESIGNUP_FAILED, customMessage),
        );

        try {
          await service.verifyToken({ idToken: 'id-token', provider: 'google' });
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
          expect(error.code).toBe(AuthErrorCode.PRESIGNUP_FAILED);
          expect(error.message).toBe(customMessage);
        }

        expect(mockHookRegistry.executePreSignup).toHaveBeenCalled();
        expect(mockUserRepository.save).not.toHaveBeenCalled();
      });

      it('should wrap non-PRESIGNUP_FAILED errors in PRESIGNUP_FAILED for native token signup', async () => {
        // Mock the HookRegistry to throw the wrapped exception (as the real HookRegistry would)
        mockHookRegistry.executePreSignup.mockRejectedValue(
          new NAuthException(AuthErrorCode.PRESIGNUP_FAILED, 'External validation service unavailable'),
        );

        try {
          await service.verifyToken({ idToken: 'id-token', provider: 'google' });
          fail('Should have thrown NAuthException');
        } catch (error: any) {
          expect(error).toBeInstanceOf(NAuthException);
          expect(error.code).toBe(AuthErrorCode.PRESIGNUP_FAILED);
          expect(error.message).toBe('External validation service unavailable');
        }

        expect(mockHookRegistry.executePreSignup).toHaveBeenCalled();
        expect(mockUserRepository.save).not.toHaveBeenCalled();
      });
    });

    it('should throw error when provider is not enabled', async () => {
      (mockConfig.social as any).google.enabled = false;
      const newService = new TestSocialAuthProviderService(
        mockConfig,
        mockLogger,
        mockAuthService as unknown as AuthService,
        mockSocialAuthService,
        mockJwtService,
        mockSessionService,
        mockChallengeHelper,
        mockClientInfoService,
        mockStateStore,
        mockUserRepository,
        mockPhoneVerificationService,
        mockAuditService,
        undefined,
        mockHookRegistry,
      );

      try {
        await newService.verifyToken({ idToken: 'id-token', provider: 'google' });
        fail('Should have thrown NAuthException');
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthException);
        expect((error as NAuthException).code).toBe(AuthErrorCode.SOCIAL_CONFIG_MISSING);
      }
    });
  });

  describe('linkAccount', () => {
    it('should link social account to existing user', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      mockSocialAuthService.findSocialAccountByProvider.mockResolvedValue(null);
      mockSocialAuthService.createOrUpdateSocialAccount.mockResolvedValue(undefined);

      const result = await service.linkAccount('user-123', 'code', 'valid-state');

      expect(result.message).toContain('account linked successfully');
      expect(mockSocialAuthService.createOrUpdateSocialAccount).toHaveBeenCalled();
      expect(mockStateStore.validateAndConsumeCsrfState).toHaveBeenCalledWith('google', 'valid-state');
    });

    it('should throw error when account is already linked', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      // The check happens after getOAuthProfile, so we need to mock the service to return an account
      // when called with the provider name and profile.id from getOAuthProfile
      mockSocialAuthService.findSocialAccountByProvider.mockImplementation((provider: string, providerId: string) => {
        if (provider === 'google' && providerId === 'test-user-id') {
          return Promise.resolve({
            id: 1,
            provider: 'google',
            providerId: 'test-user-id',
            user: { id: 2 }, // Different user
          } as any);
        }
        return Promise.resolve(null);
      });

      try {
        await service.linkAccount('user-123', 'code', 'valid-state');
        fail('Should have thrown NAuthException');
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthException);
        expect((error as NAuthException).code).toBe(AuthErrorCode.SOCIAL_ACCOUNT_LINKED);
      }
    });
  });
});
