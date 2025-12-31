// Public API imports
import {
  AuthService,
  SocialAuthService,
  ClientInfoService,
  NAuthConfig,
  NAuthLogger,
  OAuthUserProfile,
  NAuthException,
  AuthErrorCode,
  PhoneVerificationService,
  ISocialAuthProviderService,
  ITokenVerifierService,
  BaseUser,
  ISocialAuthStateStore,
} from '@nauth-toolkit/core';
// Internal API imports (for provider implementations)
import {
  BaseSocialAuthProviderService,
  JwtService,
  SessionService,
  AuthChallengeHelperService,
  AuthAuditService, // Internal version with recordEvent()
  TrustedDeviceService,
  HookRegistryService,
} from '@nauth-toolkit/core/internal';
import { Repository } from 'typeorm';
import { FacebookOAuthClient } from './facebook-oauth.client';
import { TokenVerifierService as FacebookTokenVerifierService } from './token-verifier.service';
import { VerifiedFacebookTokenProfile } from './verified-token-profile.interface';

/**
 * Facebook Social Authentication Service (Platform-Agnostic)
 *
 * Handles Facebook OAuth flow including:
 * - OAuth web flow (redirect-based)
 * - Native mobile token verification
 * - Account linking
 *
 * This is a plain TypeScript class with no framework dependencies.
 * Use `@nauth-toolkit/social-facebook/nestjs` for NestJS integration.
 *
 * @example
 * ```typescript
 * // Direct instantiation (platform-agnostic)
 * const facebookAuth = new FacebookSocialAuthService(
 *   config,
 *   logger,
 *   authService,
 *   socialAuthService,
 *   jwtService,
 *   sessionService,
 *   challengeHelper,
 *   clientInfoService,
 *   auditService,
 *   stateStore,
 *   phoneVerificationService,
 *   tokenVerifier
 * );
 * ```
 */
export class FacebookSocialAuthService extends BaseSocialAuthProviderService implements ISocialAuthProviderService {
  readonly providerName = 'facebook';
  private readonly oauthClient: FacebookOAuthClient | null;
  private readonly tokenVerifier: ITokenVerifierService | null;

  constructor(
    config: NAuthConfig,
    logger: NAuthLogger,
    authService: AuthService,
    socialAuthService: SocialAuthService,
    jwtService: JwtService,
    sessionService: SessionService,
    challengeHelper: AuthChallengeHelperService,
    clientInfoService: ClientInfoService,
    // State store shared across all providers
    stateStore: ISocialAuthStateStore,
    userRepository: Repository<BaseUser>,
    // Phone verification service (optional - only available when SMS provider is configured)
    phoneVerificationService?: PhoneVerificationService,
    // Audit service (optional - only available when auditLogs.enabled is true)
    auditService?: AuthAuditService,
    // Trusted device service (optional - only available when rememberDevices is enabled)
    trustedDeviceService?: TrustedDeviceService,
    // Hook registry for lifecycle hooks (required)
    hookRegistry?: HookRegistryService,
    // Facebook-specific token verifier (optional, fallback to default)
    tokenVerifier?: ITokenVerifierService,
  ) {
    super(
      config,
      logger,
      authService,
      socialAuthService,
      jwtService,
      sessionService,
      challengeHelper,
      clientInfoService,
      stateStore,
      userRepository,
      phoneVerificationService,
      auditService,
      trustedDeviceService,
      hookRegistry,
    );

    // Initialize Facebook OAuth client
    const providerConfig = this.getProviderConfig();
    if (!providerConfig || !providerConfig.enabled) {
      this.oauthClient = null;
      this.tokenVerifier = null;
      return; // Exit constructor early if disabled
    }

    const webClientId = Array.isArray(providerConfig.clientId) ? providerConfig.clientId[0] : providerConfig.clientId;
    if (!webClientId || !providerConfig.clientSecret) {
      // Schema validation should catch this, but handle gracefully
      this.oauthClient = null;
      this.tokenVerifier = null;
      return;
    }

    this.oauthClient = new FacebookOAuthClient({
      clientId: webClientId,
      clientSecret: providerConfig.clientSecret,
      redirectUri: providerConfig.callbackUrl || '',
      scopes: providerConfig.scopes || ['email', 'public_profile'],
    });

    // Use provided token verifier or create default one
    this.tokenVerifier =
      tokenVerifier ||
      new FacebookTokenVerifierService(config) ||
      (this.config as { tokenVerifier?: ITokenVerifierService }).tokenVerifier ||
      null;

    this.logger?.debug?.('FacebookSocialAuthService initialized');
  }

