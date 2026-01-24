import { Repository } from 'typeorm';
// Public API imports
import {
  BaseMFADevice,
  BaseUser,
  NAuthConfig,
  NAuthLogger,
  NAuthException,
  AuthErrorCode,
  PhoneVerificationService,
  MFAMethod,
  SendVerificationSMSDTO,
  VerifyPhoneWithCodeBySubDTO,
  ClientInfoService,
} from '@nauth-toolkit/core';
// Internal API imports (for provider implementations)
import { BaseMFAProviderService, ChallengeService, AuthAuditService } from '@nauth-toolkit/core/internal';
import { SetupSMSMFADTO, VerifySMSMFASetupDTO } from './dto/mfa.dto';

/**
 * SMS MFA Provider Service
 *
 * Implements SMS-based MFA method.
 * Extends BaseMFAProviderService to provide SMS-specific functionality.
 *
 * This service handles:
 * - SMS code sending during setup and authentication
 * - SMS code verification
 * - MFA device creation for SMS
 *
 * Requires PhoneVerificationService from core (available when SMS provider is configured).
 *
 * @example
 * ```typescript
 * @Module({
 *   imports: [SMSMFAModule],
 * })
 * export class AppModule {}
 * ```
 */

export class SMSMFAProviderService extends BaseMFAProviderService {
  readonly methodName = MFAMethod.SMS;

  constructor(
    mfaDeviceRepository: Repository<BaseMFADevice>,
    userRepository: Repository<BaseUser>,
    config: NAuthConfig,
    logger: NAuthLogger,
    passwordService: unknown,
    private readonly phoneVerificationService?: PhoneVerificationService,
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
   * Setup SMS MFA for user
   *
   * Sends verification code to phone number, or auto-completes setup if phone is already verified.
   * User must verify code to complete setup (unless phone is already verified).
   *
   * @param user - User setting up SMS MFA
   * @param setupData - Setup data (must be SetupSMSMFADTO)
   * @returns Setup result with deviceId if auto-completed, or maskedPhone if code was sent
   * @throws {NAuthException} If SMS is not enabled or phone verification service unavailable
   *
   * @example
   * ```typescript
   * const result = await provider.setup(user, {
   *   phoneNumber: '+1234567890',
   *   deviceName: 'My Phone'
   * });
   * // If phone verified: { deviceId: 123, autoCompleted: true }
   * // If phone not verified: { maskedPhone: '***-***-7890' } (SMS code sent)
   * ```
   */
  async setup(setupData?: unknown): Promise<{ deviceId: number; autoCompleted: true } | { maskedPhone: string }> {
    const user = this.getCurrentUserOrThrow();
    this.logger?.log?.(`Setting up SMS MFA for user: ${user.sub}`);

    // Check if SMS is allowed
    if (!this.isMethodAllowed()) {
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'SMS MFA is not enabled', { feature: 'sms-mfa' });
    }

    const dto = setupData as SetupSMSMFADTO | undefined;
    const userEntity = user as unknown as Record<string, unknown>;
    const isPhoneVerified = (userEntity.isPhoneVerified as boolean) || false;

    // Get phone number from setupData or user object
    const phoneNumber = dto?.phoneNumber || (userEntity.phone as string | undefined);

    if (!phoneNumber) {
      throw new NAuthException(
        AuthErrorCode.PHONE_REQUIRED,
        'Phone number is required for SMS MFA setup. Please provide a phone number.',
      );
    }

    // ============================================================================
    // Special case: If phone is already verified, auto-complete MFA setup
    // No SMS code needed - create device directly
    // ============================================================================
    if (isPhoneVerified) {
      this.logger?.log?.(`Phone already verified for user ${user.sub}, auto-completing SMS MFA setup`);
      // Auto-create MFA device without code verification
      const deviceId = await this.verifySetup(
        {
          phoneNumber,
          code: '', // Code not needed when phone is verified
        },
        dto?.deviceName,
      );
      return { deviceId, autoCompleted: true };
    }

    // Phone not verified - send SMS verification code
    // Check if phone verification service is available
    if (!this.phoneVerificationService) {
      throw new NAuthException(
        AuthErrorCode.VALIDATION_FAILED,
        'Phone verification service is not available. SMS provider must be configured.',
      );
    }

    // Send SMS verification code (phone not verified, so code is required)
    // Link verification token to challenge session if provided in setupData
    const sendDto = new SendVerificationSMSDTO();
    sendDto.sub = user.sub;
    const setupDataWithSession = setupData as (SetupSMSMFADTO & { challengeSessionId?: number }) | undefined;
    if (setupDataWithSession?.challengeSessionId) {
      sendDto.challengeSessionId = setupDataWithSession.challengeSessionId;
      this.logger?.debug?.(
        `Linking SMS verification token to challenge session: challengeSessionId=${setupDataWithSession.challengeSessionId}`,
      );
    } else {
      this.logger?.warn?.(
        `No challengeSessionId provided in setupData for SMS MFA setup. Token will not be linked to challenge session.`,
      );
    }
    await this.phoneVerificationService.sendVerificationSMS(sendDto);

    const maskedPhone = this.maskPhone(phoneNumber);
    this.logger?.log?.(`SMS MFA code sent to: ${maskedPhone}`);

    // Return masked phone for frontend display
    return { maskedPhone };
  }

