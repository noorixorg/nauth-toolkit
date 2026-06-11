import { Module } from '@nestjs/common';
import { EmailMFAProviderService } from '../src/email-mfa-provider.service';
import { Repository } from 'typeorm';
// Public API imports
import {
  NAuthConfig,
  NAuthLogger,
  EmailVerificationService,
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
 * Email MFA Module (NestJS Adapter)
 *
 * Provides Email-based MFA functionality.
 * Auto-registers with MFAService when imported.
 *
 * Requires EmailVerificationService from @nauth-toolkit/core,
 * which is available when an email provider is configured.
 *
 * @example
 * ```typescript
 * @Module({
 *   imports: [
 *     AuthModule.forRoot(config), // Must have email provider configured
 *     EmailMFAModule, // Auto-registers Email provider
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
@Module({
  providers: [
    // Email MFA Provider Service (factory provider)
    {
      provide: EmailMFAProviderService,
      useFactory: (
        mfaDeviceRepository: Repository<BaseMFADevice>,
        userRepository: Repository<BaseUser>,
        config: NAuthConfig,
        logger: NAuthLogger,
        passwordService: PasswordService,
        emailVerificationService: EmailVerificationService | undefined,
        challengeService: ChallengeService | undefined,
        auditService: InternalAuthAuditService | undefined,
        clientInfoService: ClientInfoService | undefined,
      ) => {
        return new EmailMFAProviderService(
          mfaDeviceRepository,
          userRepository,
          config,
          logger,
          passwordService,
          emailVerificationService,
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
        { token: EmailVerificationService, optional: true },
        { token: 'ChallengeService', optional: true },
        { token: InternalAuthAuditService, optional: true },
        { token: ClientInfoService, optional: true },
      ],
    },

    // Bind to shared discovery token (registration is performed by AuthModule at app bootstrap)
    {
      provide: NAUTH_MFA_PROVIDER_TOKEN,
      useExisting: EmailMFAProviderService,
    },
  ],
  exports: [EmailMFAProviderService],
})
export class EmailMFAModule {}
