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
import {
  JwtService,
  SessionService,
  AuthChallengeHelperService,
  AuthAuditService,
} from '@nauth-toolkit/core/internal';
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
        facebook: {
          enabled: true,
          clientId: 'facebook-client-id',
          clientSecret: 'facebook-client-secret',
          callbackUrl: 'https://example.com/auth/facebook/callback',
          scopes: ['email', 'public_profile'],
        },
      },
    } as NAuthConfig;

    mockAuthService = {} as any;
    mockSocialAuthService = {} as any;
    mockJwtService = {} as any;
    mockSessionService = {} as any;
    mockChallengeHelper = {} as any;
    mockClientInfoService = {} as any;
    mockAuditService = {} as any;
    mockPhoneVerificationService = {} as any;
    mockUserRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
    } as any;
    mockStateStore = {
      createCsrfState: jest.fn().mockResolvedValue('generated-state'),
      validateAndConsumeCsrfState: jest.fn().mockResolvedValue(undefined),
      setRedirectContext: jest.fn().mockResolvedValue(undefined),
      consumeRedirectContext: jest.fn().mockResolvedValue(null),
    };

    mockTokenVerifier = {
      verifyFacebookToken: jest.fn(),
    } as any;

    mockOAuthClient = {
      getAuthorizationUrl: jest.fn(),
      exchangeCodeForToken: jest.fn(),
      getUserProfile: jest.fn(),
    } as any;

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

      const result = await (service as any).verifyNativeToken('access-token');

      expect(result.email).toBe('user@example.com');
      expect(result.id).toBe('facebook-user-id');
    });

    it('should throw error when email is missing', async () => {
      const verifiedToken: VerifiedFacebookTokenProfile = {
        id: 'facebook-user-id',
        email: null as any,
        first_name: 'John',
        last_name: 'Doe',
        picture: undefined,
      };

      (mockTokenVerifier.verifyFacebookToken as jest.Mock).mockResolvedValue(verifiedToken);

      try {
        await (service as any).verifyNativeToken('access-token');
        fail('Should have thrown NAuthException');
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthException);
        expect((error as NAuthException).code).toBe(AuthErrorCode.SOCIAL_EMAIL_REQUIRED);
      }
    });
  });
});
