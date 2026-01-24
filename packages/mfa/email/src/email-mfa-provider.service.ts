import { Repository } from 'typeorm';
// Public API imports
import {
  BaseMFADevice,
  BaseUser,
  NAuthConfig,
  NAuthLogger,
  NAuthException,
  AuthErrorCode,
  EmailVerificationService,
  MFAMethod,
  SendVerificationEmailDTO,
  VerifyEmailWithCodeDTO,
  ClientInfoService,
} from '@nauth-toolkit/core';
// Internal API imports (for provider implementations)
import { BaseMFAProviderService, ChallengeService, AuthAuditService } from '@nauth-toolkit/core/internal';
import { SetupEmailMFADTO, VerifyEmailMFASetupDTO } from './dto/mfa.dto';

/**
 * Email MFA Provider Service
 *
 * Implements Email-based MFA method.
 * Extends BaseMFAProviderService to provide Email-specific functionality.
 *
 * This service handles:
 * - Email code sending during setup and authentication
 * - Email code verification
 * - MFA device creation for Email
 *
 * Requires EmailVerificationService from core.
 *
 * @example
 * ```typescript
 * @Module({
 *   imports: [EmailMFAModule],
 * })
 * export class AppModule {}
 * ```
 */
export class EmailMFAProviderService extends BaseMFAProviderService {
  readonly methodName = MFAMethod.EMAIL;

  constructor(
    mfaDeviceRepository: Repository<BaseMFADevice>,
    userRepository: Repository<BaseUser>,
    config: NAuthConfig,
    logger: NAuthLogger,
    passwordService: unknown,
    private readonly emailVerificationService?: EmailVerificationService,
    challengeService?: ChallengeService,
    auditService?: AuthAuditService,
    clientInfoService?: ClientInfoService,
  ) {
    super(
      mfaDeviceRepository,
      userRepository,
      config,
      logger,
      passwordService,
      challengeService,
      auditService,
      clientInfoService,
    );
  }

  /**
   * Setup Email MFA for user
   *
   * Sends verification code to email address, or auto-completes setup if email is already verified.
   * User must verify code to complete setup (unless email is already verified).
   *
   * @param user - User setting up Email MFA
   * @param setupData - Setup data (must be SetupEmailMFADTO)
   * @returns Setup result with deviceId if auto-completed, or maskedEmail if code was sent
   * @throws {NAuthException} If Email is not enabled or email verification service unavailable
   *
   * @example
   * ```typescript
   * const result = await provider.setup(user, {
   *   email: 'user@example.com',
   *   deviceName: 'My Email'
   * });
   * // If email verified: { deviceId: 123, autoCompleted: true }
   * // If email not verified: { maskedEmail: 'u***r@example.com' } (Email code sent)
   * ```
   */
  async setup(setupData?: unknown): Promise<{ deviceId: number; autoCompleted: true } | { maskedEmail: string }> {
    const user = this.getCurrentUserOrThrow();
    this.logger?.log?.(`Setting up Email MFA for user: ${user.sub}`);

    // Check if Email is allowed
    if (!this.isMethodAllowed()) {
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'Email MFA is not enabled', { feature: 'email-mfa' });
    }

    const dto = setupData as SetupEmailMFADTO | undefined;
    const userEntity = user as unknown as Record<string, unknown>;
    const isEmailVerified = (userEntity.isEmailVerified as boolean) || false;

    // Get email address from setupData or user object
    const email = dto?.email || (userEntity.email as string | undefined);

    if (!email) {
      throw new NAuthException(
        AuthErrorCode.VALIDATION_FAILED,
        'Email address is required for Email MFA setup. Please provide an email address.',
      );
    }

    // ============================================================================
    // Special case: If email is already verified, auto-complete MFA setup
    // No Email code needed - create device directly
    // ============================================================================
    if (isEmailVerified) {
      this.logger?.log?.(`Email already verified for user ${user.sub}, auto-completing Email MFA setup`);
      // Auto-create MFA device without code verification
      const deviceId = await this.verifySetup(
        {
          email,
          code: '', // Code not needed when email is verified
        },
        dto?.deviceName,
      );
      return { deviceId, autoCompleted: true };
    }

    // Email not verified - send Email verification code
    // Check if email verification service is available
    if (!this.emailVerificationService) {
      throw new NAuthException(
        AuthErrorCode.VALIDATION_FAILED,
        'Email verification service is not available. Email provider must be configured.',
      );
    }

    // Send Email verification code (email not verified, so code is required)
    // Link verification token to challenge session if provided in setupData
    const sendDto = new SendVerificationEmailDTO();
    sendDto.sub = user.sub;
    const setupDataWithSession = setupData as (SetupEmailMFADTO & { challengeSessionId?: number }) | undefined;
    if (setupDataWithSession?.challengeSessionId) {
      sendDto.challengeSessionId = setupDataWithSession.challengeSessionId;
    }
    await this.emailVerificationService.sendVerificationEmail(sendDto);