  /**
   * Verify and complete SMS MFA setup
   *
   * Validates the SMS code and stores the device if valid.
   * Enables MFA for user if this is their first device.
   *
   * **Race Condition Safety:**
   * Device creation uses a transaction with pessimistic locking.
   *
   * Note: SMS MFA is treated as a singleton method in NAuth (one active SMS device per user).
   *
   * @param user - User completing SMS MFA setup
   * @param verificationData - Verification data (must be VerifySMSMFASetupDTO)
   * @param deviceName - Optional device name override
   * @returns MFA device ID (created or existing)
   * @throws {NAuthException} If code is invalid
   *
   * @example
   * ```typescript
   * const deviceId = await provider.verifySetup(user, {
   *   phoneNumber: '+1234567890',
   *   code: '123456'
   * });
   * ```
   */
  async verifySetup(verificationData: unknown, deviceName?: string): Promise<number> {
    const user = this.getCurrentUserOrThrow();
    this.logger?.log?.(`Verifying SMS MFA setup for user: ${user.sub}`);

    const dto = verificationData as VerifySMSMFASetupDTO;
    const userEntity = user as unknown as Record<string, unknown>;
    const userId = userEntity.id as number;
    const userMfaEnabled = (userEntity.mfaEnabled as boolean) || false;
    const isPhoneVerified = (userEntity.isPhoneVerified as boolean) || false;

    // ============================================================================
    // Special case: If phone is already verified, skip code verification
    // This improves UX by avoiding redundant SMS verification after phone verification
    // ============================================================================
    if (!isPhoneVerified) {
      // Phone not verified - verify SMS code (this will also mark phone as verified)
      if (!this.phoneVerificationService) {
        throw new NAuthException(
          AuthErrorCode.VALIDATION_FAILED,
          'Phone verification service is not available. SMS provider must be configured.',
        );
      }

      if (!dto.code || dto.code.trim() === '') {
        throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'Verification code is required');
      }

      try {
        // Verify phone with code - this will mark phone as verified in the database
        const verifyDto = new VerifyPhoneWithCodeBySubDTO();
        verifyDto.sub = user.sub;
        verifyDto.code = dto.code;
        await this.phoneVerificationService.verifyPhoneWithCodeBySub(verifyDto);
        this.logger?.log?.(
          `Phone verified during SMS MFA setup for user ${user.sub} - phone is now marked as verified in database`,
        );
      } catch (error) {
        // Re-throw with more specific error message
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger?.error?.(
          `Failed to verify phone during SMS MFA setup for user ${user.sub}: ${errorMessage}`,
          error,
        );
        throw new NAuthException(AuthErrorCode.VERIFICATION_CODE_INVALID, 'Invalid SMS code');
      }
    } else {
      // Phone already verified - skip code verification
      this.logger?.log?.(
        `Phone already verified for user ${user.sub}, skipping SMS code verification during MFA setup`,
      );
    }

    // ============================================================================
    // Create MFA device (transaction-safe, singleton semantics)
    // ============================================================================
    // We de-duplicate by method (userId + method) to preserve legacy behavior.
    const device = await this.createDevice(
      userId,
      {
        name: deviceName || 'SMS Phone',
        phoneNumber: dto.phoneNumber,
        isActive: true,
        isPrimary: !userMfaEnabled, // First device becomes primary
      },
      { dedupeWhere: {} },
    );

    // Enable MFA if not already enabled
    await this.enableMFAForUser(user);

