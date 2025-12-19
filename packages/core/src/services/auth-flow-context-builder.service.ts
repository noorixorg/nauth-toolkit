import { IUser } from '../interfaces/entities.interface';
import { NAuthConfig } from '../interfaces/config.interface';
import { TrustedDeviceService } from './trusted-device.service';
import { AdaptiveMFADecisionService } from './adaptive-mfa-decision.service';
import { ClientInfoService } from './client-info.service';
import { NAuthLogger } from '../utils/nauth-logger';
import { AuthFlowContext } from './auth-flow-state-machine.types';

/**
 * Authentication Flow Context Builder
 *
 * Pre-computes all derived values needed for state machine rule evaluation.
 * This optimization ensures values are calculated once at the beginning of the flow,
 * rather than repeatedly during rule evaluation.
 *
 * @example
 * ```typescript
 * const context = await contextBuilder.build({
 *   user,
 *   config,
 *   authMethod: 'password',
 *   deviceToken: 'abc123'
 * });
 * ```
 */
export class AuthFlowContextBuilder {
  constructor(
    private readonly trustedDeviceService?: TrustedDeviceService,
    private readonly adaptiveMFADecisionService?: AdaptiveMFADecisionService,
    _clientInfoService?: ClientInfoService, // Reserved for future use (not stored as property)
    private readonly logger?: NAuthLogger,
  ) {}

  /**
   * Build authentication flow context with pre-computed values
   *
   * @param params - Context parameters
   * @param params.user - User attempting authentication
   * @param params.config - Authentication configuration
   * @param params.authMethod - Authentication method ('password' or 'social')
   * @param params.authProvider - Social auth provider name (e.g., 'google', 'apple')
   * @param params.deviceToken - Device token for trusted device check
   * @param params.skipMFAVerification - Skip MFA verification flag
   * @returns Authentication flow context with computed values
   *
   * @example
   * ```typescript
   * const context = await contextBuilder.build({
   *   user,
   *   config,
   *   authMethod: 'password',
   *   deviceToken: 'abc123'
   * });
   * ```
   */
  async build(params: {
    user: IUser;
    config: NAuthConfig;
    authMethod?: 'password' | 'social';
    authProvider?: string;
    deviceToken?: string;
    skipMFAVerification?: boolean;
  }): Promise<AuthFlowContext> {
    const { user, config, authMethod, authProvider, deviceToken, skipMFAVerification } = params;

    this.logger?.debug?.(
      `[ContextBuilder] Building context for user ${user.sub} (authMethod=${authMethod || 'password'}, mfaEnabled=${user.mfaEnabled}, mfaExempt=${user.mfaExempt || false})`,
    );

    // ============================================================================
    // Pre-compute all derived values
    // ============================================================================

    const isEmailVerificationRequired = this.isEmailVerificationRequired(user, config, authMethod);
    const isPhoneVerificationRequired = this.isPhoneVerificationRequired(user, config, authMethod);
    const isPhoneCollectionNeeded = this.isPhoneCollectionNeeded(user, config, authMethod);
    const isMFAExempt = this.checkMFAExempt(user);
    const isMFASetupRequired = this.isMFASetupRequired(user, config, authMethod);
    const isDeviceTrusted = await this.checkDeviceTrust(user, deviceToken, config);
    const gracePeriodData = this.calculateGracePeriod(user, config);
    const blockData = await this.checkBlocked(user);
    const mfaVerificationData = await this.checkMFAVerification(
      user,
      config,
      authMethod,
      deviceToken,
      isDeviceTrusted,
      skipMFAVerification,
    );

    // Merge block status from existing storage and adaptive MFA decision
    const isBlocked = blockData.blocked || (mfaVerificationData.isBlocked ?? false);
    const blockedUntil = blockData.until; // From existing block
    const blockReason =
      blockData.reason || (mfaVerificationData.isBlocked ? 'Sign in blocked due to suspicious activity' : undefined);

    const computed = {
      isEmailVerificationRequired,
      isPhoneVerificationRequired,
      isPhoneCollectionNeeded,
      isMFAExempt,
      isMFASetupRequired,
      isMFAVerificationRequired: mfaVerificationData.required,
      isDeviceTrusted,
      isGracePeriodActive: gracePeriodData.isActive,
      gracePeriodEndsAt: gracePeriodData.endsAt,
      isBlocked,
      blockedUntil,
      blockReason,
      riskScore: mfaVerificationData.riskScore,
      riskLevel: mfaVerificationData.riskLevel,
    };

    this.logger?.debug?.(
      `[ContextBuilder] Computed values: emailReq=${computed.isEmailVerificationRequired}, phoneReq=${computed.isPhoneVerificationRequired}, phoneCollect=${computed.isPhoneCollectionNeeded}, mfaExempt=${computed.isMFAExempt}, mfaSetupReq=${computed.isMFASetupRequired}, mfaVerifyReq=${computed.isMFAVerificationRequired}, trusted=${computed.isDeviceTrusted}, gracePeriod=${computed.isGracePeriodActive}, blocked=${computed.isBlocked}`,
    );

    return {
      user,
      config,
      authMethod,
      authProvider,
      deviceToken,
      skipMFAVerification,
      computed,
    };
  }

