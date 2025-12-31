/**
 * Hook Registry Service
 *
 * Central registry for managing and executing lifecycle hooks.
 * Provides a provider-based approach to extending authentication flows.
 *
 * @remarks
 * Hooks are registered after NAuth initialization when dependencies are ready.
 * This follows the same pattern as MFA and Social providers.
 *
 * @packageDocumentation
 */

import { IPreSignupHookProvider, IAfterSignupHookProvider, SignupMetadata } from '../interfaces/hooks.interface';
import { LoggerProvider } from '../interfaces/logger.interface';
import { NAuthException } from '../exceptions/nauth.exception';
import { AuthErrorCode } from '../enums/error-codes.enum';

/**
 * Hook Registry Service
 *
 * Manages registration and execution of lifecycle hooks for authentication flows.
 *
 * @example NestJS usage
 * ```typescript
 * @Module({
 *   imports: [AuthModule.forRoot(authConfig)],
 *   providers: [InviteOnlyHook, WelcomeEmailHook],
 * })
 * export class AppModule {
 *   constructor(
 *     private readonly hookRegistry: HookRegistryService,
 *     private readonly inviteHook: InviteOnlyHook,
 *     private readonly welcomeHook: WelcomeEmailHook,
 *   ) {
 *     this.hookRegistry.registerPreSignup(this.inviteHook);
 *     this.hookRegistry.registerAfterSignup(this.welcomeHook);
 *   }
 * }
 * ```
 *
 * @example Express usage
 * ```typescript
 * const nauth = await NAuth.create({ config, dataSource, adapter });
 *
 * const inviteHook = new InviteOnlyHook(invitationService);
 * nauth.hookRegistry.registerPreSignup(inviteHook);
 *
 * const welcomeHook = new WelcomeEmailHook(emailService);
 * nauth.hookRegistry.registerAfterSignup(welcomeHook);
 * ```
 *
 * @example Fastify usage
 * ```typescript
 * const nauth = await NAuth.create({ config, dataSource, adapter });
 *
 * const inviteHook = new InviteOnlyHook(invitationService);
 * nauth.hookRegistry.registerPreSignup(inviteHook);
 *
 * const welcomeHook = new WelcomeEmailHook(emailService);
 * nauth.hookRegistry.registerAfterSignup(welcomeHook);
 * ```
 */
export class HookRegistryService {
  private readonly preSignupHooks: IPreSignupHookProvider[] = [];
  private readonly afterSignupHooks: IAfterSignupHookProvider[] = [];

  constructor(private readonly logger?: LoggerProvider) {}

  // ============================================================================
  // Registration Methods
  // ============================================================================

  /**
   * Register a pre-signup hook provider
   *
   * Hooks are executed in registration order.
   * First hook to throw PRESIGNUP_FAILED will block signup.
   *
   * @param provider - Pre-signup hook provider instance
   *
   * @example
   * ```typescript
   * const inviteHook = new InviteOnlyHook(invitationService);
   * hookRegistry.registerPreSignup(inviteHook);
   * ```
   */
  registerPreSignup(provider: IPreSignupHookProvider): void {
    this.preSignupHooks.push(provider);
    this.logger?.debug?.(`[HookRegistry] Registered preSignup hook: ${provider.constructor.name}`);
  }

  /**
   * Register an after-signup hook provider
   *
   * Hooks are executed in registration order.
   * Hook errors are logged but do not block signup (non-blocking).
   *
   * @param provider - After-signup hook provider instance
   *
   * @example
   * ```typescript
   * const welcomeHook = new WelcomeEmailHook(emailService);
   * hookRegistry.registerAfterSignup(welcomeHook);
   * ```
   */
  registerAfterSignup(provider: IAfterSignupHookProvider): void {
    this.afterSignupHooks.push(provider);
    this.logger?.debug?.(`[HookRegistry] Registered afterSignup hook: ${provider.constructor.name}`);
  }

  // ============================================================================
  // Execution Methods
  // ============================================================================

  /**
   * Execute all registered pre-signup hooks
   *
   * Hooks are executed sequentially in registration order.
   * First hook to throw PRESIGNUP_FAILED will stop execution and block signup.
   *
   * @param data - SignupDTO for password signup, OAuthUserProfile for social signup
   * @param signupType - Type of signup
   * @param provider - Social provider name (only for social signups)
   * @param adminSignup - true for admin signups, false for regular signups
   * @throws {NAuthException} with PRESIGNUP_FAILED if any hook blocks signup
   *
   * @internal
   * @remarks This method is called internally by AuthService and BaseSocialAuthProviderService
   */
  async executePreSignup(
    data: unknown,
    signupType: 'password' | 'social',
    provider?: string,
    adminSignup?: boolean,
  ): Promise<void> {
    if (this.preSignupHooks.length === 0) {
      return; // No hooks registered
    }

    for (const hook of this.preSignupHooks) {
      try {
        await hook.execute(data, signupType, provider, adminSignup);
      } catch (hookError: unknown) {
        // If hook throws NAuthException with PRESIGNUP_FAILED, re-throw as-is
        if (hookError instanceof NAuthException && hookError.code === AuthErrorCode.PRESIGNUP_FAILED) {
          this.logger?.warn?.(
            `[HookRegistry] preSignup hook blocked signup: ${hook.constructor.name} - ${hookError.message}`,
          );
          throw hookError;
        }

        // For other errors, wrap in PRESIGNUP_FAILED
        const errorMessage = hookError instanceof Error ? hookError.message : 'Pre-signup validation failed';
        this.logger?.error?.(
          `[HookRegistry] preSignup hook error: ${hook.constructor.name} - ${errorMessage}`,
          hookError instanceof Error ? { error: hookError } : undefined,
        );
        throw new NAuthException(AuthErrorCode.PRESIGNUP_FAILED, errorMessage);
      }
    }
  }

  /**
   * Execute all registered after-signup hooks
   *
   * Hooks are executed sequentially in registration order.
   * Hook errors are logged but do not stop execution (non-blocking).
   *
   * @param user - Created user entity (framework-agnostic: TypeORM/Prisma/Mongoose/etc.)
   * @param metadata - Signup metadata
   *
   * @internal
   * @remarks This method is called internally by AuthService and BaseSocialAuthProviderService
   */
  async executeAfterSignup(user: unknown, metadata?: SignupMetadata): Promise<void> {
    if (this.afterSignupHooks.length === 0) {
      return; // No hooks registered
    }

    for (const hook of this.afterSignupHooks) {
      try {
        await hook.execute(user, metadata);
      } catch (hookError: unknown) {
        // Non-blocking: log error and continue
        const errorMessage = hookError instanceof Error ? hookError.message : 'Unknown error';
        this.logger?.error?.(
          `[HookRegistry] afterSignup hook error: ${hook.constructor.name} - ${errorMessage}`,
          hookError instanceof Error ? { error: hookError } : undefined,
        );
      }
    }
  }
}
