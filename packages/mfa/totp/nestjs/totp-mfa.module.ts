import { Module, OnModuleInit } from '@nestjs/common';
import { TOTPMFAProviderService } from '../src/totp-mfa-provider.service';
import { TOTPService } from '../src/totp.service';
// Public API imports
import { MFAService, NAuthConfig, NAuthLogger } from '@nauth-toolkit/core';
// Internal API imports (for provider implementations)
import { PasswordService, AuthAuditService as InternalAuthAuditService } from '@nauth-toolkit/core/internal';
import { ClientInfoService } from '@nauth-toolkit/core';
import { Repository } from 'typeorm';
import { BaseMFADevice, BaseUser } from '@nauth-toolkit/core';

/**
 * TOTP MFA Module (NestJS Adapter)
 *
 * Provides TOTP (Time-based One-Time Password) MFA functionality.
 * Auto-registers with MFAService when imported.
 *
 * @example
 * ```typescript
 * @Module({
 *   imports: [
 *     AuthModule.forRoot(config),
 *     TOTPMFAModule, // Auto-registers TOTP provider
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
@Module({
  providers: [
    // TOTP Service (factory provider)
    {
      provide: TOTPService,
      useFactory: (config: NAuthConfig, logger: NAuthLogger) => {
        return new TOTPService(config, logger);
      },
      inject: ['NAUTH_CONFIG', 'NAUTH_LOGGER'],
    },
    // TOTP MFA Provider Service (factory provider)
    {
      provide: TOTPMFAProviderService,
      useFactory: (
        mfaDeviceRepository: Repository<BaseMFADevice>,
        userRepository: Repository<BaseUser>,
        config: NAuthConfig,
        logger: NAuthLogger,
        passwordService: PasswordService,
        totpService: TOTPService,
        challengeService: any, // ChallengeService from core
        auditService: any, // AuthAuditService from core
        clientInfoService: any, // ClientInfoService from core
      ) => {
        return new TOTPMFAProviderService(
          mfaDeviceRepository,
          userRepository,
          config,
          logger,
          passwordService,
          totpService,
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
        TOTPService,
        { token: 'ChallengeService', optional: true },
        { token: InternalAuthAuditService, optional: true },
        { token: ClientInfoService, optional: true },
      ],
    },
  ],
  exports: [TOTPService, TOTPMFAProviderService],
})
export class TOTPMFAModule implements OnModuleInit {
  constructor(
    private readonly totpMFAProvider: TOTPMFAProviderService,
    private readonly mfaService: MFAService,
  ) {}

  /**
   * Auto-register TOTP provider with MFAService
   */
  onModuleInit(): void {
    if (!this.mfaService) {
      throw new Error('MFAService is not available. Ensure AuthModule.forRoot() is imported before TOTPMFAModule.');
    }
    this.mfaService.registerProvider(this.totpMFAProvider);
  }
}
