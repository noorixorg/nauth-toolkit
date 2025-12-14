import { Module, OnModuleInit } from '@nestjs/common';
import { EmailMFAProviderService } from '../src/email-mfa-provider.service';
// Public API imports
import { MFAService, NAuthConfig, NAuthLogger, EmailVerificationService, ClientInfoService } from '@nauth-toolkit/core';
// Internal API imports (for provider implementations)
import { PasswordService, AuthAuditService as InternalAuthAuditService } from '@nauth-toolkit/core/internal';
import { Repository } from 'typeorm';
import { BaseMFADevice, BaseUser } from '@nauth-toolkit/core';

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
        challengeService: any, // ChallengeService from core
        auditService: any, // AuthAuditService from core
        clientInfoService: any, // ClientInfoService from core
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
  ],
  exports: [EmailMFAProviderService],
})
export class EmailMFAModule implements OnModuleInit {
  constructor(
    private readonly emailMFAProvider: EmailMFAProviderService,
    private readonly mfaService: MFAService,
  ) {}

  /**
   * Auto-register Email provider with MFAService
   */
  onModuleInit(): void {
    if (!this.mfaService) {
      throw new Error('MFAService is not available. Ensure AuthModule.forRoot() is imported before EmailMFAModule.');
    }
    this.mfaService.registerProvider(this.emailMFAProvider);
  }
}
