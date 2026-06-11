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
 * Lightweight check for JWT format (header.payload.signature).
 *
 * Used to distinguish Facebook Limited Login ID tokens (JWT) from classic access tokens.
 *
 * @param token - Raw token string
 * @returns True if token looks like a JWT
 */
function isJwt(token: string): boolean {
  // JWTs are 3 base64url segments separated by dots.
  const parts = token.split('.');
  return parts.length === 3 && parts.every((p) => p.length > 0);
}

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
   * @param oauthParams - Optional OAuth parameters to append to URL (overrides config defaults)
   * @returns Authorization URL for redirecting user to Facebook
   */
  async getAuthUrl(state?: string, oauthParams?: Record<string, string>): Promise<string> {
    if (!this.oauthClient) {
      throw new NAuthException(AuthErrorCode.SOCIAL_CONFIG_MISSING, 'Facebook OAuth is not enabled');
    }
    const finalState = state || (await this.generateState());

    // Merge config-level oauthParams with per-request params (per-request takes precedence)
    const providerConfig = this.getProviderConfig();
    const mergedParams = {
      ...providerConfig?.oauthParams,
      ...oauthParams,
    };

    return this.oauthClient.getAuthorizationUrl(
      finalState,
      Object.keys(mergedParams).length > 0 ? mergedParams : undefined,
    );
  }

  /**
   * Get OAuth user profile from callback
   *
   * Exchanges authorization code for access token and fetches user profile.
   *
   * @param code - Authorization code from Facebook OAuth callback
   * @param _state - State parameter (validated by base class)
   * @param _profileData - Optional profile data (not used by Facebook)
   * @returns User profile from Facebook
   * @protected
   */
  protected async getOAuthProfile(
    code: string,
    _state: string,
    _profileData?: Record<string, unknown>,
  ): Promise<OAuthUserProfile> {
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
    accessToken?: string,
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

    // ============================================================================
    // Facebook Native Token Verification
    // ============================================================================
    // Facebook supports two native token shapes:
    // - Classic login: access token (opaque string) -> verify via Graph API debug_token
    // - Limited Login (iOS): ID token (JWT) -> verify via OIDC JWKS (RS256)
    //
    // NOTE: Base class passes dto.idToken as first arg; dto.accessToken as second arg.
    // Consumers might send:
    // - { accessToken } only (client SDK supports this) -> controller should map it into dto.idToken or dto.accessToken.
    // - { idToken } (JWT) for Limited Login.
    let verified: VerifiedFacebookTokenProfile;

    const isJwtToken = isJwt(idToken);
    const hasIdTokenVerifier = !!this.tokenVerifier.verifyFacebookIdToken;

    if (isJwtToken && hasIdTokenVerifier) {
      // Limited Login: verify ID token (JWT) via Facebook OIDC JWKS.
      if (!this.tokenVerifier.verifyFacebookIdToken) {
        throw new NAuthException(AuthErrorCode.SOCIAL_CONFIG_MISSING, 'Facebook ID token verifier is not available');
      }
      const jwtProfile = (await this.tokenVerifier.verifyFacebookIdToken(idToken, appId)) as {
        sub: string;
        email?: string;
        name?: string;
        given_name?: string;
        family_name?: string;
        picture?: string;
      };

      verified = {
        id: jwtProfile.sub,
        email: jwtProfile.email,
        first_name: jwtProfile.given_name || (jwtProfile.name ? jwtProfile.name.split(' ')[0] : undefined),
        last_name: jwtProfile.family_name || undefined,
        picture: jwtProfile.picture ? { data: { url: jwtProfile.picture } } : undefined,
      };
      this.logger?.debug?.(`Verified Facebook ID token for: ${verified.email || verified.id}`);
    } else {
      // Classic login: verify access token via Graph API.
      // Prefer explicit accessToken if provided, otherwise treat idToken as access token for backward compatibility.
      const tokenToVerify = accessToken || idToken;

      const verifiedAccess = (await this.tokenVerifier.verifyFacebookToken(
        tokenToVerify,
        appId,
        appSecret,
      )) as VerifiedFacebookTokenProfile;
      verified = verifiedAccess;
      this.logger?.debug?.(`Verified Facebook access token for: ${verified.email || verified.id}`);
    }

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
      // ?? not ||: preserve "" from provider (|| would coerce to null)
      firstName: verified.first_name ?? profileDataTyped?.firstName ?? null,
      lastName: verified.last_name ?? profileDataTyped?.lastName ?? null,
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
