import { Module, OnModuleInit } from '@nestjs/common';
import { FacebookSocialAuthService } from '../src/facebook-social-auth.service';
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
  BaseUser,
} from '@nauth-toolkit/core';
// Internal API imports (for provider implementations)
import {
  JwtService,
  SessionService,
  AuthChallengeHelperService,
  SocialProviderRegistry,
  AuthAuditService as InternalAuthAuditService, // Internal version with recordEvent()
  TrustedDeviceService,
} from '@nauth-toolkit/core/internal';
import { TokenVerifierService as FacebookTokenVerifierService } from '../src/token-verifier.service';
import { Repository } from 'typeorm';

/**
 * Facebook Social Authentication Module (NestJS Adapter)
 *
 * Provides Facebook OAuth integration for nauth-toolkit in NestJS applications.
 * Automatically registers itself with SocialAuthService when imported.
 *
 * **Usage:**
 * ```typescript
 * import { AuthModule } from '@nauth-toolkit/nestjs';
 * import { FacebookSocialAuthModule } from '@nauth-toolkit/social-facebook/nestjs';
 *
 * @Module({
 *   imports: [
 *     AuthModule.forRoot(config),
 *     FacebookSocialAuthModule, // 👈 Auto-registers with SocialAuthService
 *   ],
 * })
 * export class AppModule {}
 *
 * // Use via registry (recommended for dynamic access)
 * constructor(private socialAuthService: SocialAuthService) {}
 *
 * @Get('social/facebook')
 * async getFacebookAuthUrl() {
 *   const facebookProvider = this.socialAuthService.getProvider('facebook');
 *   const authUrl = await facebookProvider.getAuthUrl();
 *   return { authUrl };
 * }
 *
 * // Or inject directly
 * constructor(private facebookAuth: FacebookSocialAuthService) {}
 * ```
 */
@Module({
  // No imports needed - AuthModule is @Global() so its providers are available
  providers: [
    // Token verifier for Facebook access tokens
    {
      provide: 'FACEBOOK_TOKEN_VERIFIER',
      useFactory: (config: NAuthConfig) => {
        return new FacebookTokenVerifierService(config);
      },
      inject: ['NAUTH_CONFIG'],
    },
    // Facebook Social Auth Service (factory provider)
    {
      provide: FacebookSocialAuthService,
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
        userRepository: Repository<BaseUser>,
        phoneVerificationService?: PhoneVerificationService,
        auditService?: InternalAuthAuditService, // Optional - only available when auditLogs.enabled is true
        trustedDeviceService?: TrustedDeviceService, // Optional - only available when rememberDevices is enabled
        tokenVerifier?: ITokenVerifierService,
      ) => {
        return new FacebookSocialAuthService(
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
        { token: 'FACEBOOK_TOKEN_VERIFIER', optional: true },
      ],
    },
  ],
  exports: [FacebookSocialAuthService],
})
export class FacebookSocialAuthModule implements OnModuleInit {
  constructor(
    private readonly facebookSocialAuthService: FacebookSocialAuthService,
    private readonly providerRegistry: SocialProviderRegistry,
  ) {}

  /**
   * Auto-register Facebook provider with the SocialProviderRegistry
   * when the module is initialized (only if enabled in config).
   */
  onModuleInit(): void {
    const config = this.facebookSocialAuthService['config'] as NAuthConfig; // Access protected config
    const providerConfig = config.social?.facebook;
    if (providerConfig?.enabled) {
      this.providerRegistry.registerProvider(this.facebookSocialAuthService);
    }
  }
}
