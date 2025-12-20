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
import { ITokenVerifierService } from '../../interfaces/token-verifier.interface';

export interface NAuthSocialProviders {
  googleAuth?: ISocialAuthProviderService;
  appleAuth?: ISocialAuthProviderService;
  facebookAuth?: ISocialAuthProviderService;
}

/**
 * Import an optional peer dependency at runtime without creating a compile-time
 * dependency for TypeScript consumers of `@nauth-toolkit/core`.
 *
 * IMPORTANT: the module specifier is intentionally typed as `string` (not a literal)
 * to prevent TypeScript from erroring when the peer dependency isn't installed.
 */
async function importOptional<TModule>(moduleName: string): Promise<TModule | null> {
  try {
    return (await import(moduleName)) as unknown as TModule;
  } catch {
    return null;
  }
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
      type GoogleProviderModule = {
        GoogleSocialAuthService: new (...args: unknown[]) => ISocialAuthProviderService;
        TokenVerifierService: new (config: NAuthConfig) => ITokenVerifierService;
      };

      const googleModule = await importOptional<GoogleProviderModule>('@nauth-toolkit/social-google' as string);
      if (!googleModule) {
        logger?.warn?.(
          'Google OAuth provider not available. Install @nauth-toolkit/social-google to enable Google authentication.',
        );
        return providers;
      }

      // Create token verifier for native mobile token validation
      const tokenVerifier = new googleModule.TokenVerifierService(config);

      const googleAuth = new googleModule.GoogleSocialAuthService(
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
      type AppleProviderModule = {
        AppleSocialAuthService: new (...args: unknown[]) => ISocialAuthProviderService;
        TokenVerifierService: new (config: NAuthConfig) => ITokenVerifierService;
      };

      const appleModule = await importOptional<AppleProviderModule>('@nauth-toolkit/social-apple' as string);
      if (!appleModule) {
        logger?.warn?.(
          'Apple Sign-In provider not available. Install @nauth-toolkit/social-apple to enable Apple authentication.',
        );
        return providers;
      }

      // Create token verifier for native mobile token validation
      const tokenVerifier = new appleModule.TokenVerifierService(config);

      const appleAuth = new appleModule.AppleSocialAuthService(
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
      type FacebookProviderModule = {
        FacebookSocialAuthService: new (...args: unknown[]) => ISocialAuthProviderService;
        TokenVerifierService: new (config: NAuthConfig) => ITokenVerifierService;
      };

      const facebookModule = await importOptional<FacebookProviderModule>('@nauth-toolkit/social-facebook' as string);
      if (!facebookModule) {
        logger?.warn?.(
          'Facebook OAuth provider not available. Install @nauth-toolkit/social-facebook to enable Facebook authentication.',
        );
        return providers;
      }

      // Create token verifier for native mobile token validation
      const tokenVerifier = new facebookModule.TokenVerifierService(config);

      const facebookAuth = new facebookModule.FacebookSocialAuthService(
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
