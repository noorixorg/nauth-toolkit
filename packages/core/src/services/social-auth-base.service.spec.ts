import { BaseSocialAuthProviderService } from './social-auth-base.service';
import { AuthService } from './auth.service';
import { JwtService } from './jwt.service';
import { SessionService } from './session.service';
import { AuthChallengeHelperService } from './auth-challenge-helper.service';
import { ClientInfoService } from './client-info.service';
import { PhoneVerificationService } from './phone-verification.service';
import { InternalAuthAuditService as AuthAuditService } from './auth-audit.service';
import { NAuthConfig } from '../interfaces/config.interface';
import { NAuthLogger } from '../utils/nauth-logger';
import { OAuthUserProfile } from '../interfaces/oauth.interface';
import { NAuthException } from '../exceptions/nauth.exception';
import { AuthErrorCode } from '../enums/error-codes.enum';
import { IUser } from '../interfaces/entities.interface';
import { ISocialAuthStateStore } from '../interfaces/social-auth-state-store.interface';
import type { Repository } from 'typeorm';
import type { BaseUser, BaseSocialAccount } from '../entities';

/**
 * Test implementation of BaseSocialAuthProviderService
 */
class TestSocialAuthProviderService extends BaseSocialAuthProviderService {
  readonly providerName = 'test';

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
  let mockJwtService: jest.Mocked<JwtService>;
  let mockSessionService: jest.Mocked<SessionService>;
  let mockChallengeHelper: jest.Mocked<AuthChallengeHelperService>;
  let mockClientInfoService: jest.Mocked<ClientInfoService>;
  let mockStateStore: jest.Mocked<ISocialAuthStateStore>;
  let mockUserRepository: jest.Mocked<Repository<BaseUser>>;
  let mockSocialAccountRepository: jest.Mocked<Repository<BaseSocialAccount>>;
  let mockPhoneVerificationService: jest.Mocked<PhoneVerificationService>;
  let mockAuditService: jest.Mocked<AuthAuditService>;
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
        test: {
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
    mockSocialAccountRepository = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<Repository<BaseSocialAccount>>;
    mockPhoneVerificationService = {} as any;
    mockAuditService = {
      recordEvent: jest.fn(),
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
      mockJwtService,
      mockSessionService,
      mockChallengeHelper,
      mockClientInfoService,
      mockStateStore,
      mockUserRepository,
      mockSocialAccountRepository,
      mockPhoneVerificationService,
      mockAuditService,
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
        mockJwtService,
        mockSessionService,
        mockChallengeHelper,
        mockClientInfoService,
        mockStateStore,
        mockUserRepository,
        mockSocialAccountRepository,
        mockPhoneVerificationService,
        mockAuditService,
      );

      const config = (newService as any).getProviderConfig();

      expect(config).toBeNull();
    });
  });

  describe('validateState', () => {
    it('should validate state via ISocialAuthStateStore', async () => {
      await (service as any).validateState('valid-state');
      expect(mockStateStore.validateAndConsumeCsrfState).toHaveBeenCalledWith('test', 'valid-state');
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
      expect(mockStateStore.createCsrfState).toHaveBeenCalledWith('test');
    });
  });

  describe('handleCallback', () => {
    it('should handle OAuth callback and return auth response', async () => {
      mockSocialAuthService.findSocialAccountByProvider.mockResolvedValue(null);
      mockUserRepository.findOne.mockResolvedValue(null); // No existing user by email
      mockUserRepository.create.mockReturnValue(mockUser as any);
      mockUserRepository.save.mockResolvedValue(mockUser as any);
      mockSocialAuthService.createOrUpdateSocialAccount.mockResolvedValue(undefined);

      const result = await service.handleCallback('code', 'valid-state');

      expect(result).toBeDefined();
      expect(mockUserRepository.create).toHaveBeenCalled();
      expect(mockUserRepository.save).toHaveBeenCalled();
      expect(mockStateStore.validateAndConsumeCsrfState).toHaveBeenCalledWith('test', 'valid-state');
    });

    it('should throw error when provider config is missing', async () => {
      mockConfig.social = undefined;
      const newService = new TestSocialAuthProviderService(
        mockConfig,
        mockLogger,
        mockAuthService as unknown as AuthService,
        mockJwtService,
        mockSessionService,
        mockChallengeHelper,
        mockClientInfoService,
        mockStateStore,
        mockUserRepository,
        mockSocialAccountRepository,
        mockPhoneVerificationService,
        mockAuditService,
      );

      try {
        await newService.handleCallback('code', 'state');
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

      const result = await service.verifyToken('id-token');

      expect(result).toBeDefined();
      expect(mockUserRepository.create).toHaveBeenCalled();
      expect(mockUserRepository.save).toHaveBeenCalled();
    });

    it('should throw error when provider is not enabled', async () => {
      (mockConfig.social as any).test.enabled = false;
      const newService = new TestSocialAuthProviderService(
        mockConfig,
        mockLogger,
        mockAuthService as unknown as AuthService,
        mockJwtService,
        mockSessionService,
        mockChallengeHelper,
        mockClientInfoService,
        mockStateStore,
        mockUserRepository,
        mockSocialAccountRepository,
        mockPhoneVerificationService,
        mockAuditService,
      );

      try {
        await newService.verifyToken('id-token');
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
      expect(mockStateStore.validateAndConsumeCsrfState).toHaveBeenCalledWith('test', 'valid-state');
    });

    it('should throw error when account is already linked', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser as any);
      // The check happens after getOAuthProfile, so we need to mock the repository to return an account
      // when called with the provider name and profile.id from getOAuthProfile
      mockSocialAccountRepository.findOne.mockImplementation((options: any) => {
        if (options?.where?.provider === 'test' && options?.where?.providerId === 'test-user-id') {
          return Promise.resolve({
            id: 1,
            provider: 'test',
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
