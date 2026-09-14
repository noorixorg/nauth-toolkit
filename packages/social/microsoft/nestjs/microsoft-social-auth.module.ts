import { Module } from '@nestjs/common';
import { Repository } from 'typeorm';
import { MicrosoftSocialAuthService } from '../src/microsoft-social-auth.service';
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
  NAUTH_SOCIAL_PROVIDER_TOKEN,
  AuthAuditService as InternalAuthAuditService, // Internal version with recordEvent()
  TrustedDeviceService,
  HookRegistryService,
} from '@nauth-toolkit/core/internal';
import { TokenVerifierService as MicrosoftTokenVerifierService } from '../src/token-verifier.service';

/**
 * Microsoft Social Authentication Module (NestJS Adapter)
 *
 * Provides Microsoft Entra ID (Azure AD) integration for nauth-toolkit in NestJS
 * applications. Automatically registers itself with SocialAuthService when imported.
 *
 * **Usage:**
 * ```typescript
 * import { AuthModule } from '@nauth-toolkit/nestjs';
 * import { MicrosoftSocialAuthModule } from '@nauth-toolkit/social-microsoft/nestjs';
 *
 * @Module({
 *   imports: [
 *     AuthModule.forRoot(config),
 *     MicrosoftSocialAuthModule, // Auto-registers with SocialAuthService
 *   ],
 * })
 * export class AppModule {}
 *
 * // Use via registry (recommended for dynamic access)
 * constructor(private socialAuthService: SocialAuthService) {}
 *
 * @Get('social/microsoft')
 * async getMicrosoftAuthUrl() {
 *   const provider = this.socialAuthService.getProvider('microsoft');
 *   const authUrl = await provider.getAuthUrl();
 *   return { authUrl };
 * }
 *
 * // Or inject directly
 * constructor(private microsoftAuth: MicrosoftSocialAuthService) {}
 * ```
 */
@Module({
  // No imports needed - AuthModule is @Global() so its providers are available
  providers: [
    // Token verifier for Microsoft ID tokens
    {
      provide: 'MICROSOFT_TOKEN_VERIFIER',
      useFactory: (config: NAuthConfig) => {
        return new MicrosoftTokenVerifierService(config);
      },
      inject: ['NAUTH_CONFIG'],
    },
    // Microsoft Social Auth Service (factory provider)
    // Only meaningful if Microsoft OAuth is enabled in config
    {
      provide: MicrosoftSocialAuthService,
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
        hookRegistry?: HookRegistryService, // Required for lifecycle hooks
        tokenVerifier?: ITokenVerifierService,
      ): MicrosoftSocialAuthService => {
        // Service can be created even when disabled - it handles gracefully
        // Schema validation ensures credentials are present when enabled=true
        return new MicrosoftSocialAuthService(
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
        { token: 'MICROSOFT_TOKEN_VERIFIER', optional: true },
      ],
    },

    // Bind to shared discovery token (registration is performed by AuthModule at app bootstrap)
    {
      provide: NAUTH_SOCIAL_PROVIDER_TOKEN,
      useExisting: MicrosoftSocialAuthService,
    },
  ],
  exports: [MicrosoftSocialAuthService],
})
export class MicrosoftSocialAuthModule {}
