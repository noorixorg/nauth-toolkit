import { Repository } from 'typeorm';
// Public API imports
import {
  BaseMFADevice,
  BaseUser,
  NAuthConfig,
  NAuthLogger,
  NAuthException,
  AuthErrorCode,
  AuthAuditEventType,
  PhoneVerificationService,
  MFAMethod,
  SendVerificationSMSDTO,
  SetPhoneAndSendVerificationDTO,
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
   * Resolves the phone number to enrol and either auto-completes (phone on file already
   * verified and no different number supplied) or sends a verification code.
   *
   * When `setupData.phoneNumber` is supplied it is saved to the account through
   * `PhoneVerificationService.setPhoneAndSendVerification()` (E.164 check, uniqueness,
   * verification reset, hooks) and the code goes to that number. A number different from
   * the phone on file replaces it and retires existing SMS MFA devices, the same outcome as
   * changing the phone through the profile endpoint. Calling again without `phoneNumber`
   * resends to the phone on file. This makes SMS enrolment possible for accounts that have
   * no phone (email-only or social signup).
   *
   * @param setupData - Setup data (SetupSMSMFADTO, plus `challengeSessionId` when called from a challenge)
   * @returns Setup result with deviceId if auto-completed, or maskedPhone if code was sent
   * @throws {NAuthException} VALIDATION_FAILED | PHONE_REQUIRED | INVALID_PHONE_FORMAT | PHONE_EXISTS | RATE_LIMIT_SMS | RATE_LIMIT_RESEND
   *
   * @example
   * ```typescript
   * const result = await provider.setup({ phoneNumber: '+14155552671', deviceName: 'My Phone' });
   * // Phone on file verified, no number supplied: { deviceId: 123, autoCompleted: true }
   * // Otherwise: { maskedPhone: '+1***2671' } (SMS code sent)
   * ```
   */
  async setup(setupData?: unknown): Promise<{ deviceId: number; autoCompleted: true } | { maskedPhone: string }> {
    const user = this.getCurrentUserOrThrow();
    this.logger?.log?.(`Setting up SMS MFA for user: ${user.sub}`);

    // Check if SMS is allowed
    if (!this.isMethodAllowed()) {
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'SMS MFA is not enabled', { feature: 'sms-mfa' });
    }

    const dto = setupData as (SetupSMSMFADTO & { challengeSessionId?: number }) | undefined;
    const userEntity = user as unknown as Record<string, unknown>;
    const isPhoneVerified = (userEntity.isPhoneVerified as boolean) || false;
    const currentPhone = (userEntity.phone as string | null | undefined) || undefined;
    const suppliedPhone =
      typeof dto?.phoneNumber === 'string' && dto.phoneNumber.trim() !== ''
        ? dto.phoneNumber.replace(/\s/g, '')
        : undefined;
    const targetPhone = suppliedPhone || currentPhone;

    if (!targetPhone) {
      throw new NAuthException(
        AuthErrorCode.PHONE_REQUIRED,
        'Phone number is required for SMS MFA setup. Please provide a phone number.',
      );
    }

    // ============================================================================
    // Auto-complete: phone on file is verified and the caller did not ask for a
    // different number. No SMS code needed - create device directly.
    // ============================================================================
    if (isPhoneVerified && targetPhone === currentPhone) {
      this.logger?.log?.(`Phone already verified for user ${user.sub}, auto-completing SMS MFA setup`);
      const deviceId = await this.verifySetup({ code: '' }, dto?.deviceName);
      return { deviceId, autoCompleted: true };
    }

    // Check if phone verification service is available
    if (!this.phoneVerificationService) {
      throw new NAuthException(
        AuthErrorCode.VALIDATION_FAILED,
        'Phone verification service is not available. SMS provider must be configured.',
      );
    }

    if (dto?.challengeSessionId) {
      this.logger?.debug?.(
        `Linking SMS verification token to challenge session: challengeSessionId=${dto.challengeSessionId}`,
      );
    }

    // ============================================================================
    // Number supplied: persist it (new or unchanged-but-unverified) and send the code
    // through the shared core path. A changed number also retires SMS devices tied to
    // the old one so login codes cannot go to an unverified number.
    // ============================================================================
    if (suppliedPhone) {
      const setPhoneDto = Object.assign(new SetPhoneAndSendVerificationDTO(), {
        sub: user.sub,
        phone: suppliedPhone,
        challengeSessionId: dto?.challengeSessionId,
      });
      const result = await this.phoneVerificationService.setPhoneAndSendVerification(setPhoneDto);

      if (result.phoneChanged && currentPhone) {
        await this.retireSmsDevicesForPhoneChange(userEntity.id as number, user.sub, currentPhone, suppliedPhone);
      }

      const maskedPhone = this.maskPhone(suppliedPhone);
      this.logger?.log?.(`SMS MFA code sent to: ${maskedPhone}`);
      return { maskedPhone };
    }

    // ============================================================================
    // No number supplied, phone on file not verified: send (or resend) to it
    // ============================================================================
    const sendDto = new SendVerificationSMSDTO();
    sendDto.sub = user.sub;
    sendDto.challengeSessionId = dto?.challengeSessionId;
    await this.phoneVerificationService.sendVerificationSMS(sendDto);

    const maskedPhone = this.maskPhone(targetPhone);
    this.logger?.log?.(`SMS MFA code sent to: ${maskedPhone}`);

    // Return masked phone for frontend display
    return { maskedPhone };
  }

  /**
   * Retire SMS MFA devices after the account phone changed during setup.
   *
   * Mirrors `UserService.updateUserAttributes()`: the devices were bound to the old number,
   * so they are deleted, the removal is audited, and MFA is switched off when no active
   * device of any type remains (the user is mid-enrolment and will re-enable it on verify).
   *
   * @param userId - Internal user ID
   * @param sub - User external identifier (for logs)
   * @param oldPhone - Phone the devices were tied to
   * @param newPhone - Phone now on file (unverified)
   */
  private async retireSmsDevicesForPhoneChange(
    userId: number,
    sub: string,
    oldPhone: string,
    newPhone: string,
  ): Promise<void> {
    const smsDevices = (await this.mfaDeviceRepository.find({
      where: { userId, type: MFAMethod.SMS, isActive: true },
    } as Record<string, unknown>)) as unknown as Array<{ id: number }>;

    if (smsDevices.length === 0) {
      return;
    }

    this.logger?.log?.(
      `Deleting ${smsDevices.length} SMS MFA device(s) for user ${sub} due to phone number change during SMS MFA setup`,
    );
    for (const device of smsDevices) {
      await this.mfaDeviceRepository.delete(device.id);
    }

    try {
      await this.auditService?.recordEvent({
        userId,
        eventType: AuthAuditEventType.MFA_DEVICE_REMOVED,
        eventStatus: 'INFO',
        reason: 'phone_changed',
        description: 'SMS MFA device(s) removed due to phone number change during SMS MFA setup',
        metadata: {
          method: MFAMethod.SMS,
          deletedCount: smsDevices.length,
          oldPhone: this.maskPhone(oldPhone),
          newPhone: this.maskPhone(newPhone),
          reason: 'phone_number_changed_requires_reverification',
        },
      });
    } catch (auditError) {
      const errorMessage = auditError instanceof Error ? auditError.message : 'Unknown error';
      this.logger?.error?.(`Failed to record MFA_DEVICE_REMOVED audit event for phone change: ${errorMessage}`, {
        error: auditError,
        userId,
      });
    }

    const remaining = (await this.mfaDeviceRepository.find({
      where: { userId, isActive: true },
    } as Record<string, unknown>)) as unknown as Array<{ id: number }>;
    if (remaining.length === 0) {
      await this.userRepository.update({ id: userId }, {
        mfaEnabled: false,
        mfaMethods: [],
        preferredMfaMethod: null,
      } as unknown as Record<string, unknown>);
      this.logger?.log?.(`MFA disabled for user ${sub} - no active MFA devices remaining after phone change`);
    }
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
   * The device is always bound to the phone on the account (`user.phone`), which the code
   * just verified. `verificationData.phoneNumber` is optional and only a consistency check:
   * when supplied it must equal the account phone. Change the number with `setup()` instead.
   *
   * @param verificationData - Verification data (VerifySMSMFASetupDTO, plus `challengeSessionId` when called from a challenge)
   * @param deviceName - Optional device name override
   * @returns MFA device ID (created or existing)
   * @throws {NAuthException} VALIDATION_FAILED | PHONE_REQUIRED | VERIFICATION_CODE_INVALID | VERIFICATION_CODE_EXPIRED | VERIFICATION_TOO_MANY_ATTEMPTS
   *
   * @example
   * ```typescript
   * const deviceId = await provider.verifySetup({ code: '123456' });
   * ```
   */
  async verifySetup(verificationData: unknown, deviceName?: string): Promise<number> {
    const user = this.getCurrentUserOrThrow();
    this.logger?.log?.(`Verifying SMS MFA setup for user: ${user.sub}`);

    const dto = verificationData as (VerifySMSMFASetupDTO & { challengeSessionId?: number }) | undefined;
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

      if (!dto?.code || dto.code.trim() === '') {
        throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'Verification code is required');
      }

      try {
        // Verify phone with code - this will mark phone as verified in the database.
        // Scope the lookup to the challenge session when the code was issued for one.
        const verifyDto = new VerifyPhoneWithCodeBySubDTO();
        verifyDto.sub = user.sub;
        verifyDto.code = dto.code;
        verifyDto.challengeSessionId = dto.challengeSessionId;
        await this.phoneVerificationService.verifyPhoneWithCodeBySub(verifyDto);
        this.logger?.log?.(
          `Phone verified during SMS MFA setup for user ${user.sub} - phone is now marked as verified in database`,
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger?.error?.(
          `Failed to verify phone during SMS MFA setup for user ${user.sub}: ${errorMessage}`,
          error,
        );
        // Preserve specific codes (expired, too many attempts, phone required); wrap only unknown errors
        if (error instanceof NAuthException) {
          throw error;
        }
        throw new NAuthException(AuthErrorCode.VERIFICATION_CODE_INVALID, 'Invalid SMS code');
      }
    } else {
      // Phone already verified - skip code verification
      this.logger?.log?.(
        `Phone already verified for user ${user.sub}, skipping SMS code verification during MFA setup`,
      );
    }

    // ============================================================================
    // Bind the device to the (now verified) phone on the account, never to a
    // caller-supplied number.
    // ============================================================================
    const freshUser = (await this.userRepository.findOne({ where: { id: userId } })) as unknown as Record<
      string,
      unknown
    > | null;
    const accountPhone = (freshUser?.phone as string | null | undefined) || undefined;
    if (!accountPhone) {
      throw new NAuthException(AuthErrorCode.PHONE_REQUIRED, 'No phone number associated with this account');
    }
    const suppliedPhone =
      typeof dto?.phoneNumber === 'string' && dto.phoneNumber.trim() !== ''
        ? dto.phoneNumber.replace(/\s/g, '')
        : undefined;
    if (suppliedPhone && suppliedPhone !== accountPhone) {
      throw new NAuthException(
        AuthErrorCode.VALIDATION_FAILED,
        'Phone number does not match the number on this account. Call setup again with the new number.',
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
        phoneNumber: accountPhone,
        isActive: true,
        isPrimary: !userMfaEnabled, // First device becomes primary
      },
      { dedupeWhere: {} },
    );

    // A reused (deduped) device may carry a stale number or be inactive; align it with the account
    if (device.phoneNumber !== accountPhone || !device.isActive) {
      await this.mfaDeviceRepository.update(device.id, { phoneNumber: accountPhone, isActive: true } as Record<
        string,
        unknown
      >);
    }

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
   * @param challengeSessionId - Optional challenge session ID to link the code to the session
   * @returns Masked phone number where code was sent
   * @throws {NAuthException} If no SMS device registered or phone verification service unavailable
   *
   * @example
   * ```typescript
   * const maskedPhone = await provider.sendChallenge(123);
   * // Returns: '***-***-1234'
   * ```
   */
  async sendChallenge(challengeSessionId?: number): Promise<string> {
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
    sendDto.challengeSessionId = challengeSessionId;
    await this.phoneVerificationService.sendVerificationSMS(sendDto);

    this.logger?.log?.(`SMS MFA code sent for user: ${user.sub}`);

    return this.maskPhone(phoneNumber);
  }
}
