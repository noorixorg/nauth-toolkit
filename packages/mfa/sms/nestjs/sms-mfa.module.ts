import { Module } from '@nestjs/common';
import { SMSMFAProviderService } from '../src/sms-mfa-provider.service';
import { Repository } from 'typeorm';
// Public API imports
import {
  NAuthConfig,
  NAuthLogger,
  PhoneVerificationService,
  ClientInfoService,
  BaseMFADevice,
  BaseUser,
} from '@nauth-toolkit/core';
// Internal API imports (for provider implementations)
import {
  NAUTH_MFA_PROVIDER_TOKEN,
  PasswordService,
  ChallengeService,
  AuthAuditService as InternalAuthAuditService,
} from '@nauth-toolkit/core/internal';

/**
 * SMS MFA Module (NestJS Adapter)
 *
 * Provides SMS-based MFA functionality.
 * Auto-registers with MFAService when imported.
 *
 * Requires PhoneVerificationService from @nauth-toolkit/core,
 * which is available when an SMS provider is configured.
 *
 * @example
 * ```typescript
 * @Module({
 *   imports: [
 *     AuthModule.forRoot(config), // Must have SMS provider configured
 *     SMSMFAModule, // Auto-registers SMS provider
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
@Module({
  providers: [
    // SMS MFA Provider Service (factory provider)
    {
      provide: SMSMFAProviderService,
      useFactory: (
        mfaDeviceRepository: Repository<BaseMFADevice>,
        userRepository: Repository<BaseUser>,
        config: NAuthConfig,
        logger: NAuthLogger,
        passwordService: PasswordService,
        phoneVerificationService: PhoneVerificationService | undefined,
        challengeService: ChallengeService | undefined,
        auditService: InternalAuthAuditService | undefined,
        clientInfoService: ClientInfoService | undefined,
      ) => {
        return new SMSMFAProviderService(
          mfaDeviceRepository,
          userRepository,
          config,
          logger,
          passwordService,
          phoneVerificationService,
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
        { token: PhoneVerificationService, optional: true },
        { token: 'ChallengeService', optional: true },
        { token: InternalAuthAuditService, optional: true },
        { token: ClientInfoService, optional: true },
      ],
    },

    // Bind to shared discovery token (registration is performed by AuthModule at app bootstrap)
    {
      provide: NAUTH_MFA_PROVIDER_TOKEN,
      useExisting: SMSMFAProviderService,
    },
  ],
  exports: [SMSMFAProviderService],
})
export class SMSMFAModule {}