    this.logger?.log?.(`SMS MFA setup completed for user: ${user.sub}`);

    return device.id;
  }

  /**
   * Verify SMS code during authentication
   *
   * Validates the SMS code for an existing device.
   *
   * @param user - User being authenticated
   * @param code - SMS code (string)
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
    this.logger?.log?.(`Verifying SMS code for user: ${user.sub}`);

    // Check if phone verification service is available
    if (!this.phoneVerificationService) {
      this.logger?.warn?.('SMS verification attempted but phone verification service is not available');
      return false;
    }

    const smsCode = code as string;
    if (!smsCode || typeof smsCode !== 'string') {
      this.logger?.warn?.('Invalid SMS code format');
      return false;
    }

    // Get user entity
    const userEntity = user as unknown as Record<string, unknown>;
    const userId = userEntity.id as number;
    const isPhoneVerified = (userEntity.isPhoneVerified as boolean) || false;

    // Find device (optional - SMS verification uses phone verification service)
    const device = deviceId ? await this.findDevice(userId, deviceId) : null;

    // Verify SMS code using phone verification service
    try {
      // ============================================================================
      // MFA Verification: Verify SMS code for authentication
      // Note: verifyPhoneWithCodeBySub only marks phone as verified if not already verified.
      // This avoids unnecessary database writes and updatedAt timestamp changes.
      // 1. During MFA setup (verifySetup): We check isPhoneVerified first, so it only marks if not verified
      // 2. During MFA login (verify): If phone is already verified, no user table update occurs
      // ============================================================================
      const verifyDto = new VerifyPhoneWithCodeBySubDTO();
      verifyDto.sub = user.sub;
      verifyDto.code = smsCode;
      await this.phoneVerificationService.verifyPhoneWithCodeBySub(verifyDto);

      if (!isPhoneVerified) {
        this.logger?.log?.(`SMS code verified and phone marked as verified during MFA for user: ${user.sub}`);
      } else {
        this.logger?.log?.(`SMS code verified for MFA (phone already verified) for user: ${user.sub}`);
      }

      // Update device usage if device found
      if (device) {
        await this.updateDeviceUsage(device.id);
      }

      this.logger?.log?.(`SMS code verified successfully for user: ${user.sub}`);
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
        `SMS code verification failed for user: ${user.sub}, code: ${smsCode}, error: ${errorCode} - ${errorMessage}`,
      );
      return false;
    }
  }

  /**
   * Send SMS code for MFA verification
   *
   * Called during login MFA challenge to send code to registered phone.
   *
   * @param user - User requesting SMS code
   * @returns Masked phone number where code was sent
   * @throws {NAuthException} If no SMS device registered or phone verification service unavailable
   *
   * @example
   * ```typescript
   * const maskedPhone = await provider.sendChallenge(user);
   * // Returns: '***-***-1234'
   * ```
   */
  async sendChallenge(): Promise<string> {
    const user = this.getCurrentUserOrThrow();
    this.logger?.log?.(`Sending SMS MFA code for user: ${user.sub}`);

    // Get user entity
    const userEntity = user as unknown as Record<string, unknown>;
    const userId = userEntity.id as number;

    // Find active SMS device
    const device = await this.findDevice(userId);
    if (!device) {
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'No SMS device registered', { deviceType: 'sms' });
    }

    // Get phone number from device or fall back to user phone
    // Fallback handles legacy devices where phoneNumber field might be null
    const phoneNumber = device.phoneNumber || (userEntity.phone as string | undefined);
    if (!phoneNumber) {
      throw new NAuthException(
        AuthErrorCode.VALIDATION_FAILED,
        'No phone number found for SMS MFA. Please update your profile or re-setup SMS MFA.',
        { deviceType: 'sms' },
      );
    }

    // Check if phone verification service is available
    if (!this.phoneVerificationService) {
      throw new NAuthException(
        AuthErrorCode.VALIDATION_FAILED,
        'Phone verification service is not available. SMS provider must be configured.',
      );
    }

    // Send SMS code for MFA verification
    // Always send codes for MFA verification (even if phone is already verified)
    const sendDto = new SendVerificationSMSDTO();
    sendDto.sub = user.sub;
    sendDto.skipAlreadyVerifiedCheck = true;
    await this.phoneVerificationService.sendVerificationSMS(sendDto);

    this.logger?.log?.(`SMS MFA code sent for user: ${user.sub}`);

    return this.maskPhone(phoneNumber);
  }
}
