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

import {
  IPreSignupHookProvider,
  IPostSignupHookProvider,
  SignupMetadata,
  PreSignupHookData,
  IUserProfileUpdatedHook,
  UserProfileUpdatedMetadata,
} from '../interfaces/hooks.interface';
import { IUser } from '../interfaces/entities.interface';
import { LoggerProvider } from '../interfaces/logger.interface';
import { NAuthException } from '../exceptions/nauth.exception';
import { AuthErrorCode } from '../enums/error-codes.enum';

/**
 * Hook Registry Service
 *
 * Manages registration and execution of lifecycle hooks for authentication flows.
 */
export class HookRegistryService {
  private readonly preSignupHooks: IPreSignupHookProvider[] = [];
  private readonly postSignupHooks: IPostSignupHookProvider[] = [];
  private readonly userProfileUpdatedHooks: IUserProfileUpdatedHook[] = [];

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
   */
  registerPreSignup(provider: IPreSignupHookProvider): void {
    this.preSignupHooks.push(provider);
    this.logger?.debug?.(`[HookRegistry] Registered preSignup hook: ${provider.constructor.name}`);
  }

  /**
   * Register a post-signup hook provider
   *
   * Hooks are executed in registration order.
   * Hook errors are logged but do not block signup (non-blocking).
   *
   * @param provider - Post-signup hook provider instance
   */
  registerPostSignup(provider: IPostSignupHookProvider): void {
    this.postSignupHooks.push(provider);
    this.logger?.debug?.(`[HookRegistry] Registered postSignup hook: ${provider.constructor.name}`);
  }

  /**
   * Register a user profile updated hook
   *
   * Hooks are executed in registration order.
   * Hook errors are logged but do not block profile updates (non-blocking).
   *
   * @param provider - User profile updated hook instance
   */
  registerUserProfileUpdated(provider: IUserProfileUpdatedHook): void {
    this.userProfileUpdatedHooks.push(provider);
    this.logger?.debug?.(`[HookRegistry] Registered userProfileUpdated hook: ${provider.constructor.name}`);
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
   * @param signupType - Type of signup ('password' or 'social')
   * @param provider - Social provider name (only for social signups, e.g., 'google', 'apple', 'facebook')
   * @param adminSignup - true for admin signups, false for regular signups
   * @throws {NAuthException} with PRESIGNUP_FAILED if any hook blocks signup
   *
   * @internal
   * @remarks This method is called internally by AuthService and BaseSocialAuthProviderService
   */
  async executePreSignup(
    data: PreSignupHookData,
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
   * Execute all registered post-signup hooks
   *
   * Hooks are executed sequentially in registration order.
   * Hook errors are logged but do not stop execution (non-blocking).
   *
   * @param user - Created user entity (IUser interface)
   * @param metadata - Signup metadata providing context about the signup event
   *
   * @internal
   * @remarks This method is called internally by AuthService and BaseSocialAuthProviderService
   */
  async executePostSignup(user: IUser, metadata?: SignupMetadata): Promise<void> {
    if (this.postSignupHooks.length === 0) {
      return; // No hooks registered
    }

    for (const hook of this.postSignupHooks) {
      try {
        await hook.execute(user, metadata);
      } catch (hookError: unknown) {
        // Non-blocking: log error and continue
        const errorMessage = hookError instanceof Error ? hookError.message : 'Unknown error';
        this.logger?.error?.(
          `[HookRegistry] postSignup hook error: ${hook.constructor.name} - ${errorMessage}`,
          hookError instanceof Error ? { error: hookError } : undefined,
        );
      }
    }
  }

  /**
   * Execute all registered user profile updated hooks
   *
   * Hooks are executed sequentially in registration order.
   * Hook errors are logged but do not stop execution (non-blocking).
   *
   * @param metadata - Profile update context with user, changed fields, and update source
   *
   * @internal
   * @remarks This method is called internally by AuthService, EmailVerificationService, and PhoneVerificationService
   */
  async executeUserProfileUpdated(metadata: UserProfileUpdatedMetadata): Promise<void> {
    if (this.userProfileUpdatedHooks.length === 0) {
      return; // No hooks registered
    }

    for (const hook of this.userProfileUpdatedHooks) {
      try {
        await hook.execute(metadata);
      } catch (hookError: unknown) {
        // Non-blocking: log error and continue
        const errorMessage = hookError instanceof Error ? hookError.message : 'Unknown error';
        this.logger?.error?.(
          `[HookRegistry] userProfileUpdated hook error: ${hook.constructor.name} - ${errorMessage}`,
          hookError instanceof Error ? { error: hookError } : undefined,
        );
      }
    }
  }
}