    const maskedEmail = this.maskEmail(email);
    this.logger?.log?.(`Email MFA code sent to: ${maskedEmail}`);

    // Return masked email for frontend display
    return { maskedEmail };
  }

  /**
   * Verify and complete Email MFA setup
   *
   * Validates the Email code and stores the device if valid.
   * Enables MFA for user if this is their first device.
   *
   * **Race Condition Safety:**
   * Device creation uses a transaction with pessimistic locking.
   *
   * Note: Email MFA is treated as a singleton method in NAuth (one active Email device per user).
   *
   * @param user - User completing Email MFA setup
   * @param verificationData - Verification data (must be VerifyEmailMFASetupDTO)
   * @param deviceName - Optional device name override
   * @returns MFA device ID (created or existing)
   * @throws {NAuthException} If code is invalid
   *
   * @example
   * ```typescript
   * const deviceId = await provider.verifySetup(user, {
   *   email: 'user@example.com',
   *   code: '123456'
   * });
   * ```
   */
  async verifySetup(verificationData: unknown, deviceName?: string): Promise<number> {
    const user = this.getCurrentUserOrThrow();
    this.logger?.log?.(`Verifying Email MFA setup for user: ${user.sub}`);

    const dto = verificationData as VerifyEmailMFASetupDTO;
    const userEntity = user as unknown as Record<string, unknown>;
    const userId = userEntity.id as number;
    const userMfaEnabled = (userEntity.mfaEnabled as boolean) || false;
    const isEmailVerified = (userEntity.isEmailVerified as boolean) || false;

    // Get email address from dto or fall back to user object
    // This ensures email is always stored in the device, even if dto.email is undefined
    const email = dto.email || (userEntity.email as string | undefined);

    if (!email) {
      throw new NAuthException(
        AuthErrorCode.VALIDATION_FAILED,
        'Email address is required for Email MFA setup. Please provide an email address.',
      );
    }

    // ============================================================================
    // Special case: If email is already verified, skip code verification
    // This improves UX by avoiding redundant Email verification after email verification
    // ============================================================================
    if (!isEmailVerified) {
      // Email not verified - verify Email code (this will also mark email as verified)
      if (!this.emailVerificationService) {
        throw new NAuthException(
          AuthErrorCode.VALIDATION_FAILED,
          'Email verification service is not available. Email provider must be configured.',
        );
      }

      if (!dto.code || dto.code.trim() === '') {
        throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'Verification code is required');
      }

      try {
        // Verify email with code - this will mark email as verified in the database
        const verifyDto = new VerifyEmailWithCodeDTO();
        verifyDto.email = user.email;
        verifyDto.code = dto.code;
        await this.emailVerificationService.verifyEmailWithCode(verifyDto);
        this.logger?.log?.(
          `Email verified during Email MFA setup for user ${user.sub} - email is now marked as verified in database`,
        );
      } catch (error) {
        // Re-throw with more specific error message
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger?.error?.(
          `Failed to verify email during Email MFA setup for user ${user.sub}: ${errorMessage}`,
          error,
        );
        throw new NAuthException(AuthErrorCode.VERIFICATION_CODE_INVALID, 'Invalid Email code');
      }
    } else {
      // Email already verified - skip code verification
      this.logger?.log?.(
        `Email already verified for user ${user.sub}, skipping Email code verification during MFA setup`,
      );
    }

    // ============================================================================
    // Create MFA device (transaction-safe, singleton semantics)
    // ============================================================================
    // We de-duplicate by method (userId + method) to preserve legacy behavior.
    const device = await this.createDevice(
      userId,
      {
        name: deviceName || 'Email',
        email, // Use resolved email (dto.email or user.email)
        isActive: true,
        isPrimary: !userMfaEnabled, // First device becomes primary
      },
      { dedupeWhere: {} },
    );

    // Enable MFA if not already enabled
    await this.enableMFAForUser(user);

    this.logger?.log?.(`Email MFA setup completed for user: ${user.sub}`);

    return device.id;
  }

  /**
   * Verify Email code during authentication
   *
   * Validates the Email code for an existing device.
   *
   * @param user - User being authenticated
   * @param code - Email code (string)
   * @param deviceId - Optional device ID to verify against
   * @returns True if verification succeeds
   * @throws {NAuthException} If device not found or verification fails
   *
   * @example
   * ```typescript
   * const isValid = await provider.verify(user, '123456');
   * ```
   */
  async verify(code: unknown, deviceId?: number): Promise<boolean> {
    const user = this.getCurrentUserOrThrow();
    this.logger?.log?.(`Verifying Email code for user: ${user.sub}`);

    // Check if email verification service is available
    if (!this.emailVerificationService) {
      this.logger?.warn?.('Email verification attempted but email verification service is not available');
      return false;
    }

    const emailCode = code as string;
    if (!emailCode || typeof emailCode !== 'string') {
      this.logger?.warn?.('Invalid Email code format');
      return false;
    }

    // Get user entity
    const userEntity = user as unknown as Record<string, unknown>;
    const userId = userEntity.id as number;
    const isEmailVerified = (userEntity.isEmailVerified as boolean) || false;

    // Find device (optional - Email verification uses email verification service)
    const device = deviceId ? await this.findDevice(userId, deviceId) : null;

    // Verify Email code using email verification service
    try {
      // ============================================================================
      // MFA Verification: Verify Email code for authentication
      // Note: verifyEmailWithCode only marks email as verified if not already verified.
      // This avoids unnecessary database writes and updatedAt timestamp changes.
      // 1. During MFA setup (verifySetup): We check isEmailVerified first, so it only marks if not verified
      // 2. During MFA login (verify): If email is already verified, no user table update occurs
      // ============================================================================
      const verifyDto = new VerifyEmailWithCodeDTO();
      verifyDto.email = user.email;
      verifyDto.code = emailCode;
      await this.emailVerificationService.verifyEmailWithCode(verifyDto);

      if (!isEmailVerified) {
        this.logger?.log?.(`Email code verified and email marked as verified during MFA for user: ${user.sub}`);
      } else {
        this.logger?.log?.(`Email code verified for MFA (email already verified) for user: ${user.sub}`);
      }

      // Update device usage if device found
      if (device) {
        await this.updateDeviceUsage(device.id);
      }

      this.logger?.log?.(`Email code verified successfully for user: ${user.sub}`);
      return true;
    } catch (error) {
      // Re-throw NAuthException to preserve specific error codes (e.g., VERIFY_TOO_MANY_ATTEMPTS)
      // This allows the calling code to handle rate limiting and other specific errors correctly
      if (error instanceof NAuthException) {
        throw error;
      }

      // For unexpected errors, log and return false (generic failure)
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorCode =
        (error && typeof error === 'object' && 'code' in error ? String(error.code) : undefined) || 'UNKNOWN';
      this.logger?.warn?.(
        `Email code verification failed for user: ${user.sub}, code: ${emailCode}, error: ${errorCode} - ${errorMessage}`,
      );
      return false;
    }
  }

  /**
   * Send Email code for MFA verification
   *
   * Called during login MFA challenge to send code to registered email.
   * Uses EmailVerificationService for code generation and DB storage (same as setup/verify).
   *
   * @param user - User requesting Email code
   * @returns Masked email address where code was sent
   * @throws {NAuthException} If no Email device registered or email verification service unavailable
   *
   * @example
   * ```typescript
   * const maskedEmail = await provider.sendChallenge(user);
   * // Returns: 'u***r@example.com'
   * ```
   */
  async sendChallenge(): Promise<string> {
    const user = this.getCurrentUserOrThrow();
    this.logger?.log?.(`Sending Email MFA code for user: ${user.sub}`);

    // Get user entity
    const userEntity = user as unknown as Record<string, unknown>;
    const userId = userEntity.id as number;

    // Find active Email device
    const device = await this.findDevice(userId);
    if (!device) {
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'No Email device registered', { deviceType: 'email' });
    }

    // Get email address from device or fall back to user email
    // Fallback handles legacy devices where email field might be null
    const emailAddress = device.email || user.email;
    if (!emailAddress) {
      throw new NAuthException(
        AuthErrorCode.VALIDATION_FAILED,
        'No email address found for Email MFA. Please update your profile or re-setup Email MFA.',
        { deviceType: 'email' },
      );
    }

    // Check if email verification service is available
    if (!this.emailVerificationService) {
      throw new NAuthException(
        AuthErrorCode.VALIDATION_FAILED,
        'Email verification service is not available. Email provider must be configured.',
      );
    }

    // Send MFA email code via EmailVerificationService
    // This uses the mfaEmailCode template and stores code in DB verification tokens table
    // skipAlreadyVerifiedCheck=true because email is already verified but we need MFA code
    const sendDto = new SendVerificationEmailDTO();
    sendDto.sub = user.sub;
    sendDto.skipAlreadyVerifiedCheck = true;
    await this.emailVerificationService.sendMFAEmailCode(sendDto);

    this.logger?.log?.(`Email MFA code sent for user: ${user.sub}`);

    return this.maskEmail(emailAddress);
  }
}
