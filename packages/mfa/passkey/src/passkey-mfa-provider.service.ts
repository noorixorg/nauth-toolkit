import { Repository } from 'typeorm';
// Public API imports
import {
  BaseMFADevice,
  BaseUser,
  IMFADevice,
  NAuthConfig,
  NAuthLogger,
  NAuthException,
  AuthErrorCode,
  MFAMethod,
  ClientInfoService,
} from '@nauth-toolkit/core';
// Internal API imports (for provider implementations)
import { BaseMFAProviderService, ChallengeService, AuthAuditService } from '@nauth-toolkit/core/internal';
import { PasskeyService } from './passkey.service';
import { SetupPasskeyResponseDTO, VerifyPasskeySetupDTO, GetPasskeyChallengeResponseDTO } from './dto/mfa.dto';
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/types';

/**
 * Passkey MFA Provider Service
 *
 * Implements Passkey/WebAuthn as a Multi-Factor Authentication (MFA) method.
 * Extends BaseMFAProviderService to provide Passkey-specific functionality.
 *
 * Note: Passkeys are currently implemented exclusively as MFA (secondary factor
 * after password authentication). Users can enroll multiple passkey devices
 * (e.g., phone biometric, browser-based, hardware security keys) for redundancy.
 * Passwordless passkey login is planned for a future release.
 *
 * This service handles:
 * - WebAuthn registration (passkey setup) - supports multiple devices per user
 * - WebAuthn authentication (passkey verification) - works with any registered device
 * - Challenge generation for setup and authentication
 * - MFA device creation for Passkeys
 *
 * @example
 * ```typescript
 * @Module({
 *   imports: [PasskeyMFAModule],
 * })
 * export class AppModule {}
 * ```
 */

export class PasskeyMFAProviderService extends BaseMFAProviderService {
  readonly methodName = MFAMethod.PASSKEY;

  constructor(
    mfaDeviceRepository: Repository<BaseMFADevice>,
    userRepository: Repository<BaseUser>,
    config: NAuthConfig,
    logger: NAuthLogger,
    passwordService: unknown,
    private readonly passkeyService: PasskeyService,
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
   * Setup Passkey for user
   *
   * Generates WebAuthn registration options.
   * Client must pass these to navigator.credentials.create().
   *
   * @param user - User setting up Passkey
   * @param _setupData - Not used for Passkey
   * @returns WebAuthn registration options
   * @throws {NAuthException} If Passkey is not enabled
   *
   * @example
   * ```typescript
   * const options = await provider.setup(user);
   * // Client calls navigator.credentials.create({ publicKey: options.options })
   * ```
   */
  async setup(_setupData?: unknown): Promise<SetupPasskeyResponseDTO> {
    const user = this.getCurrentUserOrThrow();
    this.logger?.log?.(`Setting up passkey for user: ${user.sub}`);

    // Check if passkey is allowed
    if (!this.isMethodAllowed()) {
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'Passkey is not enabled', { feature: 'passkey' });
    }

    // Get existing passkeys to exclude
    const userEntity = user as unknown as Record<string, unknown>;
    const userId = userEntity.id as number;
    const existingDevices = await this.getUserDevices(userId);

    // Generate registration options
    const options = await this.passkeyService.generateRegistrationOptions(
      user.sub,
      user.email,
      `${(userEntity.firstName as string) || ''} ${(userEntity.lastName as string) || ''}`.trim() || user.email,
      existingDevices,
    );

    this.logger?.log?.(`Passkey registration options generated for user: ${user.sub}`);

    return options;
  }

