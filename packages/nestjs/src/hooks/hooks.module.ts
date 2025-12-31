/**
 * NAuth Hook Registration Module
 *
 * This module automatically discovers and registers hooks decorated with @PreSignupHook or @AfterSignupHook
 * with the HookRegistryService. It should be imported after NAuthModule in your application.
 *
 * @example
 * ```typescript
 * import { Module } from '@nestjs/common';
 * import { NAuthModule } from '@nauth-toolkit/nestjs';
 * import { NAuthHooksModule } from '@nauth-toolkit/nestjs';
 * import { DomainValidationHook } from './hooks/domain-validation.hook';
 * import { WelcomeEmailHook } from './hooks/welcome-email.hook';
 *
 * @Module({
 *   imports: [
 *     NAuthModule.forRoot({ ... }),
 *     NAuthHooksModule.forFeature([
 *       DomainValidationHook,
 *       WelcomeEmailHook,
 *     ]),
 *   ],
 * })
 * export class AppModule {}
 * ```
 */

import { Module, DynamicModule, OnModuleInit, Type, Inject } from '@nestjs/common';
import { ModuleRef, Reflector } from '@nestjs/core';
import { HookRegistryService, IPreSignupHookProvider, IAfterSignupHookProvider } from '@nauth-toolkit/core';
import { HOOK_METADATA_KEY, HookMetadata } from '../decorators/hook.decorator';

/**
 * Module for automatic hook registration
 *
 * This module scans provided hook classes for decorator metadata and automatically
 * registers them with the HookRegistryService.
 */
@Module({})
export class NAuthHooksModule implements OnModuleInit {
  constructor(
    @Inject('NAUTH_HOOKS') private readonly hookClasses: Type<any>[],
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
        hookRegistry.registerPreSignup(hookInstance as IPreSignupHookProvider);
      } else if (metadata.type === 'afterSignup') {
        hookRegistry.registerAfterSignup(hookInstance as IAfterSignupHookProvider);
      }
    }
  }

  /**
   * Register hooks for a feature module
   *
   * @param hooks - Array of hook provider classes decorated with @PreSignupHook or @AfterSignupHook
   * @returns Dynamic module configuration
   *
   * @example
   * ```typescript
   * @Module({
   *   imports: [
   *     NAuthHooksModule.forFeature([
   *       DomainValidationHook,
   *       WelcomeEmailHook,
   *     ]),
   *   ],
   * })
   * export class AuthModule {}
   * ```
   */
  static forFeature(hooks: Type<any>[]): DynamicModule {
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