  /**
   * Check if email verification is required
   *
   * @param user - User to check
   * @param config - Auth configuration
   * @param authMethod - Authentication method
   * @returns True if email verification is required
   */
  private isEmailVerificationRequired(user: IUser, config: NAuthConfig, authMethod?: 'password' | 'social'): boolean {
    const verificationMethod = config.signup?.verificationMethod || 'email';

    // Email verification not required if verification is disabled
    if (verificationMethod === 'none' || verificationMethod === 'phone') {
      return false;
    }

    // Social auth users have email pre-verified by OAuth provider
    if (authMethod === 'social') {
      return false;
    }

    // Check if email is already verified
    if (user.isEmailVerified) {
      return false;
    }

    // Email verification required for 'email' or 'both' methods
    return verificationMethod === 'email' || verificationMethod === 'both';
  }

  /**
   * Check if phone verification is required
   *
   * @param user - User to check
   * @param config - Auth configuration
   * @param authMethod - Authentication method
   * @returns True if phone verification is required
   */
  private isPhoneVerificationRequired(user: IUser, config: NAuthConfig, _authMethod?: 'password' | 'social'): boolean {
    const verificationMethod = config.signup?.verificationMethod || 'email';

    // Phone verification not required if verification is disabled or email-only
    if (verificationMethod === 'none' || verificationMethod === 'email') {
      return false;
    }

    // Phone verification required for 'phone' or 'both' methods
    // But only if user has a phone number
    if (verificationMethod === 'phone' || verificationMethod === 'both') {
      // If user has no phone, phone collection is needed first (handled separately)
      if (!user.phone) {
        return false; // Phone collection needed, not verification
      }

      // Check if phone is already verified
      return !user.isPhoneVerified;
    }

    return false;
  }

  /**
   * Check if phone collection is needed
   *
   * Phone collection is the step where we ask users to provide their phone number.
   * This should NOT be triggered if:
   * - User already has a verified phone (e.g., from prior signup or account linking)
   * - Phone verification is not required by config
   *
   * **Bug Fix (2025-12-08):**
   * Previously didn't check `isPhoneVerified`, causing social login users with
   * verified phones to be asked for phone collection again after account linking.
   *
   * @param user - User to check
   * @param config - Auth configuration
   * @param _authMethod - Authentication method (unused, kept for API consistency)
   * @returns True if phone collection is needed
   */
  private isPhoneCollectionNeeded(user: IUser, config: NAuthConfig, _authMethod?: 'password' | 'social'): boolean {
    const verificationMethod = config.signup?.verificationMethod || 'email';

    // Phone collection not needed if verification is disabled or email-only
    if (verificationMethod === 'none' || verificationMethod === 'email') {
      return false;
    }

    // ============================================================================
    // Skip phone collection if phone is already verified
    // ============================================================================
    // This handles cases like:
    // - User signs up with password + phone verification, then later links social account
    // - Account linking where existing account has verified phone
    // - Any scenario where phone is already verified (we trust it)
    if (user.isPhoneVerified) {
      return false;
    }

    // Phone collection needed for 'phone' or 'both' methods if user has no phone
    if ((verificationMethod === 'phone' || verificationMethod === 'both') && !user.phone) {
      return true;
    }

    return false;
  }