  /**
   * Verify and complete Passkey setup
   *
   * Validates the WebAuthn credential and stores the device if valid.
   *
   * **Race Condition Safety:**
   * Device creation uses a transaction with pessimistic locking.
   * Passkeys are de-duplicated by `(userId, type, credentialId)` to avoid registering the same
   * credential multiple times (e.g., due to retries or concurrent requests).
   *
   * @param user - User completing Passkey setup
   * @param verificationData - Verification data (must be { credential: VerifyPasskeySetupDTO, expectedChallenge: string })
   * @param deviceName - Optional device name override
   * @returns MFA device ID (created or existing)
   * @throws {NAuthException} If verification fails
   *
   * @example
   * ```typescript
   * const deviceId = await provider.verifySetup(user, {
   *   credential: { credential: webAuthnCredential, expectedChallenge: challenge }
   * }, 'iPhone 15 Pro');
   * ```
   */
  async verifySetup(verificationData: unknown, deviceName?: string): Promise<number> {
    const user = this.getCurrentUserOrThrow();
    this.logger?.log?.(`Verifying passkey setup for user: ${user.sub}`);

    // Extract credential and challenge from verificationData
    // verificationData should be { credential: VerifyPasskeySetupDTO, expectedChallenge: string }
    let dto: VerifyPasskeySetupDTO;
    let expectedChallenge: string;
    let transports: string[] | undefined;

    if (
      verificationData &&
      typeof verificationData === 'object' &&
      'credential' in verificationData &&
      'expectedChallenge' in verificationData
    ) {
      // Wrapped with challenge and optional transports
      const wrapped = verificationData as {
        credential: VerifyPasskeySetupDTO;
        expectedChallenge: string;
        transports?: string[];
      };
      dto = wrapped.credential;
      expectedChallenge = wrapped.expectedChallenge;
      transports = wrapped.transports;

      // Validate challenge is present
      if (!expectedChallenge || typeof expectedChallenge !== 'string' || expectedChallenge.trim().length === 0) {
        throw new NAuthException(
          AuthErrorCode.VALIDATION_FAILED,
          'Expected challenge is required and must be a non-empty string',
        );
      }

      // Validate credential structure
      if (!dto.credential || typeof dto.credential !== 'object') {
        throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'Credential is required and must be an object');
      }

      const cred = dto.credential as Record<string, unknown>;
      if (!cred.id || !cred.rawId || !cred.response) {
        throw new NAuthException(
          AuthErrorCode.VALIDATION_FAILED,
          'Credential must have id, rawId, and response fields',
        );
      }

      const response = cred.response as Record<string, unknown>;
      if (!response.clientDataJSON || !response.attestationObject) {
        throw new NAuthException(
          AuthErrorCode.VALIDATION_FAILED,
          'Credential response must have clientDataJSON and attestationObject fields',
        );
      }
    } else {
      throw new NAuthException(
        AuthErrorCode.VALIDATION_FAILED,
        'Passkey verification requires { credential, expectedChallenge }. Use MFAService.verifySetup or provide both.',
      );
    }

    // Verify passkey registration with transports (if provided)
    // VerifyPasskeySetupDTO.credential should match RegistrationResponseJSON
    // Transports help identify authenticator type (platform vs cross-platform)
    const verified = await this.passkeyService.verifyRegistration(
      dto.credential as unknown as RegistrationResponseJSON,
      expectedChallenge,
      transports, // Pass transports from client to help identify authenticator type
    );

    if (!verified.verified) {
      throw new NAuthException(AuthErrorCode.VALIDATION_FAILED, 'Passkey verification failed');
    }

    // Get user entity for MFA status check
    const userEntity = user as unknown as Record<string, unknown>;
    const userId = userEntity.id as number;
    const userMfaEnabled = (userEntity.mfaEnabled as boolean) || false;

    // ============================================================================
    // Create MFA device (transaction-safe, credentialId de-dup)
    // ============================================================================
    // WARNING: For passkeys, de-duplication must be based on credentialId (not method-only),
    // otherwise users would be limited to a single passkey per account.
    const device = await this.createDevice(
      userId,
      {
        name: deviceName || dto.deviceName || 'Passkey Device',
        credentialId: verified.credentialId,
        publicKey: verified.publicKey,
        counter: verified.counter,
        transports: verified.transports,
        isActive: true,
        isPrimary: !userMfaEnabled, // First device becomes primary
      },
      { dedupeWhere: { credentialId: verified.credentialId } },
    );

    // Enable MFA if not already enabled
    await this.enableMFAForUser(user);

    this.logger?.log?.(`Passkey setup completed for user: ${user.sub}`);

