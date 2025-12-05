import { Module, OnModuleInit } from '@nestjs/common';
import { GoogleSocialAuthService } from '../src/google-social-auth.service';
// Public API imports
import {
  AuthService,
  SocialAuthService,
  ClientInfoService,
  NAuthConfig,
  NAuthLogger,
  PhoneVerificationService,
  ITokenVerifierService,
} from '@nauth-toolkit/core';
// Internal API imports (for provider implementations)
import {
  JwtService,
  SessionService,
  AuthChallengeHelperService,
  SocialProviderRegistry,
  AuthAuditService, // Internal version with recordEvent()
} from '@nauth-toolkit/core/internal';
import { TokenVerifierService as GoogleTokenVerifierService } from '../src/token-verifier.service';

/**
 * Google Social Authentication Module (NestJS Adapter)
 *
 * Provides Google OAuth integration for nauth-toolkit in NestJS applications.
 * Automatically registers itself with SocialAuthService when imported.
 *
 * **Usage:**
 * ```typescript
 * import { AuthModule } from '@nauth-toolkit/nestjs';
 * import { GoogleSocialAuthModule } from '@nauth-toolkit/social-google/nestjs';
 *
 * @Module({
 *   imports: [
 *     AuthModule.forRoot(config),
 *     GoogleSocialAuthModule, // 👈 Auto-registers with SocialAuthService
 *   ],
 * })
 * export class AppModule {}
 *
 * // Use via registry (recommended for dynamic access)
 * constructor(private socialAuthService: SocialAuthService) {}
 *
 * @Get('social/google')
 * async getGoogleAuthUrl() {
 *   const googleProvider = this.socialAuthService.getProvider('google');
 *   const authUrl = await googleProvider.getAuthUrl();
 *   return { authUrl };
 * }
 *
 * // Or inject directly
 * constructor(private googleAuth: GoogleSocialAuthService) {}
 * ```
 */
@Module({
  // No imports needed - AuthModule is @Global() so its providers are available
  providers: [
    // Token verifier for Google ID tokens
    {
      provide: 'GOOGLE_TOKEN_VERIFIER',
      useFactory: (config: NAuthConfig) => {
        return new GoogleTokenVerifierService(config);
      },
      inject: ['NAUTH_CONFIG'],
    },
    // Google Social Auth Service (factory provider)
    // Only create service if Google OAuth is enabled in config
    {
      provide: GoogleSocialAuthService,
      useFactory: (
        config: NAuthConfig,
        logger: NAuthLogger,
        authService: AuthService,
        socialAuthService: SocialAuthService,
        jwtService: JwtService,
        sessionService: SessionService,
        challengeHelper: AuthChallengeHelperService,
        clientInfoService: ClientInfoService,
        stateStore: Map<string, { timestamp: number; provider: string }>,
        userRepository: any,
        phoneVerificationService?: PhoneVerificationService,
        auditService?: AuthAuditService, // Optional - only available when auditLogs.enabled is true
        tokenVerifier?: ITokenVerifierService,
      ): GoogleSocialAuthService => {
        // Service can be created even when disabled - it handles gracefully
        // Schema validation ensures credentials are present when enabled=true
        return new GoogleSocialAuthService(
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
          tokenVerifier,
        );
      },
      inject: [
        'NAUTH_CONFIG',
        'NAUTH_LOGGER',
        AuthService,
        SocialAuthService,
        JwtService,
        SessionService,
        AuthChallengeHelperService,
        ClientInfoService,
        'SOCIAL_AUTH_STATE_STORE',
        'UserRepository',
        { token: PhoneVerificationService, optional: true },
        { token: AuthAuditService, optional: true }, // Optional - only available when auditLogs.enabled is true
        { token: 'GOOGLE_TOKEN_VERIFIER', optional: true },
      ],
    },
  ],
  exports: [GoogleSocialAuthService],
})
export class GoogleSocialAuthModule implements OnModuleInit {
  constructor(
    private readonly googleSocialAuthService: GoogleSocialAuthService,
    private readonly providerRegistry: SocialProviderRegistry,
  ) {}

  /**
   * Auto-register Google provider with the SocialProviderRegistry
   * when the module is initialized.
   * Only registers if the provider is enabled in config.
   */
  onModuleInit(): void {
    // Check if provider is enabled by checking if oauthClient was initialized
    // Service sets oauthClient to null when disabled
    const config = this.googleSocialAuthService['config'] as NAuthConfig;
    const providerConfig = config.social?.google;
    if (providerConfig?.enabled) {
      this.providerRegistry.registerProvider(this.googleSocialAuthService);
    }
    // If disabled, silently skip registration - module can exist but provider won't be available
  }
}
