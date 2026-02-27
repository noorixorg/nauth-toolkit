import { Module } from '@nestjs/common';
import { TOTPMFAProviderService } from '../src/totp-mfa-provider.service';
import { TOTPService } from '../src/totp.service';
import { Repository } from 'typeorm';
// Public API imports
import { NAuthConfig, NAuthLogger, ClientInfoService, BaseMFADevice, BaseUser } from '@nauth-toolkit/core';
// Internal API imports (for provider implementations)
import {
  NAUTH_MFA_PROVIDER_TOKEN,
  PasswordService,
  ChallengeService,
  AuthAuditService as InternalAuthAuditService,
} from '@nauth-toolkit/core/internal';

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
        challengeService: ChallengeService | undefined,
        auditService: InternalAuthAuditService | undefined,
        clientInfoService: ClientInfoService | undefined,
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

    // Bind to shared discovery token (registration is performed by AuthModule at app bootstrap)
    {
      provide: NAUTH_MFA_PROVIDER_TOKEN,
      useExisting: TOTPMFAProviderService,
    },
  ],
  exports: [TOTPService, TOTPMFAProviderService],
})
export class TOTPMFAModule {}
