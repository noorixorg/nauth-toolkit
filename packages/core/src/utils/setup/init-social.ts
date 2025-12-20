/**
 * Social Authentication Provider Initialization
 *
 * Dynamically loads and initializes social auth providers based on configuration.
 */

// Public API imports
import {
  NAuthConfig,
  NAuthLogger,
  SocialAuthService,
  AuthService,
  ClientInfoService,
  AuthAuditService,
  PhoneVerificationService,
  BaseUser,
} from '../../index';
// Internal API imports (for framework adapter use only)
import {
  JwtService,
  SessionService,
  AuthChallengeHelperService,
  SocialProviderRegistry,
  TrustedDeviceService,
} from '../../internal';
import { Repository } from 'typeorm';
import { ISocialAuthProviderService } from '../../interfaces/social-auth-provider.interface';

export interface NAuthSocialProviders {
  googleAuth?: ISocialAuthProviderService;
  appleAuth?: ISocialAuthProviderService;
  facebookAuth?: ISocialAuthProviderService;
}

/**
 * Initialize and register social authentication providers
 *
 * Dynamically imports social provider packages based on configuration.
 * Each provider is initialized with all required services and registered
 * with the SocialAuthService registry.
 *
 * @param config - NAuth configuration
 * @param providerRegistry - Social provider registry (internal)
 * @param authService - Core authentication service
 * @param socialAuthService - Social authentication service
 * @param jwtService - JWT token service
 * @param sessionService - Session management service
 * @param challengeHelper - Auth challenge helper service
 * @param clientInfoService - Client information service
 * @param logger - Logger instance
 * @param socialAuthStateStore - Shared state store for OAuth CSRF protection
 * @param phoneVerificationService - Phone verification service (optional)
 * @param auditService - Audit logging service (optional)
 * @param trustedDeviceService - Trusted device service (optional)
 * @returns Object containing initialized social providers
 */
export async function initSocialAuth(
  config: NAuthConfig,
  providerRegistry: SocialProviderRegistry,
  authService: AuthService,
  socialAuthService: SocialAuthService,
  jwtService: JwtService,
  sessionService: SessionService,
  challengeHelper: AuthChallengeHelperService,
  clientInfoService: ClientInfoService,
  logger: NAuthLogger,
  socialAuthStateStore: Map<string, { timestamp: number; provider: string }>,
  userRepository: Repository<BaseUser>,
  phoneVerificationService?: PhoneVerificationService,
  auditService?: AuthAuditService,
  trustedDeviceService?: TrustedDeviceService,
): Promise<NAuthSocialProviders> {
  const providers: NAuthSocialProviders = {};

  // ============================================================================
  // Google OAuth Provider
  // ============================================================================
  if (config.social?.google?.enabled) {
    try {
      // @ts-expect-error - Optional peer dependency, may not be installed
      const { GoogleSocialAuthService, TokenVerifierService } = await import('@nauth-toolkit/social-google');

      // Create token verifier for native mobile token validation
      const tokenVerifier = new TokenVerifierService(config);

      const googleAuth = new GoogleSocialAuthService(
        config,
        logger,
        authService,
        socialAuthService,
        jwtService,
        sessionService,
        challengeHelper,
        clientInfoService,
        socialAuthStateStore,
        userRepository,
        phoneVerificationService,
        auditService,
        trustedDeviceService,
        tokenVerifier,
      );

      providers.googleAuth = googleAuth;

      // Register with registry
      providerRegistry.registerProvider(googleAuth);
      logger?.debug?.('Google OAuth provider initialized');
    } catch {
      logger?.warn?.(
        'Google OAuth provider not available. Install @nauth-toolkit/social-google to enable Google authentication.',
      );
    }
  }

  // ============================================================================
  // Apple Sign-In Provider
  // ============================================================================
  if (config.social?.apple?.enabled) {
    try {
      // @ts-expect-error - Optional peer dependency, may not be installed
      const { AppleSocialAuthService, TokenVerifierService } = await import('@nauth-toolkit/social-apple');

      // Create token verifier for native mobile token validation
      const tokenVerifier = new TokenVerifierService(config);

      const appleAuth = new AppleSocialAuthService(
        config,
        logger,
        authService,
        socialAuthService,
        jwtService,
        sessionService,
        challengeHelper,
        clientInfoService,
        socialAuthStateStore,
        userRepository,
        phoneVerificationService,
        auditService,
        trustedDeviceService,
        tokenVerifier,
      );

      providers.appleAuth = appleAuth;

      // Register with registry
      providerRegistry.registerProvider(appleAuth);
      logger?.debug?.('Apple Sign-In provider initialized');
    } catch {
      logger?.warn?.(
        'Apple Sign-In provider not available. Install @nauth-toolkit/social-apple to enable Apple authentication.',
      );
    }
  }

  // ============================================================================
  // Facebook OAuth Provider
  // ============================================================================
  if (config.social?.facebook?.enabled) {
    try {
      // @ts-expect-error - Optional peer dependency, may not be installed
      const { FacebookSocialAuthService, TokenVerifierService } = await import('@nauth-toolkit/social-facebook');

      // Create token verifier for native mobile token validation
      const tokenVerifier = new TokenVerifierService(config);

      const facebookAuth = new FacebookSocialAuthService(
        config,
        logger,
        authService,
        socialAuthService,
        jwtService,
        sessionService,
        challengeHelper,
        clientInfoService,
        socialAuthStateStore,
        userRepository,
        phoneVerificationService,
        auditService,
        trustedDeviceService,
        tokenVerifier,
      );

      providers.facebookAuth = facebookAuth;

      // Register with registry
      providerRegistry.registerProvider(facebookAuth);
      logger?.debug?.('Facebook OAuth provider initialized');
    } catch {
      logger?.warn?.(
        'Facebook OAuth provider not available. Install @nauth-toolkit/social-facebook to enable Facebook authentication.',
      );
    }
  }

  return providers;
}
