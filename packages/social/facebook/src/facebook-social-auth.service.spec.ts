import 'reflect-metadata';
import { FacebookSocialAuthService } from './facebook-social-auth.service';
import { FacebookOAuthClient } from './facebook-oauth.client';
import {
  AuthService,
  SocialAuthService,
  ClientInfoService,
  NAuthConfig,
  NAuthLogger,
  NAuthException,
  AuthErrorCode,
  ITokenVerifierService,
  PhoneVerificationService,
  ISocialAuthStateStore,
  BaseUser,
} from '@nauth-toolkit/core';
import { JwtService, SessionService, AuthChallengeHelperService, AuthAuditService } from '@nauth-toolkit/core/internal';
import { Repository } from 'typeorm';
import { VerifiedFacebookTokenProfile } from './verified-token-profile.interface';

jest.mock('./facebook-oauth.client');
jest.mock('./token-verifier.service');

describe('FacebookSocialAuthService', () => {
  let service: FacebookSocialAuthService;
  let mockConfig: NAuthConfig;
  let mockLogger: NAuthLogger;
  let mockAuthService: jest.Mocked<AuthService>;
  let mockSocialAuthService: jest.Mocked<SocialAuthService>;
  let mockJwtService: jest.Mocked<JwtService>;
  let mockSessionService: jest.Mocked<SessionService>;
  let mockChallengeHelper: jest.Mocked<AuthChallengeHelperService>;
  let mockClientInfoService: jest.Mocked<ClientInfoService>;
  let mockAuditService: jest.Mocked<AuthAuditService>;
  let mockStateStore: jest.Mocked<ISocialAuthStateStore>;
  let mockPhoneVerificationService: jest.Mocked<PhoneVerificationService>;
  let mockTokenVerifier: jest.Mocked<ITokenVerifierService>;
  let mockOAuthClient: jest.Mocked<FacebookOAuthClient>;
  let mockUserRepository: jest.Mocked<Repository<BaseUser>>;

  beforeEach(() => {
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as unknown as NAuthLogger;

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
        facebook: {
          enabled: true,
          clientId: 'facebook-client-id',
          clientSecret: 'facebook-client-secret',
          callbackUrl: 'https://example.com/auth/facebook/callback',
          scopes: ['email', 'public_profile'],
        },
      },
    } as unknown as NAuthConfig;

    mockAuthService = {} as unknown as jest.Mocked<AuthService>;
    mockSocialAuthService = {} as unknown as jest.Mocked<SocialAuthService>;
    mockJwtService = {} as unknown as jest.Mocked<JwtService>;
    mockSessionService = {} as unknown as jest.Mocked<SessionService>;
    mockChallengeHelper = {} as unknown as jest.Mocked<AuthChallengeHelperService>;
    mockClientInfoService = {} as unknown as jest.Mocked<ClientInfoService>;
    mockAuditService = {} as unknown as jest.Mocked<AuthAuditService>;
    mockPhoneVerificationService = {} as unknown as jest.Mocked<PhoneVerificationService>;
    mockUserRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    } as unknown as jest.Mocked<Repository<BaseUser>>;
    mockStateStore = {
      createCsrfState: jest.fn().mockResolvedValue('generated-state'),
      validateAndConsumeCsrfState: jest.fn().mockResolvedValue(undefined),
      setRedirectContext: jest.fn().mockResolvedValue(undefined),
      consumeRedirectContext: jest.fn().mockResolvedValue(null),
    };

    mockTokenVerifier = {
      verifyFacebookToken: jest.fn(),
      verifyFacebookIdToken: jest.fn(),
    } as unknown as jest.Mocked<ITokenVerifierService>;

    mockOAuthClient = {
      getAuthorizationUrl: jest.fn(),
      exchangeCodeForToken: jest.fn(),
      getUserProfile: jest.fn(),
    } as unknown as jest.Mocked<FacebookOAuthClient>;

    (FacebookOAuthClient as jest.Mock).mockImplementation(() => mockOAuthClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize service with valid config', () => {
      service = new FacebookSocialAuthService(
        mockConfig,
        mockLogger,
        mockAuthService,
        mockSocialAuthService,
        mockJwtService,
        mockSessionService,
        mockChallengeHelper,
        mockClientInfoService,
        mockStateStore,
        mockUserRepository,
        mockPhoneVerificationService,
        mockAuditService,
        undefined, // trustedDeviceService
        undefined, // hookRegistry
        mockTokenVerifier,
      );

      expect(service).toBeDefined();
      expect(service.providerName).toBe('facebook');
    });

    it('should initialize service when Facebook OAuth is not enabled (constructor does not throw)', () => {
      mockConfig.social!.facebook!.enabled = false;

      // Constructor should not throw - it just sets oauthClient to null
      service = new FacebookSocialAuthService(
        mockConfig,
        mockLogger,
        mockAuthService,
        mockSocialAuthService,
        mockJwtService,
        mockSessionService,
        mockChallengeHelper,
        mockClientInfoService,
        mockStateStore,
        mockUserRepository,
        mockPhoneVerificationService,
        mockAuditService,
        undefined, // trustedDeviceService
        undefined, // hookRegistry
        mockTokenVerifier,
      );

      expect(service).toBeDefined();
      // Methods will throw when called, but constructor doesn't
    });
  });

  describe('getAuthUrl', () => {
    beforeEach(() => {
      service = new FacebookSocialAuthService(
        mockConfig,
        mockLogger,
        mockAuthService,
        mockSocialAuthService,
        mockJwtService,
        mockSessionService,
        mockChallengeHelper,
        mockClientInfoService,
        mockStateStore,
        mockUserRepository,
        mockPhoneVerificationService,
        mockAuditService,
        undefined, // trustedDeviceService
        undefined, // hookRegistry
        mockTokenVerifier,
      );
    });

    it('should generate OAuth URL', async () => {
      const authUrl = 'https://www.facebook.com/v18.0/dialog/oauth?state=state-123';
      (mockOAuthClient.getAuthorizationUrl as jest.Mock).mockResolvedValue(authUrl);

      const result = await service.getAuthUrl('state-123');

      expect(result).toBe(authUrl);
    });
  });

  describe('verifyNativeToken', () => {
    beforeEach(() => {
      service = new FacebookSocialAuthService(
        mockConfig,
        mockLogger,
        mockAuthService,
        mockSocialAuthService,
        mockJwtService,
        mockSessionService,
        mockChallengeHelper,
        mockClientInfoService,
        mockStateStore,
        mockUserRepository,
        mockPhoneVerificationService,
        mockAuditService,
        undefined, // trustedDeviceService
        undefined, // hookRegistry
        mockTokenVerifier,
      );
    });

    it('should verify Facebook access token and return profile', async () => {
      const verifiedToken: VerifiedFacebookTokenProfile = {
        id: 'facebook-user-id',
        email: 'user@example.com',
        first_name: 'John',
        last_name: 'Doe',
        picture: { data: { url: 'https://example.com/photo.jpg' } },
      };

      (mockTokenVerifier.verifyFacebookToken as jest.Mock).mockResolvedValue(verifiedToken);

      const result = (await (
        service as unknown as { verifyNativeToken: (idToken: string) => Promise<unknown> }
      ).verifyNativeToken('access-token')) as { email: string; id: string };

      expect(result.email).toBe('user@example.com');
      expect(result.id).toBe('facebook-user-id');
    });

    it('should verify Facebook ID token (Limited Login) and return profile', async () => {
      (mockTokenVerifier as unknown as { verifyFacebookIdToken: jest.Mock }).verifyFacebookIdToken.mockResolvedValue({
        sub: 'facebook-user-sub',
        email: 'user@example.com',
        given_name: 'John',
        family_name: 'Doe',
        picture: 'https://example.com/photo.jpg',
      });

      const result = (await (
        service as unknown as { verifyNativeToken: (idToken: string) => Promise<unknown> }
      ).verifyNativeToken('header.payload.signature')) as { id?: string; email?: string };

      expect(result.id).toBe('facebook-user-sub');
      expect(result.email).toBe('user@example.com');
    });

    it('should throw error when email is missing', async () => {
      const verifiedToken: VerifiedFacebookTokenProfile = {
        id: 'facebook-user-id',
        email: undefined,
        first_name: 'John',
        last_name: 'Doe',
        picture: undefined,
      };

      (mockTokenVerifier.verifyFacebookToken as jest.Mock).mockResolvedValue(verifiedToken);

      try {
        await (service as unknown as { verifyNativeToken: (idToken: string) => Promise<unknown> }).verifyNativeToken(
          'access-token',
        );
        fail('Should have thrown NAuthException');
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthException);
        expect((error as NAuthException).code).toBe(AuthErrorCode.SOCIAL_EMAIL_REQUIRED);
      }
    });
  });
});
