import { AppleSocialAuthService } from './apple-social-auth.service';
import { AppleOAuthClient } from './apple-oauth.client';
import {
  AuthService,
  SocialAuthService,
  ClientInfoService,
  NAuthConfig,
  NAuthLogger,
  OAuthUserProfile,
  NAuthException,
  AuthErrorCode,
  ITokenVerifierService,
  PhoneVerificationService,
  ISocialAuthStateStore,
  BaseUser,
  BaseSocialProviderSecret,
} from '@nauth-toolkit/core';
import { JwtService, SessionService, AuthChallengeHelperService } from '@nauth-toolkit/core/internal';
import type { Repository } from 'typeorm';
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
  let mockStateStore: jest.Mocked<ISocialAuthStateStore>;
  let mockPhoneVerificationService: jest.Mocked<PhoneVerificationService>;
  let mockTokenVerifier: jest.Mocked<ITokenVerifierService>;
  let mockOAuthClient: jest.Mocked<AppleOAuthClient>;
  let mockUserRepository: jest.Mocked<Repository<BaseUser>>;
  let mockSocialProviderSecretRepository: jest.Mocked<Repository<BaseSocialProviderSecret>>;

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
        apple: {
          enabled: true,
          clientId: 'apple-client-id',
          teamId: 'TEAMID123',
          keyId: 'KEYID123',
          // Not used in these tests because we pre-seed the DB secret, but required by config schema in real usage
          privateKeyPem: '-----BEGIN PRIVATE KEY-----\nTEST\n-----END PRIVATE KEY-----',
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

    mockUserRepository = {} as unknown as jest.Mocked<Repository<BaseUser>>;

    mockSocialProviderSecretRepository = {
      findOne: jest.fn().mockResolvedValue({
        id: 1,
        provider: 'apple',
        clientSecretJwt: 'db-jwt',
        expiresAt: new Date(Date.now() + 100 * 24 * 60 * 60 * 1000), // 100 days out
        createdAt: new Date(),
        updatedAt: new Date(),
      } as BaseSocialProviderSecret),
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<Repository<BaseSocialProviderSecret>>;
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
        mockUserRepository,
        mockPhoneVerificationService,
        undefined,
        undefined,
        mockTokenVerifier,
        mockSocialProviderSecretRepository,
      );

      expect(service).toBeDefined();
      expect(service.providerName).toBe('apple');
    });

    it('should construct when Apple OAuth is disabled (provider stays inactive)', () => {
      mockConfig.social!.apple!.enabled = false;

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
        mockUserRepository,
        mockPhoneVerificationService,
        undefined,
        undefined,
        mockTokenVerifier,
        null,
      );

      expect(service).toBeDefined();
    });

    it('should throw error when Apple is enabled but SocialProviderSecretRepository is missing', () => {
      service = undefined as unknown as AppleSocialAuthService;
      expect(() => {
        // eslint-disable-next-line no-new
        new AppleSocialAuthService(
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
          undefined,
          undefined,
          mockTokenVerifier,
          null,
        );
      }).toThrow(NAuthException);
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
        mockUserRepository,
        mockPhoneVerificationService,
        undefined,
        undefined,
        mockTokenVerifier,
        mockSocialProviderSecretRepository,
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
        mockUserRepository,
        mockPhoneVerificationService,
        undefined,
        undefined,
        mockTokenVerifier,
        mockSocialProviderSecretRepository,
      );
    });

    it('should exchange code for token and build profile from verified id_token', async () => {
      mockOAuthClient.exchangeCodeForToken.mockResolvedValue({ accessToken: 'at', idToken: 'it' });
      (mockTokenVerifier.verifyAppleToken as jest.Mock).mockResolvedValue({
        sub: 'apple-user-id',
        email: 'user@example.com',
        email_verified: true,
        is_private_email: false,
      } satisfies VerifiedAppleTokenProfile);

      const result = (await (service as unknown as { getOAuthProfile: (c: string, s: string) => Promise<OAuthUserProfile> })
        .getOAuthProfile('code', 'state')) as OAuthUserProfile;

      expect(result.id).toBe('apple-user-id');
      expect(result.email).toBe('user@example.com');
      expect(result.verified).toBe(true);
      expect(mockOAuthClient.getUserProfile).not.toHaveBeenCalled();
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
        mockUserRepository,
        mockPhoneVerificationService,
        undefined,
        undefined,
        mockTokenVerifier,
        mockSocialProviderSecretRepository,
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