  /**
   * Generate OAuth authorization URL for Facebook
   *
   * @param state - Optional state parameter for CSRF protection
   * @returns Authorization URL for redirecting user to Facebook
   */
  async getAuthUrl(state?: string): Promise<string> {
    if (!this.oauthClient) {
      throw new NAuthException(AuthErrorCode.SOCIAL_CONFIG_MISSING, 'Facebook OAuth is not enabled');
    }
    const finalState = state || (await this.generateState());
    return this.oauthClient.getAuthorizationUrl(finalState);
  }

  /**
   * Get OAuth user profile from callback
   *
   * Exchanges authorization code for access token and fetches user profile.
   *
   * @param code - Authorization code from Facebook OAuth callback
   * @param _state - State parameter (validated by base class)
   * @returns User profile from Facebook
   * @protected
   */
  protected async getOAuthProfile(code: string, _state: string): Promise<OAuthUserProfile> {
    if (!this.oauthClient) {
      throw new NAuthException(AuthErrorCode.SOCIAL_CONFIG_MISSING, 'Facebook OAuth is not enabled');
    }
    const providerConfig = this.getProviderConfig();
    if (!providerConfig || !providerConfig.callbackUrl) {
      throw new NAuthException(AuthErrorCode.SOCIAL_CONFIG_MISSING, 'Facebook OAuth callback URL is not configured');
    }

    // Exchange code for access token
    const tokens = await this.oauthClient.exchangeCodeForToken(code, providerConfig.callbackUrl);

    // Get user profile from Facebook
    return await this.oauthClient.getUserProfile(tokens.accessToken);
  }

  /**
   * Verify Facebook access token from native mobile apps
   *
   * Facebook uses access tokens (not ID tokens) from native SDKs
   *
   * @param accessToken - Facebook access token from native SDK (passed as idToken parameter)
   * @param _idToken - Not used for Facebook (Facebook uses access tokens)
   * @param profileData - Optional profile data from native SDK
   * @returns User profile from verified token
   * @protected
   */
  protected async verifyNativeToken(
    idToken: string,
    _accessToken?: string,
    profileData?: unknown,
  ): Promise<OAuthUserProfile> {
    if (!this.tokenVerifier) {
      throw new NAuthException(AuthErrorCode.SOCIAL_CONFIG_MISSING, 'Facebook OAuth is not enabled');
    }
    const providerConfig = this.getProviderConfig();
    if (!providerConfig) {
      throw new NAuthException(AuthErrorCode.SOCIAL_CONFIG_MISSING, 'Facebook OAuth is not configured');
    }

    const appId = Array.isArray(providerConfig.clientId) ? providerConfig.clientId[0] : providerConfig.clientId || '';
    const appSecret = providerConfig.clientSecret || '';

    if (!this.tokenVerifier.verifyFacebookToken) {
      throw new NAuthException(AuthErrorCode.SOCIAL_CONFIG_MISSING, 'Facebook token verifier is not available');
    }

    // For Facebook, the idToken parameter actually contains the access token
    // Facebook native SDKs return access tokens, not ID tokens
    const accessToken = idToken;

    // Verify access token with Facebook's Graph API
    const verified = (await this.tokenVerifier.verifyFacebookToken(
      accessToken,
      appId,
      appSecret,
    )) as VerifiedFacebookTokenProfile;
    this.logger?.debug?.(`Verified Facebook token for: ${verified.email || verified.id}`);

    // CRITICAL: Require email from all social providers for signup
    if (!verified.email) {
      throw new NAuthException(
        AuthErrorCode.SOCIAL_EMAIL_REQUIRED,
        'Email is required from Facebook. Please grant email permissions.',
      );
    }

    // Handle profile data from native SDK if available
    const profileDataTyped = profileData as { firstName?: string; lastName?: string; picture?: string } | undefined;
    return {
      id: verified.id,
      email: verified.email || '',
      firstName: verified.first_name || profileDataTyped?.firstName || null,
      lastName: verified.last_name || profileDataTyped?.lastName || null,
      picture: verified.picture?.data?.url || profileDataTyped?.picture || null,
      verified: true, // Email is verified if provided by Facebook
      raw: {
        id: verified.id,
        email: verified.email,
        first_name: verified.first_name,
        last_name: verified.last_name,
        picture: verified.picture,
      } as unknown as Record<string, unknown>,
    };
  }
}
