import { Repository } from 'typeorm';
// Public API imports
import {
  BaseMFADevice,
  BaseUser,
  NAuthConfig,
  NAuthLogger,
  NAuthException,
  AuthErrorCode,
  MFAMethod,
  ClientInfoService,
} from '@nauth-toolkit/core';
// Internal API imports (for provider implementations)
import { BaseMFAProviderService, ChallengeService, AuthAuditService } from '@nauth-toolkit/core/internal';
import { TOTPService } from './totp.service';
import { SetupTOTPResponseDTO, VerifyTOTPSetupDTO } from './dto/mfa.dto';

/**
 * TOTP MFA Provider Service
 *
 * Implements TOTP (Time-based One-Time Password) MFA method.
 * Extends BaseMFAProviderService to provide TOTP-specific functionality.
 *
 * This service handles:
 * - TOTP secret generation and QR code creation
 * - TOTP code verification during setup and authentication
 * - MFA device creation for TOTP
 *
 * @example
 * ```typescript
 * @Module({
 *   imports: [TOTPMFAModule],
 * })
 * export class AppModule {}
 * ```
 */

export class TOTPMFAProviderService extends BaseMFAProviderService {
  readonly methodName = MFAMethod.TOTP;

  constructor(
    mfaDeviceRepository: Repository<BaseMFADevice>,
    userRepository: Repository<BaseUser>,
    config: NAuthConfig,
    logger: NAuthLogger,
    passwordService: unknown,
    private readonly totpService: TOTPService,
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
   * Setup TOTP for user
   *
   * Generates TOTP secret and QR code for authenticator app setup.
   * User must scan QR code and verify with a code to complete setup.
   *
   * @param user - User setting up TOTP
   * @param _setupData - Not used for TOTP
   * @returns TOTP setup information (secret, QR code, manual entry key)
   * @throws {NAuthException} If TOTP is not enabled
   *
   * @example
   * ```typescript
   * const setup = await provider.setup(user);
   * // Client displays setup.qrCode and setup.manualEntryKey
   * ```
   */
  async setup(_setupData?: unknown): Promise<SetupTOTPResponseDTO> {
    const user = this.getCurrentUserOrThrow();
    this.logger?.log?.(`Setting up TOTP for user: ${user.sub}`);

    // Check if TOTP is allowed
    if (!this.isMethodAllowed()) {
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'TOTP is not enabled', { feature: 'totp' });
    }

    // Generate secret and QR code
    const setup = await this.totpService.generateSecret(user.email);

    this.logger?.log?.(`TOTP setup initiated for user: ${user.sub}`);

    return setup;
  }

  /**
   * Verify and complete TOTP setup
   *
   * Validates the TOTP code and stores the device if valid.
   * Enables MFA for user if this is their first device.
   *
   * **Race Condition Safety:**
   * Device creation uses a transaction with pessimistic locking.
   *
   * Note: NAuth supports multiple TOTP devices per user for redundancy (e.g., phone + password manager).
   *
   * @param user - User completing TOTP setup
   * @param verificationData - Verification data (must be VerifyTOTPSetupDTO)
   * @param deviceName - Optional device name override
   * @returns MFA device ID (created or existing)
   * @throws {NAuthException} If code is invalid
   *
   * @example
   * ```typescript
   * const deviceId = await provider.verifySetup(user, {
   *   secret: 'base32secret',
   *   code: '123456',
   *   deviceName: 'Google Authenticator'
   * });
   * ```
   */
  async verifySetup(verificationData: unknown, deviceName?: string): Promise<number> {
    const user = this.getCurrentUserOrThrow();
    this.logger?.log?.(`Verifying TOTP setup for user: ${user.sub}`);

    const dto = verificationData as VerifyTOTPSetupDTO;

    // Validate secret format
    if (!this.totpService.isValidSecret(dto.secret)) {
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'Invalid TOTP secret', { field: 'secret' });
    }

    // Verify code
    const result = await this.totpService.verifyCodeWithDetails(dto.secret, dto.code);
    if (!result.valid) {
      throw new NAuthException(AuthErrorCode.VERIFICATION_CODE_INVALID, result.error || 'Invalid TOTP code');
    }

    // Get user entity for MFA status check
    const userEntity = user as unknown as Record<string, unknown>;
    const userId = userEntity.id as number;
    const userMfaEnabled = (userEntity.mfaEnabled as boolean) || false;

    // ============================================================================
    // Create MFA device (transaction-safe, multi-device)
    // ============================================================================
    // We intentionally do NOT de-duplicate TOTP devices: users can register multiple authenticators.
    const device = await this.createDevice(userId, {
      name: deviceName || dto.deviceName || 'Authenticator App',
      secret: dto.secret, // TODO: Encrypt at rest in production
      isActive: true,
      isPrimary: !userMfaEnabled, // First device becomes primary
    });

    // Enable MFA if not already enabled
    await this.enableMFAForUser(user);

    this.logger?.log?.(`TOTP setup completed for user: ${user.sub}`);

    return device.id;
  }

  /**
   * Verify TOTP code during authentication
   *
   * Validates the TOTP code for an existing device.
   *
   * @param user - User being authenticated
   * @param code - TOTP code (string)
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
    this.logger?.log?.(`Verifying TOTP code for user: ${user.sub}`);

    const totpCode = code as string;
    if (!totpCode || typeof totpCode !== 'string') {
      this.logger?.warn?.('Invalid TOTP code format');
      return false;
    }

    // Get user entity
    const userEntity = user as unknown as Record<string, unknown>;
    const userId = userEntity.id as number;

    // Find device
    const device = await this.findDevice(userId, deviceId);
    if (!device || !device.secret) {
      this.logger?.warn?.(`No active TOTP device found for user: ${user.sub}`);
      return false;
    }

    // Verify code
    const isValid = await this.totpService.verifyCode(device.secret, totpCode);

    if (isValid) {
      // Update device usage
      await this.updateDeviceUsage(device.id);
      this.logger?.log?.(`TOTP code verified successfully for user: ${user.sub}`);
    } else {
      this.logger?.warn?.(`TOTP code verification failed for user: ${user.sub}`);
    }

    return isValid;
  }

  // TOTP doesn't need sendChallenge (user generates code locally)
  // sendChallenge is optional in IMFAProviderService, so we don't need to implement it
}
