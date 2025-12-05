import { Module, OnModuleInit } from '@nestjs/common';
import { PasskeyMFAProviderService } from '../src/passkey-mfa-provider.service';
import { PasskeyService } from '../src/passkey.service';
// Public API imports
import { MFAService, NAuthConfig, NAuthLogger } from '@nauth-toolkit/core';
// Internal API imports (for provider implementations)
import { PasswordService } from '@nauth-toolkit/core/internal';
import { Repository } from 'typeorm';
import { BaseMFADevice, BaseUser } from '@nauth-toolkit/core';

/**
 * Passkey MFA Module (NestJS Adapter)
 *
 * Provides Passkey/WebAuthn MFA functionality.
 * Auto-registers with MFAService when imported.
 *
 * Requires Passkey configuration in NAuthConfig (rpName, rpId, etc.).
 *
 * @example
 * ```typescript
 * @Module({
 *   imports: [
 *     AuthModule.forRoot(config), // Must have passkey config
 *     PasskeyMFAModule, // Auto-registers Passkey provider
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
@Module({
  providers: [
    // Passkey Service (factory provider)
    {
      provide: PasskeyService,
      useFactory: (config: NAuthConfig, logger: NAuthLogger) => {
        return new PasskeyService(config, logger);
      },
      inject: ['NAUTH_CONFIG', 'NAUTH_LOGGER'],
    },
    // Passkey MFA Provider Service (factory provider)
    {
      provide: PasskeyMFAProviderService,
      useFactory: (
        mfaDeviceRepository: Repository<BaseMFADevice>,
        userRepository: Repository<BaseUser>,
        config: NAuthConfig,
        logger: NAuthLogger,
        passwordService: PasswordService,
        passkeyService: PasskeyService,
        challengeService: any, // ChallengeService from core
        auditService: any, // AuthAuditService from core
        clientInfoService: any, // ClientInfoService from core
      ) => {
        return new PasskeyMFAProviderService(
          mfaDeviceRepository,
          userRepository,
          config,
          logger,
          passwordService,
          passkeyService,
          challengeService,
          auditService,
          clientInfoService,
        );
      },
      inject: [
        'MFADeviceRepository',
        'UserRepository',
        'NAUTH_CONFIG',
        'NAUTH_LOGGER',
        { token: PasswordService, optional: true },
        PasskeyService,
        { token: 'ChallengeService', optional: true },
        { token: 'AuthAuditService', optional: true },
        { token: 'ClientInfoService', optional: true },
      ],
    },
  ],
  exports: [PasskeyService, PasskeyMFAProviderService],
})
export class PasskeyMFAModule implements OnModuleInit {
  constructor(
    private readonly passkeyMFAProvider: PasskeyMFAProviderService,
    private readonly mfaService: MFAService,
  ) {}

  /**
   * Auto-register Passkey provider with MFAService
   */
  onModuleInit(): void {
    if (!this.mfaService) {
      throw new Error('MFAService is not available. Ensure AuthModule.forRoot() is imported before PasskeyMFAModule.');
    }
    this.mfaService.registerProvider(this.passkeyMFAProvider);
  }
}
