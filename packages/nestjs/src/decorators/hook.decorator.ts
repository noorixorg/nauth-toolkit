/**
 * NestJS Hook Decorators
 *
 * These decorators provide a declarative way to register authentication lifecycle hooks in NestJS applications.
 * Classes decorated with @PreSignupHook or @AfterSignupHook will be automatically registered with the HookRegistryService
 * when the module is initialized.
 *
 * @example
 * ```typescript
 * import { Injectable } from '@nestjs/common';
 * import { PreSignupHook } from '@nauth-toolkit/nestjs';
 * import { IPreSignupHookProvider, NAuthException, AuthErrorCode } from '@nauth-toolkit/core';
 *
 * @Injectable()
 * @PreSignupHook({ priority: 1 })
 * export class DomainValidationHook implements IPreSignupHookProvider {
 *   async execute(userData, signupMethod, providerId, adminSignup) {
 *     const domain = userData.email.split('@')[1];
 *     if (domain === 'blocked.com') {
 *       throw new NAuthException(AuthErrorCode.PRESIGNUP_FAILED, 'Domain not allowed');
 *     }
 *   }
 * }
 * ```
 */

import { SetMetadata } from '@nestjs/common';

export const HOOK_METADATA_KEY = 'nauth:hook';

/**
 * Hook types supported by NAuth
 */
export type HookType = 'preSignup' | 'afterSignup';

/**
 * Metadata stored on hook provider classes
 */
export interface HookMetadata {
  type: HookType;
  priority?: number;
}

/**
 * Options for hook decorators
 */
export interface HookDecoratorOptions {
  /**
   * Execution priority (lower numbers execute first)
   * Default: 100
   */
  priority?: number;
}

/**
 * Marks a provider as a pre-signup hook
 *
 * Pre-signup hooks are executed before a user account is created, allowing you to:
 * - Validate user data against business rules
 * - Block signups based on domain, IP, or other criteria
 * - Enrich user data before storage
 *
 * Hooks can block signup by throwing NAuthException with AuthErrorCode.PRESIGNUP_FAILED
 *
 * @param options - Hook configuration options
 *
 * @example
 * ```typescript
 * @Injectable()
 * @PreSignupHook({ priority: 1 })
 * export class DomainValidationHook implements IPreSignupHookProvider {
 *   async execute(userData, signupMethod, providerId, adminSignup) {
 *     const allowedDomains = ['company.com', 'partner.com'];
 *     const domain = userData.email.split('@')[1];
 *
 *     if (!allowedDomains.includes(domain)) {
 *       throw new NAuthException(
 *         AuthErrorCode.PRESIGNUP_FAILED,
 *         `Email domain ${domain} is not allowed`
 *       );
 *     }
 *   }
 * }
 * ```
 */
export function PreSignupHook(options: HookDecoratorOptions = {}): ClassDecorator {
  const metadata: HookMetadata = {
    type: 'preSignup',
    priority: options.priority ?? 100,
  };
  return SetMetadata(HOOK_METADATA_KEY, metadata);
}

/**
 * Marks a provider as an after-signup hook
 *
 * After-signup hooks are executed after a user account is successfully created, allowing you to:
 * - Send welcome emails or notifications
 * - Sync user data to external systems
 * - Trigger analytics events
 * - Assign default roles or permissions
 *
 * These hooks cannot block signup (user is already created) but errors are logged and can be
 * handled by your application.
 *
 * @param options - Hook configuration options
 *
 * @example
 * ```typescript
 * @Injectable()
 * @AfterSignupHook({ priority: 1 })
 * export class WelcomeEmailHook implements IAfterSignupHookProvider {
 *   constructor(private readonly emailService: EmailService) {}
 *
 *   async execute(user, metadata) {
 *     await this.emailService.sendWelcomeEmail({
 *       to: user.email,
 *       firstName: user.firstName,
 *       signupMethod: metadata.signupMethod,
 *     });
 *   }
 * }
 * ```
 */
export function AfterSignupHook(options: HookDecoratorOptions = {}): ClassDecorator {
  const metadata: HookMetadata = {
    type: 'afterSignup',
    priority: options.priority ?? 100,
  };
  return SetMetadata(HOOK_METADATA_KEY, metadata);
}