    return device.id;
  }

  /**
   * Verify Passkey during authentication
   *
   * Validates WebAuthn assertion against stored public key.
   *
   * @param user - User being authenticated
   * @param code - Verification data (must be { credential: AuthenticationResponseJSON, expectedChallenge: string })
   * @param deviceId - Optional device ID to verify against
   * @returns True if verification succeeds
   * @throws {NAuthException} If device not found or verification fails
   *
   * @example
   * ```typescript
   * const isValid = await provider.verify(user, {
   *   credential: webAuthnCredential,
   *   expectedChallenge: challenge
   * });
   * ```
   */
  async verify(code: unknown, deviceId?: number): Promise<boolean> {
    const user = this.getCurrentUserOrThrow();
    this.logger?.log?.(`Verifying passkey for user: ${user.sub}`);

    // Extract credential and challenge
    let credential: AuthenticationResponseJSON;
    let expectedChallenge: string;

    if (code && typeof code === 'object' && 'credential' in code && 'expectedChallenge' in code) {
      const data = code as { credential: AuthenticationResponseJSON; expectedChallenge: string };
      credential = data.credential;
      expectedChallenge = data.expectedChallenge;
    } else {
      this.logger?.warn?.('Invalid passkey verification data format');
      return false;
    }

    // Get user entity
    const userEntity = user as unknown as Record<string, unknown>;
    const userId = userEntity.id as number;

    // Find device by credential ID
    const device = deviceId
      ? await this.findDevice(userId, deviceId)
      : await this.mfaDeviceRepository.findOne({
          where: {
            userId,
            type: MFAMethod.PASSKEY,
            credentialId: credential.id,
            isActive: true,
          },
        } as Record<string, unknown>);

    if (!device) {
      this.logger?.warn?.('Passkey device not found');
      return false;
    }

    try {
      // Verify passkey
      // Cast device to IMFADevice since it came from repository and matches interface structure
      const result = await this.passkeyService.verifyAuthentication(
        credential,
        expectedChallenge,
        device as unknown as IMFADevice,
      );

      if (result.verified) {
        // Update device counter and usage
        const deviceEntity = device as unknown as Record<string, unknown>;
        deviceEntity.counter = result.newCounter;
        deviceEntity.lastUsedAt = new Date();
        deviceEntity.usageCount = ((deviceEntity.usageCount as number) || 0) + 1;
        await this.mfaDeviceRepository.save(deviceEntity as Record<string, unknown>);

        this.logger?.log?.(`Passkey verified successfully for user: ${user.sub}`);
        return true;
      }
    } catch (error) {
      this.logger?.error?.('Passkey verification error', error);
    }

    return false;
  }

  /**
   * Send Passkey challenge for MFA verification
   *
   * Generates WebAuthn authentication options for login.
   * Client must pass these to navigator.credentials.get().
   *
   * @param user - User requesting Passkey challenge
   * @returns WebAuthn authentication options
   * @throws {NAuthException} If no Passkey device registered
   *
   * @example
   * ```typescript
   * const options = await provider.sendChallenge(user);
   * // Client calls navigator.credentials.get({ publicKey: options.options })
   * ```
   */
  async sendChallenge(): Promise<GetPasskeyChallengeResponseDTO> {
    const user = this.getCurrentUserOrThrow();
    this.logger?.log?.(`Generating passkey challenge for user: ${user.sub}`);

    // Get user's passkey devices
    const userEntity = user as unknown as Record<string, unknown>;
    const userId = userEntity.id as number;
    const devices = await this.getUserDevices(userId);
    const passkeyDevices = devices.filter((d) => d.type === MFAMethod.PASSKEY && d.isActive);

    if (passkeyDevices.length === 0) {
      throw new NAuthException(AuthErrorCode.NOT_FOUND, 'No passkey devices registered', { deviceType: 'passkey' });
    }

    // Generate authentication options
    const options = await this.passkeyService.generateAuthenticationOptions(passkeyDevices);

    this.logger?.log?.(`Passkey challenge generated for user: ${user.sub}`);

    return options;
  }
}
