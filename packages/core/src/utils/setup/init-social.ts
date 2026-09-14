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
  ISocialAuthStateStore,
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
import { BaseSocialProviderSecret } from '../../entities';

export interface NAuthSocialProviders {
  googleAuth?: ISocialAuthProviderService;
  appleAuth?: ISocialAuthProviderService;
  facebookAuth?: ISocialAuthProviderService;
  microsoftAuth?: ISocialAuthProviderService;
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
 * @param socialProviderSecretRepository - Repository for social provider secrets (optional, for Apple JWT rotation)
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
  socialAuthStateStore: ISocialAuthStateStore,
  userRepository: Repository<BaseUser>,
  phoneVerificationService?: PhoneVerificationService,
  auditService?: AuthAuditService,
  trustedDeviceService?: TrustedDeviceService,
  socialProviderSecretRepository?: Repository<BaseSocialProviderSecret> | null,
  hookRegistry?: import('../../services/hook-registry.service').HookRegistryService,
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
      if (googleModule) {
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
          hookRegistry,
          tokenVerifier,
        );

        providers.googleAuth = googleAuth;

        // Register with registry
        providerRegistry.registerProvider(googleAuth);
        logger?.debug?.('Google OAuth provider initialized');
      } else {
        logger?.warn?.(
          'Google OAuth provider not available. Install @nauth-toolkit/social-google to enable Google authentication.',
        );
      }
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
      if (appleModule) {
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
          hookRegistry,
          tokenVerifier,
          socialProviderSecretRepository || undefined,
        );

        providers.appleAuth = appleAuth;

        // Register with registry
        providerRegistry.registerProvider(appleAuth);
        logger?.debug?.('Apple Sign-In provider initialized');
      } else {
        logger?.warn?.(
          'Apple Sign-In provider not available. Install @nauth-toolkit/social-apple to enable Apple authentication.',
        );
      }
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
      if (facebookModule) {
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
          hookRegistry,
          tokenVerifier,
        );

        providers.facebookAuth = facebookAuth;

        // Register with registry
        providerRegistry.registerProvider(facebookAuth);
        logger?.debug?.('Facebook OAuth provider initialized');
      } else {
        logger?.warn?.(
          'Facebook OAuth provider not available. Install @nauth-toolkit/social-facebook to enable Facebook authentication.',
        );
      }
    } catch {
      logger?.warn?.(
        'Facebook OAuth provider not available. Install @nauth-toolkit/social-facebook to enable Facebook authentication.',
      );
    }
  }

  // ============================================================================
  // Microsoft Entra ID Provider
  // ============================================================================
  if (config.social?.microsoft?.enabled) {
    try {
      type MicrosoftProviderModule = {
        MicrosoftSocialAuthService: new (...args: unknown[]) => ISocialAuthProviderService;
        TokenVerifierService: new (config: NAuthConfig) => ITokenVerifierService;
      };

      const microsoftModule = await importOptional<MicrosoftProviderModule>(
        '@nauth-toolkit/social-microsoft' as string,
      );
      if (microsoftModule) {
        // Create token verifier for ID token validation (web and native)
        const tokenVerifier = new microsoftModule.TokenVerifierService(config);

        const microsoftAuth = new microsoftModule.MicrosoftSocialAuthService(
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
          hookRegistry,
          tokenVerifier,
        );

        providers.microsoftAuth = microsoftAuth;

        // Register with registry
        providerRegistry.registerProvider(microsoftAuth);
        logger?.debug?.('Microsoft Entra ID provider initialized');
      } else {
        logger?.warn?.(
          'Microsoft provider not available. Install @nauth-toolkit/social-microsoft to enable Microsoft authentication.',
        );
      }
    } catch (error) {
      // Distinguish "package absent" from "package present but failed to construct".
      // Reporting a bad client secret or an invalid tenant as "install the package" sends
      // operators hunting for a dependency problem while the app boots with Microsoft
      // silently unregistered.
      const message = error instanceof Error ? error.message : String(error);
      logger?.error?.(`Microsoft provider failed to initialize: ${message}`);
    }
  }

  return providers;
}
