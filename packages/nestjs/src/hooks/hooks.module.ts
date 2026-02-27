/**
 * NAuth Hook Registration Module
 *
 * This module automatically discovers and registers hooks decorated with hook decorators
 * with the HookRegistryService. It should be imported after NAuthModule in your application.
 *
 * @example
 * ```typescript
 * import { Module } from '@nestjs/common';
 * import { NAuthModule } from '@nauth-toolkit/nestjs';
 * import { NAuthHooksModule } from '@nauth-toolkit/nestjs';
 * import { DomainValidationHook } from './hooks/domain-validation.hook';
 * import { WelcomeEmailHook } from './hooks/welcome-email.hook';
 * import { PasswordChangedNotificationHook } from './hooks/password-changed.hook';
 *
 * @Module({
 *   imports: [
 *     NAuthModule.forRoot({ ... }),
 *     NAuthHooksModule.forFeature([
 *       DomainValidationHook,
 *       WelcomeEmailHook,
 *       PasswordChangedNotificationHook,
 *     ]),
 *   ],
 * })
 * export class AppModule {}
 * ```
 */

import { Module, DynamicModule, OnModuleInit, Type, Inject } from '@nestjs/common';
import { ModuleRef, Reflector } from '@nestjs/core';
import {
  HookRegistryService,
  IPreSignupHookProvider,
  IPostSignupHookProvider,
  IUserProfileUpdatedHook,
  IPasswordChangedHook,
  IMFADeviceRemovedHook,
  IAdaptiveMFARiskDetectedHook,
  IAccountStatusChangedHook,
  IEmailChangedHook,
  IAccountLockedHook,
  ISessionsRevokedHook,
  IMFAFirstEnabledHook,
} from '@nauth-toolkit/core';
import { HOOK_METADATA_KEY, HookMetadata } from '../decorators/hook.decorator';

/**
 * Union type for all hook provider classes
 */
type HookProviderClass =
  | Type<IPreSignupHookProvider>
  | Type<IPostSignupHookProvider>
  | Type<IUserProfileUpdatedHook>
  | Type<IPasswordChangedHook>
  | Type<IMFADeviceRemovedHook>
  | Type<IAdaptiveMFARiskDetectedHook>
  | Type<IAccountStatusChangedHook>
  | Type<IEmailChangedHook>
  | Type<IAccountLockedHook>
  | Type<ISessionsRevokedHook>
  | Type<IMFAFirstEnabledHook>;

/**
 * Module for automatic hook registration
 *
 * This module scans provided hook classes for decorator metadata and automatically
 * registers them with the HookRegistryService.
 */
@Module({})
export class NAuthHooksModule implements OnModuleInit {
  constructor(
    @Inject('NAUTH_HOOKS') private readonly hookClasses: HookProviderClass[],
    private readonly moduleRef: ModuleRef,
    private readonly reflector: Reflector,
  ) {}

  /**
   * Initialize the module and register all decorated hooks
   */
  async onModuleInit(): Promise<void> {
    // Get HookRegistryService from the module ref (provided by AuthModule)
    const hookRegistry = this.moduleRef.get(HookRegistryService, { strict: false });

    if (!hookRegistry) {
      throw new Error(
        'HookRegistryService not found. Make sure AuthModule.forRoot() is imported before NAuthHooksModule.forFeature()',
      );
    }

    for (const hookClass of this.hookClasses) {
      const metadata = this.reflector.get<HookMetadata>(HOOK_METADATA_KEY, hookClass);

      if (!metadata) {
        // No hook metadata found - skip this class
        continue;
      }

      // Get the instance from NestJS DI container
      const hookInstance = this.moduleRef.get(hookClass, { strict: false });

      // Register based on hook type
      if (metadata.type === 'preSignup') {
        hookRegistry.registerPreSignup(hookInstance as unknown as IPreSignupHookProvider);
      } else if (metadata.type === 'postSignup') {
        hookRegistry.registerPostSignup(hookInstance as unknown as IPostSignupHookProvider);
      } else if (metadata.type === 'userProfileUpdated') {
        hookRegistry.registerUserProfileUpdated(hookInstance as unknown as IUserProfileUpdatedHook);
      } else if (metadata.type === 'passwordChanged') {
        hookRegistry.registerPasswordChanged(hookInstance as unknown as IPasswordChangedHook);
      } else if (metadata.type === 'mfaDeviceRemoved') {
        hookRegistry.registerMFADeviceRemoved(hookInstance as unknown as IMFADeviceRemovedHook);
      } else if (metadata.type === 'adaptiveMfaRiskDetected') {
        hookRegistry.registerAdaptiveMFARiskDetected(hookInstance as unknown as IAdaptiveMFARiskDetectedHook);
      } else if (metadata.type === 'accountStatusChanged') {
        hookRegistry.registerAccountStatusChanged(hookInstance as unknown as IAccountStatusChangedHook);
      } else if (metadata.type === 'emailChanged') {
        hookRegistry.registerEmailChanged(hookInstance as unknown as IEmailChangedHook);
      } else if (metadata.type === 'accountLocked') {
        hookRegistry.registerAccountLocked(hookInstance as unknown as IAccountLockedHook);
      } else if (metadata.type === 'sessionsRevoked') {
        hookRegistry.registerSessionsRevoked(hookInstance as unknown as ISessionsRevokedHook);
      } else if (metadata.type === 'mfaFirstEnabled') {
        hookRegistry.registerMFAFirstEnabled(hookInstance as unknown as IMFAFirstEnabledHook);
      }
    }
  }

  /**
   * Register hooks for a feature module
   *
   * @param hooks - Array of hook provider classes decorated with hook decorators
   * @returns Dynamic module configuration
   *
   * @example
   * ```typescript
   * @Module({
   *   imports: [
   *     NAuthHooksModule.forFeature([
   *       DomainValidationHook,
   *       WelcomeEmailHook,
   *       PasswordChangedNotificationHook,
   *     ]),
   *   ],
   * })
   * export class AuthModule {}
   * ```
   */
  static forFeature(hooks: HookProviderClass[]): DynamicModule {
    return {
      module: NAuthHooksModule,
      imports: [], // AuthModule must be imported before this module in the consumer's module
      providers: [
        ...hooks,
        {
          provide: 'NAUTH_HOOKS',
          useValue: hooks,
        },
      ],
      exports: hooks,
    };
  }
}
