import { Module, OnModuleInit } from '@nestjs/common';
import { AppleSocialAuthService } from '../src/apple-social-auth.service';
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
  SocialProviderRegistry,
  AuthAuditService as InternalAuthAuditService, // Internal version with recordEvent()
  TrustedDeviceService,
} from '@nauth-toolkit/core/internal';
import { TokenVerifierService as AppleTokenVerifierService } from '../src/token-verifier.service';

/**
 * Apple Social Authentication Module (NestJS Adapter)
 *
 * Provides Apple OAuth integration for nauth-toolkit in NestJS applications.
 * Automatically registers itself with SocialAuthService when imported.
 *
 * **Usage:**
 * ```typescript
 * import { AuthModule } from '@nauth-toolkit/nestjs';
 * import { AppleSocialAuthModule } from '@nauth-toolkit/social-apple/nestjs';
 *
 * @Module({
 *   imports: [
 *     AuthModule.forRoot(config),
 *     AppleSocialAuthModule, // 👈 Auto-registers with SocialAuthService
 *   ],
 * })
 * export class AppModule {}
 *
 * // Use via registry (recommended for dynamic access)
 * constructor(private socialAuthService: SocialAuthService) {}
 *
 * @Get('social/apple')
 * async getAppleAuthUrl() {
 *   const appleProvider = this.socialAuthService.getProvider('apple');
 *   const authUrl = await appleProvider.getAuthUrl();
 *   return { authUrl };
 * }
 *
 * // Or inject directly
 * constructor(private appleAuth: AppleSocialAuthService) {}
 * ```
 */
@Module({
  // No imports needed - AuthModule is @Global() so its providers are available
  providers: [
    // Token verifier for Apple ID tokens
    {
      provide: 'APPLE_TOKEN_VERIFIER',
      useFactory: (config: NAuthConfig) => {
        return new AppleTokenVerifierService(config);
      },
      inject: ['NAUTH_CONFIG'],
    },
    // Apple Social Auth Service (factory provider)
    {
      provide: AppleSocialAuthService,
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
        tokenVerifier?: ITokenVerifierService,
      ) => {
        return new AppleSocialAuthService(
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
        { token: 'APPLE_TOKEN_VERIFIER', optional: true },
      ],
    },
  ],
  exports: [AppleSocialAuthService],
})
export class AppleSocialAuthModule implements OnModuleInit {
  constructor(
    private readonly appleSocialAuthService: AppleSocialAuthService,
    private readonly providerRegistry: SocialProviderRegistry,
  ) {}

  /**
   * Auto-register Apple provider with the SocialProviderRegistry
   * when the module is initialized (only if enabled in config).
   */
  onModuleInit(): void {
    const config = this.appleSocialAuthService['config'] as NAuthConfig; // Access protected config
    const providerConfig = config.social?.apple;
    if (providerConfig?.enabled) {
      this.providerRegistry.registerProvider(this.appleSocialAuthService);
    }
  }
}
