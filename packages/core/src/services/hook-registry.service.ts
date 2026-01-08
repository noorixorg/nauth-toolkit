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
  IPasswordChangedHook,
  PasswordChangedMetadata,
  IMFADeviceRemovedHook,
  MFADeviceRemovedMetadata,
  IAdaptiveMFARiskDetectedHook,
  AdaptiveMFARiskDetectedMetadata,
  IAccountStatusChangedHook,
  AccountStatusChangedMetadata,
  IEmailChangedHook,
  EmailChangedMetadata,
  IAccountLockedHook,
  AccountLockedMetadata,
  ISessionsRevokedHook,
  SessionsRevokedMetadata,
  IMFAFirstEnabledHook,
  MFAFirstEnabledMetadata,
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
  private readonly passwordChangedHooks: IPasswordChangedHook[] = [];
  private readonly mfaDeviceRemovedHooks: IMFADeviceRemovedHook[] = [];
  private readonly adaptiveMFARiskDetectedHooks: IAdaptiveMFARiskDetectedHook[] = [];
  private readonly accountStatusChangedHooks: IAccountStatusChangedHook[] = [];
  private readonly emailChangedHooks: IEmailChangedHook[] = [];
  private readonly accountLockedHooks: IAccountLockedHook[] = [];
  private readonly sessionsRevokedHooks: ISessionsRevokedHook[] = [];
  private readonly mfaFirstEnabledHooks: IMFAFirstEnabledHook[] = [];

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

  /**
   * Register a password changed hook
   *
   * Hooks are executed in registration order.
   * Hook errors are logged but do not block password changes (non-blocking).
   *
   * @param provider - Password changed hook instance
   */
  registerPasswordChanged(provider: IPasswordChangedHook): void {
    this.passwordChangedHooks.push(provider);
    this.logger?.debug?.(`[HookRegistry] Registered passwordChanged hook: ${provider.constructor.name}`);
  }

  /**
   * Register an MFA device removed hook
   *
   * Hooks are executed in registration order.
   * Hook errors are logged but do not block device removal (non-blocking).
   *
   * @param provider - MFA device removed hook instance
   */
  registerMFADeviceRemoved(provider: IMFADeviceRemovedHook): void {
    this.mfaDeviceRemovedHooks.push(provider);
    this.logger?.debug?.(`[HookRegistry] Registered mfaDeviceRemoved hook: ${provider.constructor.name}`);
  }

  /**
   * Register an adaptive MFA risk detected hook
   *
   * Hooks are executed in registration order.
   * Hook errors are logged but do not block authentication (non-blocking).
   *
   * @param provider - Adaptive MFA risk detected hook instance
   */
  registerAdaptiveMFARiskDetected(provider: IAdaptiveMFARiskDetectedHook): void {
    this.adaptiveMFARiskDetectedHooks.push(provider);
    this.logger?.debug?.(`[HookRegistry] Registered adaptiveMFARiskDetected hook: ${provider.constructor.name}`);
  }

  /**
   * Register an account status changed hook
   *
   * Hooks are executed in registration order.
   * Hook errors are logged but do not block status changes (non-blocking).
   *
   * @param provider - Account status changed hook instance
   */
  registerAccountStatusChanged(provider: IAccountStatusChangedHook): void {
    this.accountStatusChangedHooks.push(provider);
    this.logger?.debug?.(`[HookRegistry] Registered accountStatusChanged hook: ${provider.constructor.name}`);
  }

  /**
   * Register an email changed hook
   *
   * Hooks are executed in registration order.
   * Hook errors are logged but do not block email changes (non-blocking).
   *
   * @param provider - Email changed hook instance
   */
  registerEmailChanged(provider: IEmailChangedHook): void {
    this.emailChangedHooks.push(provider);
    this.logger?.debug?.(`[HookRegistry] Registered emailChanged hook: ${provider.constructor.name}`);
  }

  /**
   * Register an account locked hook
   *
   * Hooks are executed in registration order.
   * Hook errors are logged but do not block lockout (non-blocking).
   *
   * @param provider - Account locked hook instance
   */
  registerAccountLocked(provider: IAccountLockedHook): void {
    this.accountLockedHooks.push(provider);
    this.logger?.debug?.(`[HookRegistry] Registered accountLocked hook: ${provider.constructor.name}`);
  }

  /**
   * Register a sessions revoked hook
   *
   * Hooks are executed in registration order.
   * Hook errors are logged but do not block session revocation (non-blocking).
   *
   * @param provider - Sessions revoked hook instance
   */
  registerSessionsRevoked(provider: ISessionsRevokedHook): void {
    this.sessionsRevokedHooks.push(provider);
    this.logger?.debug?.(`[HookRegistry] Registered sessionsRevoked hook: ${provider.constructor.name}`);
  }

  /**
   * Register an MFA first enabled hook
   *
   * Hooks are executed in registration order.
   * Hook errors are logged but do not block MFA enrollment (non-blocking).
   *
   * @param provider - MFA first enabled hook instance
   */
  registerMFAFirstEnabled(provider: IMFAFirstEnabledHook): void {
    this.mfaFirstEnabledHooks.push(provider);
    this.logger?.debug?.(`[HookRegistry] Registered mfaFirstEnabled hook: ${provider.constructor.name}`);
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

  /**
   * Execute all registered password changed hooks
   *
   * Hooks are executed sequentially in registration order.
   * Hook errors are logged but do not stop execution (non-blocking).
   *
   * @param metadata - Password change context with user and change details
   *
   * @internal
   * @remarks This method is called internally by AuthServiceInternalHelpers
   */
  async executePasswordChanged(metadata: PasswordChangedMetadata): Promise<void> {
    if (this.passwordChangedHooks.length === 0) {
      return; // No hooks registered
    }

    for (const hook of this.passwordChangedHooks) {
      try {
        await hook.execute(metadata);
      } catch (hookError: unknown) {
        // Non-blocking: log error and continue
        const errorMessage = hookError instanceof Error ? hookError.message : 'Unknown error';
        this.logger?.error?.(
          `[HookRegistry] passwordChanged hook error: ${hook.constructor.name} - ${errorMessage}`,
          hookError instanceof Error ? { error: hookError } : undefined,
        );
      }
    }
  }

  /**
   * Execute all registered MFA device removed hooks
   *
   * Hooks are executed sequentially in registration order.
   * Hook errors are logged but do not stop execution (non-blocking).
   *
   * @param metadata - Device removal context with user and device details
   *
   * @internal
   * @remarks This method is called internally by UserService and MFAService
   */
  async executeMFADeviceRemoved(metadata: MFADeviceRemovedMetadata): Promise<void> {
    if (this.mfaDeviceRemovedHooks.length === 0) {
      return; // No hooks registered
    }

    for (const hook of this.mfaDeviceRemovedHooks) {
      try {
        await hook.execute(metadata);
      } catch (hookError: unknown) {
        // Non-blocking: log error and continue
        const errorMessage = hookError instanceof Error ? hookError.message : 'Unknown error';
        this.logger?.error?.(
          `[HookRegistry] mfaDeviceRemoved hook error: ${hook.constructor.name} - ${errorMessage}`,
          hookError instanceof Error ? { error: hookError } : undefined,
        );
      }
    }
  }

  /**
   * Execute all registered adaptive MFA risk detected hooks
   *
   * Hooks are executed sequentially in registration order.
   * Hook errors are logged but do not stop execution (non-blocking).
   *
   * @param metadata - Risk evaluation context with user and risk details
   *
   * @internal
   * @remarks This method is called internally by AdaptiveMFADecisionService
   */
  async executeAdaptiveMFARiskDetected(metadata: AdaptiveMFARiskDetectedMetadata): Promise<void> {
    if (this.adaptiveMFARiskDetectedHooks.length === 0) {
      return; // No hooks registered
    }

    for (const hook of this.adaptiveMFARiskDetectedHooks) {
      try {
        await hook.execute(metadata);
      } catch (hookError: unknown) {
        // Non-blocking: log error and continue
        const errorMessage = hookError instanceof Error ? hookError.message : 'Unknown error';
        this.logger?.error?.(
          `[HookRegistry] adaptiveMFARiskDetected hook error: ${hook.constructor.name} - ${errorMessage}`,
          hookError instanceof Error ? { error: hookError } : undefined,
        );
      }
    }
  }

  /**
   * Execute all registered account status changed hooks
   *
   * Hooks are executed sequentially in registration order.
   * Hook errors are logged but do not stop execution (non-blocking).
   *
   * @param metadata - Status change context with user and change details
   *
   * @internal
   * @remarks This method is called internally by UserService
   */
  async executeAccountStatusChanged(metadata: AccountStatusChangedMetadata): Promise<void> {
    if (this.accountStatusChangedHooks.length === 0) {
      return; // No hooks registered
    }

    for (const hook of this.accountStatusChangedHooks) {
      try {
        await hook.execute(metadata);
      } catch (hookError: unknown) {
        // Non-blocking: log error and continue
        const errorMessage = hookError instanceof Error ? hookError.message : 'Unknown error';
        this.logger?.error?.(
          `[HookRegistry] accountStatusChanged hook error: ${hook.constructor.name} - ${errorMessage}`,
          hookError instanceof Error ? { error: hookError } : undefined,
        );
      }
    }
  }

  /**
   * Execute all registered email changed hooks
   *
   * Hooks are executed sequentially in registration order.
   * Hook errors are logged but do not stop execution (non-blocking).
   *
   * @param metadata - Email change context with old and new addresses
   *
   * @internal
   * @remarks This method is called internally by UserService
   */
  async executeEmailChanged(metadata: EmailChangedMetadata): Promise<void> {
    if (this.emailChangedHooks.length === 0) {
      return; // No hooks registered
    }

    for (const hook of this.emailChangedHooks) {
      try {
        await hook.execute(metadata);
      } catch (hookError: unknown) {
        // Non-blocking: log error and continue
        const errorMessage = hookError instanceof Error ? hookError.message : 'Unknown error';
        this.logger?.error?.(
          `[HookRegistry] emailChanged hook error: ${hook.constructor.name} - ${errorMessage}`,
          hookError instanceof Error ? { error: hookError } : undefined,
        );
      }
    }
  }

  /**
   * Execute all registered account locked hooks
   *
   * Hooks are executed sequentially in registration order.
   * Hook errors are logged but do not stop execution (non-blocking).
   *
   * @param metadata - Lockout context with user and lock details
   *
   * @internal
   * @remarks This method is called internally by AuthServiceInternalHelpers
   */
  async executeAccountLocked(metadata: AccountLockedMetadata): Promise<void> {
    if (this.accountLockedHooks.length === 0) {
      return; // No hooks registered
    }

    for (const hook of this.accountLockedHooks) {
      try {
        await hook.execute(metadata);
      } catch (hookError: unknown) {
        // Non-blocking: log error and continue
        const errorMessage = hookError instanceof Error ? hookError.message : 'Unknown error';
        this.logger?.error?.(
          `[HookRegistry] accountLocked hook error: ${hook.constructor.name} - ${errorMessage}`,
          hookError instanceof Error ? { error: hookError } : undefined,
        );
      }
    }
  }

  /**
   * Execute all registered sessions revoked hooks
   *
   * Hooks are executed sequentially in registration order.
   * Hook errors are logged but do not stop execution (non-blocking).
   *
   * @param metadata - Revocation context with user and session details
   *
   * @internal
   * @remarks This method is called internally by SessionService
   */
  async executeSessionsRevoked(metadata: SessionsRevokedMetadata): Promise<void> {
    if (this.sessionsRevokedHooks.length === 0) {
      return; // No hooks registered
    }

    for (const hook of this.sessionsRevokedHooks) {
      try {
        await hook.execute(metadata);
      } catch (hookError: unknown) {
        // Non-blocking: log error and continue
        const errorMessage = hookError instanceof Error ? hookError.message : 'Unknown error';
        this.logger?.error?.(
          `[HookRegistry] sessionsRevoked hook error: ${hook.constructor.name} - ${errorMessage}`,
          hookError instanceof Error ? { error: hookError } : undefined,
        );
      }
    }
  }

  /**
   * Execute all registered MFA first enabled hooks
   *
   * Hooks are executed sequentially in registration order.
   * Hook errors are logged but do not stop execution (non-blocking).
   *
   * @param metadata - MFA enrollment context with user and device details
   *
   * @internal
   * @remarks This method is called internally by BaseMFAProviderService
   */
  async executeMFAFirstEnabled(metadata: MFAFirstEnabledMetadata): Promise<void> {
    if (this.mfaFirstEnabledHooks.length === 0) {
      return; // No hooks registered
    }

    for (const hook of this.mfaFirstEnabledHooks) {
      try {
        await hook.execute(metadata);
      } catch (hookError: unknown) {
        // Non-blocking: log error and continue
        const errorMessage = hookError instanceof Error ? hookError.message : 'Unknown error';
        this.logger?.error?.(
          `[HookRegistry] mfaFirstEnabled hook error: ${hook.constructor.name} - ${errorMessage}`,
          hookError instanceof Error ? { error: hookError } : undefined,
        );
      }
    }
  }
}