  /**
   * Check if user is exempt from MFA
   *
   * @param user - User to check
   * @returns True if user is exempt from MFA
   */
  private checkMFAExempt(user: IUser): boolean {
    const mfaExempt = user.mfaExempt;
    // Handle different database representations (boolean true, MySQL tinyint 1, etc.)
    return mfaExempt === true || (mfaExempt as unknown) === 1;
  }

  /**
   * Check if MFA setup is required
   *
   * @param user - User to check
   * @param config - Auth configuration
   * @param authMethod - Authentication method
   * @returns True if MFA setup is required
   */
  private isMFASetupRequired(user: IUser, config: NAuthConfig, authMethod?: 'password' | 'social'): boolean {
    // Check exemption first
    if (this.checkMFAExempt(user)) {
      return false;
    }

    // MFA not enabled in config
    if (!config.mfa?.enabled) {
      return false;
    }

    // User already has MFA enabled
    if (user.mfaEnabled) {
      return false;
    }

    // Social login exemption
    if (authMethod === 'social' && config.mfa.requireForSocialLogin === false) {
      return false;
    }

    // Check enforcement policy
    const enforcement = config.mfa.enforcement || 'OPTIONAL';

    if (enforcement === 'OPTIONAL') {
      return false;
    }

    // REQUIRED or ADAPTIVE: Check grace period
    const gracePeriod = config.mfa.gracePeriod ?? 7;
    const gracePeriodData = this.calculateGracePeriod(user, config);

    // If grace period is 0, MFA setup is required immediately
    if (gracePeriod === 0) {
      return true;
    }

    // If grace period is active, MFA setup is optional
    if (gracePeriodData.isActive) {
      return false;
    }

    // Grace period expired - MFA setup required
    return true;
  }

  /**
   * Check if device is trusted
   *
   * @param user - User to check
   * @param deviceToken - Device token
   * @param config - Auth configuration
   * @returns True if device is trusted
   */
  private async checkDeviceTrust(user: IUser, deviceToken?: string, config?: NAuthConfig): Promise<boolean> {
    if (
      !deviceToken ||
      !config?.mfa?.rememberDevices ||
      config.mfa.rememberDevices === 'never' ||
      !this.trustedDeviceService
    ) {
      return false;
    }

    try {
      const validation = await this.trustedDeviceService.validateDeviceToken(deviceToken, user.id);
      return validation.isValid;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger?.warn?.(`Failed to check device trust: ${errorMessage}`, { error, userId: user.id });
      return false;
    }
  }

  /**
   * Calculate grace period status
   *
   * @param user - User to check
   * @param config - Auth configuration
   * @returns Grace period status
   */
  private calculateGracePeriod(user: IUser, config: NAuthConfig): { isActive: boolean; endsAt?: Date } {
    const gracePeriod = config.mfa?.gracePeriod ?? 7;

    // No grace period
    if (gracePeriod === 0) {
      return { isActive: false };
    }

    // Access createdAt from user interface
    const userWithDates = user as IUser & { createdAt: Date };
    const createdAt = userWithDates.createdAt;

    if (!createdAt) {
      // No creation date - grace period not active
      return { isActive: false };
    }

    const gracePeriodEnd = new Date(createdAt);
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + gracePeriod);

    const now = new Date();
    const isActive = now < gracePeriodEnd;

