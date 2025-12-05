import { Module, OnModuleInit } from '@nestjs/common';
import { SMSMFAProviderService } from '../src/sms-mfa-provider.service';
// Public API imports
import { MFAService, NAuthConfig, NAuthLogger, PhoneVerificationService } from '@nauth-toolkit/core';
// Internal API imports (for provider implementations)
import { PasswordService } from '@nauth-toolkit/core/internal';
import { Repository } from 'typeorm';
import { BaseMFADevice, BaseUser } from '@nauth-toolkit/core';

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
        challengeService: any, // ChallengeService from core
        auditService: any, // AuthAuditService from core
        clientInfoService: any, // ClientInfoService from core
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
        { token: 'AuthAuditService', optional: true },
        { token: 'ClientInfoService', optional: true },
      ],
    },
  ],
  exports: [SMSMFAProviderService],
})
export class SMSMFAModule implements OnModuleInit {
  constructor(
    private readonly smsMFAProvider: SMSMFAProviderService,
    private readonly mfaService: MFAService,
  ) {}

  /**
   * Auto-register SMS provider with MFAService
   */
  onModuleInit(): void {
    if (!this.mfaService) {
      throw new Error('MFAService is not available. Ensure AuthModule.forRoot() is imported before SMSMFAModule.');
    }
    this.mfaService.registerProvider(this.smsMFAProvider);
  }
}
