import { Module } from '@nestjs/common';
import { PasskeyMFAProviderService } from '../src/passkey-mfa-provider.service';
import { PasskeyService } from '../src/passkey.service';
// Public API imports
import { NAuthConfig, NAuthLogger, ClientInfoService, BaseMFADevice, BaseUser } from '@nauth-toolkit/core';
// Internal API imports (for provider implementations)
import {
  NAUTH_MFA_PROVIDER_TOKEN,
  PasswordService,
  ChallengeService,
  AuthAuditService as InternalAuthAuditService,
} from '@nauth-toolkit/core/internal';
import { Repository } from 'typeorm';

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
        challengeService: ChallengeService | undefined,
        auditService: InternalAuthAuditService | undefined,
        clientInfoService: ClientInfoService | undefined,
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
        { token: InternalAuthAuditService, optional: true },
        { token: ClientInfoService, optional: true },
      ],
    },

    // Bind to shared discovery token (registration is performed by AuthModule at app bootstrap)
    {
      provide: NAUTH_MFA_PROVIDER_TOKEN,
      useExisting: PasskeyMFAProviderService,
    },
  ],
  exports: [PasskeyService, PasskeyMFAProviderService],
})
export class PasskeyMFAModule {}
