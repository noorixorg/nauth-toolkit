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
} from '@nauth-toolkit/core/internal';
import { Repository } from 'typeorm';
import { AppleOAuthClient } from './apple-oauth.client';
import { TokenVerifierService as AppleTokenVerifierService } from './token-verifier.service';
import { VerifiedAppleTokenProfile } from './verified-token-profile.interface';

/**
 * Apple Social Authentication Service (Platform-Agnostic)
 *
 * Handles Apple OAuth flow including:
 * - OAuth web flow (redirect-based)
 * - Native mobile token verification
 * - Account linking
 *
 * This is a plain TypeScript class with no framework dependencies.
 * Use `@nauth-toolkit/social-apple/nestjs` for NestJS integration.
 *
 * @example
 * ```typescript
 * // Direct instantiation (platform-agnostic)
 * const appleAuth = new AppleSocialAuthService(
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
export class AppleSocialAuthService extends BaseSocialAuthProviderService implements ISocialAuthProviderService {
  readonly providerName = 'apple';
  private readonly oauthClient: AppleOAuthClient | null;
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
    // Apple-specific token verifier (optional, fallback to TOKEN_VERIFIER)
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
    );

    // Initialize Apple OAuth client
    const providerConfig = this.getProviderConfig();
    if (!providerConfig || !providerConfig.enabled) {
      this.oauthClient = null;
      this.tokenVerifier = null;
      return; // Exit constructor early if disabled
    }

    const webClientId = Array.isArray(providerConfig.clientId) ? providerConfig.clientId[0] : providerConfig.clientId;
    if (!webClientId) {
      // Schema validation should catch this, but handle gracefully
      this.oauthClient = null;
      this.tokenVerifier = null;
      return;
    }

    // Note: Apple clientSecret is optional for native flow, but required for web OAuth
    // It's a JWT that needs to be generated from Apple Developer credentials
    this.oauthClient = new AppleOAuthClient({
      clientId: webClientId,
      clientSecret: providerConfig.clientSecret || '',
      redirectUri: providerConfig.callbackUrl || '',
      scopes: providerConfig.scopes || ['name', 'email'],
    });

    // Use provided token verifier or create default one
    this.tokenVerifier =
      tokenVerifier ||
      new AppleTokenVerifierService(config) ||
      (this.config as { tokenVerifier?: ITokenVerifierService }).tokenVerifier ||
      null;

    this.logger?.debug?.('AppleSocialAuthService initialized');
  }

  /**
   * Generate OAuth authorization URL for Apple
   *
   * @param state - Optional state parameter for CSRF protection
   * @returns Authorization URL for redirecting user to Apple
   */
  async getAuthUrl(state?: string): Promise<string> {
    if (!this.oauthClient) {
      throw new NAuthException(AuthErrorCode.SOCIAL_CONFIG_MISSING, 'Apple OAuth is not enabled');
    }
    const finalState = state || (await this.generateState());
    return this.oauthClient.getAuthorizationUrl(finalState);
  }

  /**
   * Get OAuth user profile from callback
   *
   * Exchanges authorization code for access token and fetches user profile.
   *
   * @param code - Authorization code from Apple OAuth callback
   * @param _state - State parameter (validated by base class)
   * @returns User profile from Apple
   * @protected
   */
  protected async getOAuthProfile(code: string, _state: string): Promise<OAuthUserProfile> {
    if (!this.oauthClient) {
      throw new NAuthException(AuthErrorCode.SOCIAL_CONFIG_MISSING, 'Apple OAuth is not enabled');
    }
    const providerConfig = this.getProviderConfig();
    if (!providerConfig || !providerConfig.callbackUrl) {
      throw new NAuthException(AuthErrorCode.SOCIAL_CONFIG_MISSING, 'Apple OAuth callback URL is not configured');
    }

    // Exchange code for access token
    const tokens = await this.oauthClient.exchangeCodeForToken(code, providerConfig.callbackUrl);

    // Get user profile from Apple
    return await this.oauthClient.getUserProfile(tokens.accessToken);
  }

  /**
   * Verify Apple ID token from native mobile apps
   *
   * @param idToken - Apple ID token from native Sign in with Apple
   * @param _accessToken - Access token (not used for Apple)
   * @param profileData - Optional profile data (name fields from first sign-in)
   * @returns User profile from verified token
   * @protected
   */
  protected async verifyNativeToken(
    idToken: string,
    _accessToken?: string,
    profileData?: unknown,
  ): Promise<OAuthUserProfile> {
    if (!this.tokenVerifier) {
      throw new NAuthException(AuthErrorCode.SOCIAL_CONFIG_MISSING, 'Apple OAuth is not enabled');
    }
    const providerConfig = this.getProviderConfig();
    if (!providerConfig) {
      throw new NAuthException(AuthErrorCode.SOCIAL_CONFIG_MISSING, 'Apple OAuth is not configured');
    }

    const clientId = Array.isArray(providerConfig.clientId) ? providerConfig.clientId[0] : providerConfig.clientId || '';
    if (!this.tokenVerifier.verifyAppleToken) {
      throw new NAuthException(AuthErrorCode.SOCIAL_CONFIG_MISSING, 'Apple token verifier is not available');
    }

    // Verify ID token with Apple's JWKS public keys
    const verified = (await this.tokenVerifier.verifyAppleToken(idToken, clientId)) as VerifiedAppleTokenProfile;
    this.logger?.debug?.(`Verified Apple token for: ${verified.email}`);

    // CRITICAL: Require email from all social providers for signup
    if (!verified.email || !verified.email_verified) {
      throw new NAuthException(AuthErrorCode.SOCIAL_EMAIL_REQUIRED, 'Email is required and must be verified by Apple.');
    }

    // Handle name from profileData (first-time sign-in only - Apple only sends name once)
    const profileDataTyped = profileData as { firstName?: string; lastName?: string } | undefined;
    return {
      id: verified.sub,
      email: verified.email,
      firstName: profileDataTyped?.firstName || null,
      lastName: profileDataTyped?.lastName || null,
      picture: null, // Apple doesn't provide profile pictures
      verified: verified.email_verified,
      raw: {
        sub: verified.sub,
        email: verified.email,
        email_verified: verified.email_verified,
        is_private_email: verified.is_private_email,
      } as unknown as Record<string, unknown>,
    };
  }
}
