import { BaseSocialAuthProviderService } from './social-auth-base.service';
import { AuthService } from './auth.service';
import { SocialAuthService } from './social-auth.service';
import { JwtService } from './jwt.service';
import { SessionService } from './session.service';
import { AuthChallengeHelperService } from './auth-challenge-helper.service';
import { ClientInfoService } from './client-info.service';
import { PhoneVerificationService } from './phone-verification.service';
import { AuthAuditService } from './auth-audit.service';
import { NAuthConfig } from '../interfaces/config.interface';
import { NAuthLogger } from '../utils/nauth-logger';
import { OAuthUserProfile } from '../interfaces/oauth.interface';
import { NAuthException } from '../exceptions/nauth.exception';
import { AuthErrorCode } from '../enums/error-codes.enum';
import { IUser } from '../interfaces/entities.interface';

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
  let mockAuthService: jest.Mocked<AuthService>;
  let mockSocialAuthService: jest.Mocked<SocialAuthService>;
  let mockJwtService: jest.Mocked<JwtService>;
  let mockSessionService: jest.Mocked<SessionService>;
  let mockChallengeHelper: jest.Mocked<AuthChallengeHelperService>;
  let mockClientInfoService: jest.Mocked<ClientInfoService>;
  let mockStateStore: Map<string, { timestamp: number; provider: string }>;
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

    mockStateStore = new Map();
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
      mockAuthService,
      mockSocialAuthService,
      mockJwtService,
      mockSessionService,
      mockChallengeHelper,
      mockClientInfoService,
      mockStateStore,
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
        mockAuthService,
        mockSocialAuthService,
        mockJwtService,
        mockSessionService,
        mockChallengeHelper,
        mockClientInfoService,
        mockStateStore,
        mockPhoneVerificationService,
        mockAuditService,
      );

      const config = (newService as any).getProviderConfig();

      expect(config).toBeNull();
    });
  });

  describe('validateState', () => {
    it('should validate state parameter', () => {
      const state = 'valid-state';
      mockStateStore.set(state, {
        timestamp: Date.now(),
        provider: 'test',
      });

      (service as any).validateState(state);

      expect(mockStateStore.has(state)).toBe(false); // Should be deleted after validation
    });

    it('should throw error when state is not found', () => {
      try {
        (service as any).validateState('invalid-state');
        fail('Should have thrown NAuthException');
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthException);
        expect((error as NAuthException).code).toBe(AuthErrorCode.VALIDATION_FAILED);
      }
    });

    it('should throw error when state provider mismatch', () => {
      const state = 'valid-state';
      mockStateStore.set(state, {
        timestamp: Date.now(),
        provider: 'different-provider',
      });

      try {
        (service as any).validateState(state);
        fail('Should have thrown NAuthException');
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthException);
        expect((error as NAuthException).code).toBe(AuthErrorCode.VALIDATION_FAILED);
      }
    });

    it('should throw error when state is expired', () => {
      const state = 'expired-state';
      mockStateStore.set(state, {
        timestamp: Date.now() - 6 * 60 * 1000, // 6 minutes ago
        provider: 'test',
      });

      try {
        (service as any).validateState(state);
        fail('Should have thrown NAuthException');
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthException);
        expect((error as NAuthException).code).toBe(AuthErrorCode.CHALLENGE_EXPIRED);
      }
    });
  });

  describe('generateState', () => {
    it('should generate state and store it', () => {
      const state = (service as any).generateState();

      expect(state).toBeDefined();
      expect(typeof state).toBe('string');
      expect(mockStateStore.has(state)).toBe(true);
      expect(mockStateStore.get(state)?.provider).toBe('test');
    });
  });

  describe('handleCallback', () => {
    it('should handle OAuth callback and return auth response', async () => {
      const state = 'valid-state';
      mockStateStore.set(state, {
        timestamp: Date.now(),
        provider: 'test',
      });

      mockSocialAuthService.findSocialAccountByProvider.mockResolvedValue(null);
      mockAuthService.getUserByEmail.mockResolvedValue(null);
      mockAuthService.createSocialUser.mockResolvedValue(mockUser);
      mockSocialAuthService.createOrUpdateSocialAccount.mockResolvedValue(undefined);

      const result = await service.handleCallback('code', state);

      expect(result).toBeDefined();
      expect(mockAuthService.createSocialUser).toHaveBeenCalled();
    });

    it('should throw error when provider config is missing', async () => {
      mockConfig.social = undefined;
      const newService = new TestSocialAuthProviderService(
        mockConfig,
        mockLogger,
        mockAuthService,
        mockSocialAuthService,
        mockJwtService,
        mockSessionService,
        mockChallengeHelper,
        mockClientInfoService,
        mockStateStore,
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
      mockAuthService.getUserByEmail.mockResolvedValue(null);
      mockAuthService.createSocialUser.mockResolvedValue(mockUser);
      mockSocialAuthService.createOrUpdateSocialAccount.mockResolvedValue(undefined);

      const result = await service.verifyToken('id-token');

      expect(result).toBeDefined();
      expect(mockAuthService.createSocialUser).toHaveBeenCalled();
    });

    it('should throw error when provider is not enabled', async () => {
      (mockConfig.social as any).test.enabled = false;
      const newService = new TestSocialAuthProviderService(
        mockConfig,
        mockLogger,
        mockAuthService,
        mockSocialAuthService,
        mockJwtService,
        mockSessionService,
        mockChallengeHelper,
        mockClientInfoService,
        mockStateStore,
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
      const state = 'valid-state';
      mockStateStore.set(state, {
        timestamp: Date.now(),
        provider: 'test',
      });

      mockAuthService.getUserById.mockResolvedValue(mockUser);
      mockSocialAuthService.findSocialAccountByProvider.mockResolvedValue(null);
      mockSocialAuthService.createOrUpdateSocialAccount.mockResolvedValue(undefined);

      const result = await service.linkAccount('user-123', 'code', state);

      expect(result.message).toContain('account linked successfully');
      expect(mockSocialAuthService.createOrUpdateSocialAccount).toHaveBeenCalled();
    });

    it('should throw error when account is already linked', async () => {
      const state = 'valid-state';
      mockStateStore.set(state, {
        timestamp: Date.now(),
        provider: 'test',
      });

      mockAuthService.getUserById.mockResolvedValue(mockUser);
      mockSocialAuthService.findSocialAccountByProvider.mockResolvedValue({
        id: 1,
        provider: 'test',
        providerUserId: 'test-user-id',
      } as any);

      try {
        await service.linkAccount('user-123', 'code', state);
        fail('Should have thrown NAuthException');
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthException);
        expect((error as NAuthException).code).toBe(AuthErrorCode.SOCIAL_ACCOUNT_LINKED);
      }
    });
  });
});
