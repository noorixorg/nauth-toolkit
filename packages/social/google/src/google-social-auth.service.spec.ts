import { GoogleSocialAuthService } from './google-social-auth.service';
import { GoogleOAuthClient } from './google-oauth.client';
import { TokenVerifierService as GoogleTokenVerifierService } from './token-verifier.service';
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
import { VerifiedGoogleTokenProfile } from './verified-token-profile.interface';

// Mock GoogleOAuthClient
jest.mock('./google-oauth.client');
jest.mock('./token-verifier.service');

/**
 * Google Social Auth Service Unit Tests
 *
 * Tests Google OAuth provider implementation including initialization,
 * OAuth URL generation, profile retrieval, and native token verification.
 * Uses direct instantiation, no NestJS dependencies.
 */
describe('GoogleSocialAuthService', () => {
  let service: GoogleSocialAuthService;
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
  let mockOAuthClient: jest.Mocked<GoogleOAuthClient>;

  beforeEach(() => {
    // Create mock logger
    mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    } as any;

    // Create mock config
    mockConfig = {
      social: {
        google: {
          enabled: true,
          clientId: 'google-client-id',
          clientSecret: 'google-client-secret',
          callbackUrl: 'https://example.com/auth/google/callback',
          scopes: ['openid', 'email', 'profile'],
        },
      },
    } as NAuthConfig;

    // Create mock services
    mockAuthService = {} as any;
    mockSocialAuthService = {} as any;
    mockJwtService = {} as any;
    mockSessionService = {} as any;
    mockChallengeHelper = {} as any;
    mockClientInfoService = {} as any;
    mockAuditService = {} as any;
    mockPhoneVerificationService = {} as any;

    // Create mock state store
    mockStateStore = {
      createCsrfState: jest.fn().mockResolvedValue('generated-state'),
      validateAndConsumeCsrfState: jest.fn().mockResolvedValue(undefined),
      setRedirectContext: jest.fn().mockResolvedValue(undefined),
      consumeRedirectContext: jest.fn().mockResolvedValue(null),
    };

    // Create mock token verifier
    mockTokenVerifier = {
      verifyGoogleToken: jest.fn().mockResolvedValue({}),
    } as any;

    // Create mock OAuth client
    mockOAuthClient = {
      getAuthorizationUrl: jest.fn(),
      exchangeCodeForToken: jest.fn(),
      getUserProfile: jest.fn(),
    } as any;

    // Mock GoogleOAuthClient constructor
    (GoogleOAuthClient as jest.Mock).mockImplementation(() => mockOAuthClient);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // Service Initialization
  // ============================================================================

  describe('constructor', () => {
    it('should initialize service with valid config', () => {
      service = new GoogleSocialAuthService(
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
      expect(service.providerName).toBe('google');
      const callArgs = (GoogleOAuthClient as jest.Mock).mock.calls[0][0];
      expect(callArgs.clientId).toBe('google-client-id');
      expect(callArgs.clientSecret).toBe('google-client-secret');
      expect(callArgs.redirectUri).toBe('https://example.com/auth/google/callback');
    });

    it('should throw error when Google OAuth is not enabled', () => {
      mockConfig.social!.google!.enabled = false;

      try {
        service = new GoogleSocialAuthService(
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
        expect((error as NAuthException).message).toContain('Google OAuth is not enabled or configured');
      }
    });

    it('should throw error when clientId is missing', () => {
      mockConfig.social!.google!.clientId = undefined as any;

      try {
        service = new GoogleSocialAuthService(
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
        expect((error as NAuthException).message).toContain('Google OAuth clientId and clientSecret are required');
      }
    });

    it('should throw error when clientSecret is missing', () => {
      mockConfig.social!.google!.clientSecret = undefined as any;

      try {
        service = new GoogleSocialAuthService(
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
        expect((error as NAuthException).message).toContain('Google OAuth clientId and clientSecret are required');
      }
    });

    it('should use first clientId when array is provided', () => {
      mockConfig.social!.google!.clientId = ['client-id-1', 'client-id-2'] as any;

      service = new GoogleSocialAuthService(
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

      const callArgs = (GoogleOAuthClient as jest.Mock).mock.calls[0][0];
      expect(callArgs.clientId).toBe('client-id-1');
    });

    it('should create default token verifier when not provided', () => {
      service = new GoogleSocialAuthService(
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
        undefined, // No token verifier provided
      );

      expect(service).toBeDefined();
      expect(GoogleTokenVerifierService).toHaveBeenCalledWith(mockConfig);
    });
  });

  // ============================================================================
  // getAuthUrl() Method
  // ============================================================================

  describe('getAuthUrl', () => {
    beforeEach(() => {
      service = new GoogleSocialAuthService(
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

    it('should generate OAuth URL with provided state', async () => {
      const state = 'custom-state-123';
      const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?state=custom-state-123';

      (mockOAuthClient.getAuthorizationUrl as jest.Mock).mockResolvedValue(authUrl);

      const result = await service.getAuthUrl(state);

      expect(result).toBe(authUrl);
      expect(mockOAuthClient.getAuthorizationUrl).toHaveBeenCalledWith(state);
    });

    it('should generate state when not provided', async () => {
      const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?state=generated-state';

      (mockOAuthClient.getAuthorizationUrl as jest.Mock).mockResolvedValue(authUrl);

      const result = await service.getAuthUrl();

      expect(result).toBe(authUrl);
      expect(mockStateStore.createCsrfState).toHaveBeenCalledWith('google');
      expect(mockOAuthClient.getAuthorizationUrl).toHaveBeenCalledWith('generated-state');
    });
  });

  // ============================================================================
  // getOAuthProfile() Method (Protected)
  // ============================================================================

  describe('getOAuthProfile', () => {
    beforeEach(() => {
      service = new GoogleSocialAuthService(
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
      const code = 'authorization-code';
      const state = 'state-123';
      const tokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      };
      const profile: OAuthUserProfile = {
        id: 'google-user-id',
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        picture: 'https://example.com/photo.jpg',
        verified: true,
        raw: {},
      };

      mockOAuthClient.exchangeCodeForToken.mockResolvedValue(tokens);
      mockOAuthClient.getUserProfile.mockResolvedValue(profile);

      // Access protected method via type casting
      const result = await (service as any).getOAuthProfile(code, state);

      expect(result).toEqual(profile);
      expect(mockOAuthClient.exchangeCodeForToken).toHaveBeenCalledWith(
        code,
        'https://example.com/auth/google/callback',
      );
      expect(mockOAuthClient.getUserProfile).toHaveBeenCalledWith('access-token');
    });

    it('should throw error when callback URL is not configured', async () => {
      mockConfig.social!.google!.callbackUrl = undefined as any;

      // Recreate service with updated config
      service = new GoogleSocialAuthService(
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

      try {
        await (service as any).getOAuthProfile('code', 'state');
        fail('Should have thrown NAuthException');
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthException);
        expect((error as NAuthException).code).toBe(AuthErrorCode.SOCIAL_CONFIG_MISSING);
        expect((error as NAuthException).message).toContain('Google OAuth callback URL is not configured');
      }
    });
  });

  // ============================================================================
  // verifyNativeToken() Method (Protected)
  // ============================================================================

  describe('verifyNativeToken', () => {
    beforeEach(() => {
      service = new GoogleSocialAuthService(
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

    it('should verify Google ID token and return profile', async () => {
      const idToken = 'google-id-token';
      const verifiedToken: VerifiedGoogleTokenProfile = {
        sub: 'google-user-id',
        email: 'user@example.com',
        email_verified: true,
        given_name: 'John',
        family_name: 'Doe',
        picture: 'https://example.com/photo.jpg',
      };

      (mockTokenVerifier.verifyGoogleToken as jest.Mock).mockResolvedValue(verifiedToken);

      const result = await (service as any).verifyNativeToken(idToken);

      expect(result).toEqual({
        id: 'google-user-id',
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        picture: 'https://example.com/photo.jpg',
        verified: true,
        raw: verifiedToken,
      });
      expect(mockTokenVerifier.verifyGoogleToken).toHaveBeenCalledWith(idToken, 'google-client-id');
    });

    it('should use profileData when provided', async () => {
      const idToken = 'google-id-token';
      const verifiedToken: VerifiedGoogleTokenProfile = {
        sub: 'google-user-id',
        email: 'user@example.com',
        email_verified: true,
        given_name: undefined,
        family_name: undefined,
        picture: undefined,
      };
      const profileData = {
        givenName: 'Jane',
        familyName: 'Smith',
        imageUrl: 'https://example.com/custom-photo.jpg',
      };

      (mockTokenVerifier.verifyGoogleToken as jest.Mock).mockResolvedValue(verifiedToken);

      const result = await (service as any).verifyNativeToken(idToken, undefined, profileData);

      expect(result.firstName).toBe('Jane');
      expect(result.lastName).toBe('Smith');
      expect(result.picture).toBe('https://example.com/custom-photo.jpg');
    });

    it('should throw error when provider config is missing', () => {
      // Create a new config without Google social config
      const configWithoutGoogle = {
        ...mockConfig,
        social: {},
      } as NAuthConfig;

      // Service constructor should throw error when config is missing
      try {
        new GoogleSocialAuthService(
          configWithoutGoogle,
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
        expect((error as NAuthException).message).toContain('Google OAuth is not enabled or configured');
      }
    });

    it('should throw error when token verifier is not available', async () => {
      const serviceWithoutVerifier = new GoogleSocialAuthService(
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
        undefined, // No token verifier
      );

      // Mock that verifyGoogleToken doesn't exist
      (serviceWithoutVerifier as any).tokenVerifier = null;

      try {
        await (serviceWithoutVerifier as any).verifyNativeToken('id-token');
        fail('Should have thrown NAuthException');
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthException);
        expect((error as NAuthException).code).toBe(AuthErrorCode.SOCIAL_CONFIG_MISSING);
        expect((error as NAuthException).message).toContain('Google token verifier is not available');
      }
    });

    it('should throw error when email is not verified', async () => {
      const idToken = 'google-id-token';
      const verifiedToken: VerifiedGoogleTokenProfile = {
        sub: 'google-user-id',
        email: 'user@example.com',
        email_verified: false, // Not verified
        given_name: 'John',
        family_name: 'Doe',
        picture: 'https://example.com/photo.jpg',
      };

      (mockTokenVerifier.verifyGoogleToken as jest.Mock).mockResolvedValue(verifiedToken);

      try {
        await (service as any).verifyNativeToken(idToken);
        fail('Should have thrown NAuthException');
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthException);
        expect((error as NAuthException).code).toBe(AuthErrorCode.SOCIAL_EMAIL_REQUIRED);
        expect((error as NAuthException).message).toContain('Email is required and must be verified by Google');
      }
    });

    it('should throw error when email is missing', async () => {
      const idToken = 'google-id-token';
      const verifiedToken: VerifiedGoogleTokenProfile = {
        sub: 'google-user-id',
        email: null as any, // Missing email
        email_verified: true,
        given_name: 'John',
        family_name: 'Doe',
        picture: 'https://example.com/photo.jpg',
      };

      (mockTokenVerifier.verifyGoogleToken as jest.Mock).mockResolvedValue(verifiedToken);

      try {
        await (service as any).verifyNativeToken(idToken);
        fail('Should have thrown NAuthException');
      } catch (error) {
        expect(error).toBeInstanceOf(NAuthException);
        expect((error as NAuthException).code).toBe(AuthErrorCode.SOCIAL_EMAIL_REQUIRED);
        expect((error as NAuthException).message).toContain('Email is required and must be verified by Google');
      }
    });
  });
});
