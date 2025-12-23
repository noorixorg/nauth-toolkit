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
  ISocialAuthProviderService,
  ITokenVerifierService,
  PhoneVerificationService,
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
import { GoogleOAuthClient } from './google-oauth.client';
import { TokenVerifierService as GoogleTokenVerifierService } from './token-verifier.service';
import { VerifiedGoogleTokenProfile } from './verified-token-profile.interface';

/**
 * Google Social Authentication Service (Platform-Agnostic)
 *
 * Handles Google OAuth flow including:
 * - OAuth web flow (redirect-based)
 * - Native mobile token verification
 * - Account linking
 *
 * This is a plain TypeScript class with no framework dependencies.
 * Use `@nauth-toolkit/social-google/nestjs` for NestJS integration.
 *
 * @example
 * ```typescript
 * // Direct instantiation (platform-agnostic)
 * const googleAuth = new GoogleSocialAuthService(
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
export class GoogleSocialAuthService extends BaseSocialAuthProviderService implements ISocialAuthProviderService {
  readonly providerName = 'google';
  private readonly oauthClient: GoogleOAuthClient | null;
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
    // Google-specific token verifier (optional, fallback to TOKEN_VERIFIER)
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

    // Initialize Google OAuth client only if enabled
    const providerConfig = this.getProviderConfig();
    if (!providerConfig || !providerConfig.enabled) {
      // Service can exist but be disabled - don't initialize OAuth client
      // Schema validation ensures credentials are present when enabled=true
      this.oauthClient = null;
      this.tokenVerifier = null;
      return;
    }

    const webClientId = Array.isArray(providerConfig.clientId) ? providerConfig.clientId[0] : providerConfig.clientId;

    if (!webClientId || !providerConfig.clientSecret) {
      // Schema validation should catch this, but double-check for safety
      throw new NAuthException(
        AuthErrorCode.SOCIAL_CONFIG_MISSING,
        'Google OAuth clientId and clientSecret are required when enabled',
      );
    }

    this.oauthClient = new GoogleOAuthClient({
      clientId: webClientId,
      clientSecret: providerConfig.clientSecret,
      redirectUri: providerConfig.callbackUrl || '',
      scopes: providerConfig.scopes || ['openid', 'email', 'profile'],
    });

    // Use provided token verifier or create default one
    this.tokenVerifier = tokenVerifier || new GoogleTokenVerifierService(config);

    this.logger?.debug?.('GoogleSocialAuthService initialized');
  }

  /**
   * Generate OAuth authorization URL for Google
   */
  async getAuthUrl(state?: string): Promise<string> {
    if (!this.oauthClient) {
      throw new NAuthException(AuthErrorCode.SOCIAL_CONFIG_MISSING, 'Google OAuth is not enabled');
    }

    const finalState = state || (await this.generateState());
    return this.oauthClient.getAuthorizationUrl(finalState);
  }

  /**
   * Get OAuth user profile from callback
   *
   * Exchanges authorization code for access token and fetches user profile.
   */
  protected async getOAuthProfile(code: string, _state: string): Promise<OAuthUserProfile> {
    if (!this.oauthClient) {
      throw new NAuthException(AuthErrorCode.SOCIAL_CONFIG_MISSING, 'Google OAuth is not enabled');
    }

    const providerConfig = this.getProviderConfig();
    if (!providerConfig || !providerConfig.callbackUrl) {
      throw new NAuthException(AuthErrorCode.SOCIAL_CONFIG_MISSING, 'Google OAuth callback URL is not configured');
    }

    // Exchange code for access token
    const tokens = await this.oauthClient.exchangeCodeForToken(code, providerConfig.callbackUrl);

    // Get user profile from Google
    return await this.oauthClient.getUserProfile(tokens.accessToken);
  }

  /**
   * Verify Google ID token from native mobile apps
   */
  protected async verifyNativeToken(
    idToken: string,
    _accessToken?: string,
    profileData?: unknown,
  ): Promise<OAuthUserProfile> {
    const providerConfig = this.getProviderConfig();
    if (!providerConfig) {
      throw new NAuthException(AuthErrorCode.SOCIAL_CONFIG_MISSING, 'Google OAuth is not configured');
    }

    const clientIds = providerConfig.clientId || '';
    if (!this.tokenVerifier?.verifyGoogleToken) {
      throw new NAuthException(AuthErrorCode.SOCIAL_CONFIG_MISSING, 'Google token verifier is not available');
    }

    // Verify ID token with Google's public keys
    const verified = (await this.tokenVerifier.verifyGoogleToken(idToken, clientIds)) as VerifiedGoogleTokenProfile;
    this.logger?.debug?.(`Verified Google token for: ${verified.email}`);

    // CRITICAL: Require email from all social providers for signup
    if (!verified.email || !verified.email_verified) {
      throw new NAuthException(
        AuthErrorCode.SOCIAL_EMAIL_REQUIRED,
        'Email is required and must be verified by Google.',
      );
    }

    const profileDataTyped = profileData as { givenName?: string; familyName?: string; imageUrl?: string } | undefined;
    return {
      id: verified.sub,
      email: verified.email,
      firstName: verified.given_name || profileDataTyped?.givenName || null,
      lastName: verified.family_name || profileDataTyped?.familyName || null,
      picture: verified.picture || profileDataTyped?.imageUrl || null,
      verified: verified.email_verified,
      raw: verified as unknown as Record<string, unknown>,
    };
  }
}
