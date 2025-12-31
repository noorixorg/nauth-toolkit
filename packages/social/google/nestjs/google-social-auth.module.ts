import { Module } from '@nestjs/common';
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
  ISocialAuthStateStore,
} from '@nauth-toolkit/core';
// Internal API imports (for provider implementations)
import {
  JwtService,
  SessionService,
  AuthChallengeHelperService,
  NAUTH_SOCIAL_PROVIDER_TOKEN,
  AuthAuditService as InternalAuthAuditService, // Internal version with recordEvent()
  TrustedDeviceService,
  HookRegistryService,
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
        stateStore: ISocialAuthStateStore,
        userRepository: any,
        phoneVerificationService?: PhoneVerificationService,
        auditService?: InternalAuthAuditService, // Optional - only available when auditLogs.enabled is true
        trustedDeviceService?: TrustedDeviceService, // Optional - only available when rememberDevices is enabled
        hookRegistry?: HookRegistryService, // Required for lifecycle hooks
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
          trustedDeviceService,
          hookRegistry,
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
        { token: InternalAuthAuditService, optional: true }, // Optional - only available when auditLogs.enabled is true
        { token: TrustedDeviceService, optional: true }, // Optional - only available when rememberDevices is enabled
        HookRegistryService, // Required for lifecycle hooks
        { token: 'GOOGLE_TOKEN_VERIFIER', optional: true },
      ],
    },

    // Bind to shared discovery token (registration is performed by AuthModule at app bootstrap)
    {
      provide: NAUTH_SOCIAL_PROVIDER_TOKEN,
      useExisting: GoogleSocialAuthService,
    },
  ],
  exports: [GoogleSocialAuthService],
})
export class GoogleSocialAuthModule {}