    return {
      isActive,
      endsAt: isActive ? gracePeriodEnd : undefined,
    };
  }

  /**
   * Check if user is blocked
   *
   * @param user - User to check
   * @returns Block status
   */
  private async checkBlocked(user: IUser): Promise<{ blocked: boolean; until?: Date; reason?: string }> {
    if (!this.adaptiveMFADecisionService) {
      return { blocked: false };
    }

    try {
      const blockStatus = await this.adaptiveMFADecisionService.isUserBlocked(user.id);
      return {
        blocked: blockStatus.blocked,
        until: blockStatus.expiresAt,
        reason: blockStatus.message,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger?.warn?.(`Failed to check user block status: ${errorMessage}`, { error, userId: user.id });
      return { blocked: false };
    }
  }

  /**
   * Check if MFA verification is required
   *
   * @param user - User to check
   * @param config - Auth configuration
   * @param authMethod - Authentication method
   * @param deviceToken - Device token
   * @param isDeviceTrusted - Whether device is trusted
   * @param skipMFAVerification - Skip MFA verification flag
   * @returns MFA verification requirement and risk data
   */
  private async checkMFAVerification(
    user: IUser,
    config: NAuthConfig,
    authMethod?: 'password' | 'social',
    _deviceToken?: string, // Reserved for future use
    isDeviceTrusted?: boolean,
    skipMFAVerification?: boolean,
  ): Promise<{ required: boolean; riskScore?: number; riskLevel?: 'low' | 'medium' | 'high'; isBlocked?: boolean }> {
    // Skip if flag is set
    if (skipMFAVerification) {
      return { required: false };
    }

    // Check exemption first
    if (this.checkMFAExempt(user)) {
      return { required: false };
    }

    // MFA not enabled in config
    if (!config.mfa?.enabled) {
      return { required: false };
    }

    // User doesn't have MFA enabled
    if (!user.mfaEnabled) {
      return { required: false };
    }

    // Social login exemption
    if (authMethod === 'social' && config.mfa.requireForSocialLogin === false) {
      return { required: false };
    }

    // Check enforcement policy
    const enforcement = config.mfa.enforcement || 'OPTIONAL';

    // ============================================================================
    // OPTIONAL Enforcement: Setup is optional, but if user has MFA enabled,
    // it must be used (unless trusted device bypass applies)
    // ============================================================================
    if (enforcement === 'OPTIONAL') {
      // OPTIONAL means setup is optional, but once enabled, MFA is required
      // Check if trusted device bypass applies
      if (
        isDeviceTrusted &&
        config.mfa.rememberDevices &&
        config.mfa.rememberDevices !== 'never' &&
        config.mfa.bypassMFAForTrustedDevices === true
      ) {
        return { required: false };
      }
      // User has MFA enabled - require it
      return { required: true };
    }

    // Trusted device bypass (for REQUIRED enforcement, not ADAPTIVE)
    if (
      enforcement === 'REQUIRED' &&
      isDeviceTrusted &&
      config.mfa.rememberDevices &&
      config.mfa.rememberDevices !== 'never' &&
      config.mfa.bypassMFAForTrustedDevices === true
    ) {
      return { required: false };
    }

    // ADAPTIVE enforcement
    if (enforcement === 'ADAPTIVE') {
      if (!this.adaptiveMFADecisionService) {
        // Service not available - fall back to REQUIRED behavior
        this.logger?.warn?.(
          `ADAPTIVE enforcement enabled but AdaptiveMFADecisionService not available - falling back to REQUIRED behavior for user ${user.sub}`,
        );
        return { required: true };
      }

      // Always evaluate adaptive MFA for complete risk assessment (trusted or untrusted)
      try {
        const decision = await this.adaptiveMFADecisionService.evaluateAdaptiveMFA(user, authMethod || 'password');

        // Handle block_signin action - block user and store in storage
        if (decision.action === 'block_signin') {
          if (decision.payload) {
            await this.adaptiveMFADecisionService.blockUserSignIn(user, decision.payload);
          }
          // Mark as blocked so state machine will transition to BLOCKED state
          return {
            required: false, // Not relevant - will be blocked
            riskScore: decision.riskScore,
            riskLevel: decision.riskLevel,
            isBlocked: true,
          };
        }

        // For untrusted devices, always require MFA regardless of risk score
        // (new devices are inherently riskier and should verify)
        if (!isDeviceTrusted) {
          return {
            required: true,
            riskScore: decision.riskScore,
            riskLevel: decision.riskLevel,
          };
        }

        // For trusted devices, use risk-based decision
        return {
          required: decision.action === 'require_mfa',
          riskScore: decision.riskScore,
          riskLevel: decision.riskLevel,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger?.warn?.(`Failed to evaluate adaptive MFA: ${errorMessage}`, { error, userId: user.id });
        // Fall back to requiring MFA on error (safer)
        return { required: true };
      }
    }

    // REQUIRED enforcement
    return { required: true };
  }
}
