import { AppleSocialAuthService } from './apple-social-auth.service';
import { AppleOAuthClient } from './apple-oauth.client';
import {
  AuthService,
  SocialAuthService,
  JwtService,
  SessionService,
  AuthChallengeHelperService,
  ClientInfoService,
  AuthAuditService,
  NAuthConfig,
  NAuthLogger,
  OAuthUserProfile,
  NAuthException,
  AuthErrorCode,
  ITokenVerifierService,
  PhoneVerificationService,
  ISocialAuthStateStore,
} from '@nauth-toolkit/core';
import { VerifiedAppleTokenProfile } from './verified-token-profile.interface';

// Mock AppleOAuthClient
jest.mock('./apple-oauth.client');
jest.mock('./token-verifier.service');

/**
 * Apple Social Auth Service Unit Tests
 *
 * Tests Apple OAuth provider implementation including initialization,
 * OAuth URL generation, profile retrieval, and native token verification.
 * Uses direct instantiation, no NestJS dependencies.
 */
describe('AppleSocialAuthService', () => {
  let service: AppleSocialAuthService;
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
  let mockOAuthClient: jest.Mocked<AppleOAuthClient>;

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
        apple: {
          enabled: true,
          clientId: 'apple-client-id',
          clientSecret: 'apple-client-secret',
          callbackUrl: 'https://example.com/auth/apple/callback',
          scopes: ['name', 'email'],
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
    mockStateStore = {
      createCsrfState: jest.fn().mockResolvedValue('generated-state'),
      validateAndConsumeCsrfState: jest.fn().mockResolvedValue(undefined),
      setRedirectContext: jest.fn().mockResolvedValue(undefined),
      consumeRedirectContext: jest.fn().mockResolvedValue(null),
    };

    mockTokenVerifier = {
      verifyAppleToken: jest.fn(),
    } as any;

    mockOAuthClient = {
      getAuthorizationUrl: jest.fn(),
      exchangeCodeForToken: jest.fn(),
      getUserProfile: jest.fn(),
    } as any;

    (AppleOAuthClient as jest.Mock).mockImplementation(() => mockOAuthClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize service with valid config', () => {
      service = new AppleSocialAuthService(
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
        mockTokenVerifier,
      );

      expect(service).toBeDefined();
      expect(service.providerName).toBe('apple');
    });

    it('should throw error when Apple OAuth is not enabled', () => {
      mockConfig.social!.apple!.enabled = false;

      try {
        service = new AppleSocialAuthService(
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
          mockTokenVerifier,
        );
        fail('Should have thrown NAuthException');
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthException);
        expect((error as NAuthException).code).toBe(AuthErrorCode.SOCIAL_CONFIG_MISSING);
      }
    });

    it('should throw error when clientId is missing', () => {
      mockConfig.social!.apple!.clientId = undefined as any;

      try {
        service = new AppleSocialAuthService(
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
          mockTokenVerifier,
        );
        fail('Should have thrown NAuthException');
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthException);
        expect((error as NAuthException).code).toBe(AuthErrorCode.SOCIAL_CONFIG_MISSING);
      }
    });
  });

  describe('getAuthUrl', () => {
    beforeEach(() => {
      service = new AppleSocialAuthService(
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
        mockTokenVerifier,
      );
    });

    it('should generate OAuth URL', async () => {
      const authUrl = 'https://appleid.apple.com/auth/authorize?state=state-123';
      (mockOAuthClient.getAuthorizationUrl as jest.Mock).mockResolvedValue(authUrl);

      const result = await service.getAuthUrl('state-123');

      expect(result).toBe(authUrl);
      expect(mockOAuthClient.getAuthorizationUrl).toHaveBeenCalledWith('state-123');
    });
  });

  describe('getOAuthProfile', () => {
    beforeEach(() => {
      service = new AppleSocialAuthService(
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
        mockTokenVerifier,
      );
    });

    it('should exchange code for token and get user profile', async () => {
      const tokens = { accessToken: 'access-token' };
      const profile: OAuthUserProfile = {
        id: 'apple-user-id',
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        picture: null,
        verified: true,
        raw: {},
      };

      mockOAuthClient.exchangeCodeForToken.mockResolvedValue(tokens);
      mockOAuthClient.getUserProfile.mockResolvedValue(profile);

      const result = await (service as any).getOAuthProfile('code', 'state');

      expect(result).toEqual(profile);
    });
  });

  describe('verifyNativeToken', () => {
    beforeEach(() => {
      service = new AppleSocialAuthService(
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
        mockTokenVerifier,
      );
    });

    it('should verify Apple ID token and return profile', async () => {
      const verifiedToken: VerifiedAppleTokenProfile = {
        sub: 'apple-user-id',
        email: 'user@example.com',
        email_verified: true,
        is_private_email: false,
      };

      (mockTokenVerifier.verifyAppleToken as jest.Mock).mockResolvedValue(verifiedToken);

      const result = await (service as any).verifyNativeToken('id-token');

      expect(result.email).toBe('user@example.com');
      expect(result.verified).toBe(true);
    });

    it('should use profileData for name when provided', async () => {
      const verifiedToken: VerifiedAppleTokenProfile = {
        sub: 'apple-user-id',
        email: 'user@example.com',
        email_verified: true,
        is_private_email: false,
      };
      const profileData = { firstName: 'Jane', lastName: 'Smith' };

      (mockTokenVerifier.verifyAppleToken as jest.Mock).mockResolvedValue(verifiedToken);

      const result = await (service as any).verifyNativeToken('id-token', undefined, profileData);

      expect(result.firstName).toBe('Jane');
      expect(result.lastName).toBe('Smith');
    });

    it('should throw error when email is not verified', async () => {
      const verifiedToken: VerifiedAppleTokenProfile = {
        sub: 'apple-user-id',
        email: 'user@example.com',
        email_verified: false,
        is_private_email: false,
      };

      (mockTokenVerifier.verifyAppleToken as jest.Mock).mockResolvedValue(verifiedToken);

      try {
        await (service as any).verifyNativeToken('id-token');
        fail('Should have thrown NAuthException');
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthException);
        expect((error as NAuthException).code).toBe(AuthErrorCode.SOCIAL_EMAIL_REQUIRED);
      }
    });
  });
});
