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
  BaseSocialProviderSecret,
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
 * jose module type (ESM-only dependency).
 *
 * IMPORTANT: `jose@6` is ESM-only. This package is compiled to CommonJS by default,
 * so we load jose via dynamic import to avoid `ERR_REQUIRE_ESM` at runtime.
 */
type JoseModule = typeof import('jose');

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
  private readonly socialProviderSecretRepository: Repository<BaseSocialProviderSecret> | null;
  private joseModulePromise: Promise<JoseModule> | null = null;

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
    // Repository for storing Apple JWT client secrets (optional, for JWT rotation)
    socialProviderSecretRepository?: Repository<BaseSocialProviderSecret> | null,
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

    // Store repository for JWT rotation
    this.socialProviderSecretRepository = socialProviderSecretRepository || null;

    // Initialize Apple OAuth client
    const providerConfig = this.getProviderConfig();
    if (!providerConfig || !providerConfig.enabled) {
      this.oauthClient = null;
      this.tokenVerifier = null;
      return; // Exit constructor early if disabled
    }

    // ============================================================================
    // Apple JWT Rotation Dependency Validation (web OAuth)
    // ============================================================================
    // WHY: Apple is an optional provider. We only require the DB repository when Apple is enabled.
    // This makes misconfiguration fail fast on startup (module init), not during the callback.
    // ============================================================================
    if (!this.socialProviderSecretRepository) {
      throw new NAuthException(
        AuthErrorCode.SOCIAL_CONFIG_MISSING,
        'Apple Sign-In is enabled but SocialProviderSecretRepository is not available. ' +
          'Ensure your TypeORM DataSource includes the SocialProviderSecret entity (via getNAuthEntities()) ' +
          'and that @nauth-toolkit/nestjs AuthModule is imported.',
      );
    }

    const webClientId = Array.isArray(providerConfig.clientId) ? providerConfig.clientId[0] : providerConfig.clientId;
    if (!webClientId) {
      // Schema validation should catch this, but handle gracefully
      this.oauthClient = null;
      this.tokenVerifier = null;
      return;
    }

    // Initialize OAuth client without clientSecret (will be provided dynamically)
    this.oauthClient = new AppleOAuthClient({
      clientId: webClientId,
      clientSecret: '', // Will be provided dynamically per request
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
   * Lazy-load jose (ESM-only) in a CJS-compatible way.
   *
   * @returns Promise resolving to jose module
   */
  private async getJose(): Promise<JoseModule> {
    if (!this.joseModulePromise) {
      this.joseModulePromise = import('jose') as Promise<JoseModule>;
    }
    return await this.joseModulePromise;
  }

  /**
   * Generate Apple JWT client secret from configuration
   *
   * Creates a JWT signed with ES256 using the provided .p8 private key.
   * The JWT is valid for 180 days (Apple's maximum).
   *
   * @param providerConfig - Apple provider configuration
   * @returns Generated JWT client secret
   * @throws {NAuthException} If required configuration is missing
   */
  private async generateAppleJWTClientSecret(providerConfig: {
    teamId?: string;
    keyId?: string;
    privateKeyPem?: string;
    clientId?: string | string[];
  }): Promise<string> {
    if (!providerConfig.teamId || !providerConfig.keyId || !providerConfig.privateKeyPem) {
      throw new NAuthException(
        AuthErrorCode.SOCIAL_CONFIG_MISSING,
        'Apple configuration requires teamId, keyId, and privateKeyPem for web OAuth',
      );
    }

    const clientId = Array.isArray(providerConfig.clientId) ? providerConfig.clientId[0] : providerConfig.clientId;
    if (!clientId) {
      throw new NAuthException(AuthErrorCode.SOCIAL_CONFIG_MISSING, 'Apple clientId is required');
    }

    const jose = await this.getJose();

    // Normalize the private key format
    // Handle both formats: with \n escape sequences or actual newlines, or single-line
    let normalizedKey = providerConfig.privateKeyPem;
    // Replace literal \n with actual newlines (for environment variables with escape sequences)
    normalizedKey = normalizedKey.replace(/\\n/g, '\n');
    // Ensure proper PEM format with newlines if missing
    if (!normalizedKey.includes('\n')) {
      // Single-line key: insert newlines after header and before footer
      normalizedKey = normalizedKey.replace(
        /-----BEGIN PRIVATE KEY-----(.+)-----END PRIVATE KEY-----/,
        '-----BEGIN PRIVATE KEY-----\n$1\n-----END PRIVATE KEY-----',
      );
    }

    // Parse the private key
    // importPKCS8 returns a private key that can be used for signing
    let privateKey: Awaited<ReturnType<typeof jose.importPKCS8>>;
    try {
      privateKey = await jose.importPKCS8(normalizedKey, 'ES256');
    } catch (error) {
      throw new NAuthException(
        AuthErrorCode.SOCIAL_CONFIG_MISSING,
        `Failed to parse Apple private key: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }

    // Generate JWT with 180 days expiration (Apple's maximum)
    const now = Math.floor(Date.now() / 1000);
    const expiresIn = 180 * 24 * 60 * 60; // 180 days in seconds

    const jwt = await new jose.SignJWT({
      iss: providerConfig.teamId,
      iat: now,
      exp: now + expiresIn,
      aud: 'https://appleid.apple.com',
      sub: clientId,
    })
      .setProtectedHeader({
        alg: 'ES256',
        kid: providerConfig.keyId,
      })
      .sign(privateKey);

    return jwt;
  }

  /**
   * Get or refresh Apple JWT client secret from database
   *
   * Retrieves the stored JWT from the database. If it doesn't exist or has less than
   * 30 days until expiration, generates a new JWT and stores it.
   *
   * @param providerConfig - Apple provider configuration
   * @returns JWT client secret
   * @throws {NAuthException} If JWT generation fails or repository is not available
   */
  private async getOrRefreshAppleJWTClientSecret(providerConfig: {
    teamId?: string;
    keyId?: string;
    privateKeyPem?: string;
    clientId?: string | string[];
  }): Promise<string> {
    if (!this.socialProviderSecretRepository) {
      throw new NAuthException(
        AuthErrorCode.SOCIAL_CONFIG_MISSING,
        'SocialProviderSecretRepository is required for Apple JWT rotation. Ensure the entity is registered in your database adapter.',
      );
    }

    const provider = 'apple';
    const now = new Date();
    const refreshThreshold = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

    // Try to find existing secret
    let secret = await this.socialProviderSecretRepository.findOne({
      where: { provider },
    });

    // Check if we need to refresh (missing or expires within 30 days)
    if (!secret || secret.expiresAt <= refreshThreshold) {
      // Generate new JWT
      const jwt = await this.generateAppleJWTClientSecret(providerConfig);
      const expiresAt = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000); // 180 days from now

      if (secret) {
        // Update existing record
        secret.clientSecretJwt = jwt;
        secret.expiresAt = expiresAt;
        await this.socialProviderSecretRepository.save(secret);
      } else {
        // Create new record
        secret = this.socialProviderSecretRepository.create({
          provider,
          clientSecretJwt: jwt,
          expiresAt,
        });
        await this.socialProviderSecretRepository.save(secret);
      }

      this.logger?.debug?.('Generated and stored new Apple JWT client secret');
    }

    return secret.clientSecretJwt;
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
   * Automatically refreshes Apple JWT client secret if needed.
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
    if (!this.tokenVerifier?.verifyAppleToken) {
      throw new NAuthException(AuthErrorCode.SOCIAL_CONFIG_MISSING, 'Apple token verifier is not available');
    }

    // Get or refresh JWT client secret
    const clientSecret = await this.getOrRefreshAppleJWTClientSecret(providerConfig);

    // Exchange code for tokens (includes id_token)
    const tokens = await this.oauthClient.exchangeCodeForToken(code, providerConfig.callbackUrl, clientSecret);

    const clientId = Array.isArray(providerConfig.clientId)
      ? providerConfig.clientId[0]
      : providerConfig.clientId || '';
    if (!clientId) {
      throw new NAuthException(AuthErrorCode.SOCIAL_CONFIG_MISSING, 'Apple clientId is required');
    }

    // Apple does not reliably provide a UserInfo endpoint for web OAuth.
    // The standard approach is to verify and read claims from the id_token.
    const verified = (await this.tokenVerifier.verifyAppleToken(tokens.idToken, clientId)) as VerifiedAppleTokenProfile;

    // CRITICAL: Require email from all social providers for signup
    if (!verified.email || !verified.email_verified) {
      throw new NAuthException(AuthErrorCode.SOCIAL_EMAIL_REQUIRED, 'Email is required and must be verified by Apple.');
    }

    return {
      id: verified.sub,
      email: verified.email,
      firstName: null, // Apple only returns name once (via callback profileData; not available in redirect-first flow today)
      lastName: null,
      picture: null,
      verified: verified.email_verified,
      raw: {
        sub: verified.sub,
        email: verified.email,
        email_verified: verified.email_verified,
        is_private_email: verified.is_private_email,
      } as unknown as Record<string, unknown>,
    };
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

    const clientId = Array.isArray(providerConfig.clientId)
      ? providerConfig.clientId[0]
      : providerConfig.clientId || '';
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
