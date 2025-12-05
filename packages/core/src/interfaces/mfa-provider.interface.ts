import { IUser } from './entities.interface';

/**
 * MFA Provider Service Interface
 *
 * Defines the contract that all MFA provider services must implement.
 * Each MFA method (TOTP, SMS, Passkey) is a separate provider that extends
 * the base class and implements this interface.
 *
 * Provider-specific types (e.g., SetupTOTPResponseDTO) are defined in each
 * provider package, not in core, to maintain proper separation of concerns.
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class TOTPMFAProviderService extends BaseMFAProviderService implements IMFAProviderService {
 *   readonly methodName = 'totp';
 *
 *   async setup(user: IUser): Promise<unknown> {
 *     // TOTP-specific setup logic
 *   }
 *
 *   async verify(user: IUser, code: string, deviceId?: number): Promise<boolean> {
 *     // TOTP verification logic
 *   }
 * }
 * ```
 */
export interface IMFAProviderService {
  /**
   * Unique method name for this MFA provider
   * Examples: 'totp', 'sms', 'passkey'
   */
  readonly methodName: string;

  /**
   * Check if this MFA method is allowed by configuration
   *
   * @returns True if method is allowed
   */
  isMethodAllowed(): boolean;

  /**
   * Setup MFA device for user
   *
   * Initiates the setup process for this MFA method.
   * Provider-specific setup data is returned.
   *
   * @param user - User setting up MFA
   * @returns Provider-specific setup data (e.g., QR code for TOTP, options for Passkey)
   * @throws {NAuthException} If method is not allowed or setup fails
   *
   * @example
   * ```typescript
   * // TOTP provider returns { secret, qrCode, manualEntryKey }
   * const setupData = await totpProvider.setup(user);
   *
   * // Passkey provider returns WebAuthn registration options
   * const options = await passkeyProvider.setup(user);
   * ```
   */
  setup(user: IUser, setupData?: unknown): Promise<unknown>;

  /**
   * Verify and complete MFA setup
   *
   * Validates the verification code/credential and creates the MFA device.
   *
   * @param user - User completing setup
   * @param verificationData - Provider-specific verification data (code, credential, etc.)
   * @param deviceName - Optional device name
   * @returns Created MFA device ID
   * @throws {NAuthException} If verification fails
   *
   * @example
   * ```typescript
   * // TOTP: verificationData = { secret, code }
   * const deviceId = await totpProvider.verifySetup(user, { secret: '...', code: '123456' });
   *
   * // SMS: verificationData = { phoneNumber, code }
   * const deviceId = await smsProvider.verifySetup(user, { phoneNumber: '+1234567890', code: '123456' });
   *
   * // Passkey: verificationData = { credential, challenge }
   * const deviceId = await passkeyProvider.verifySetup(user, { credential: {...}, challenge: '...' });
   * ```
   */
  verifySetup(user: IUser, verificationData: unknown, deviceName?: string): Promise<number>;

  /**
   * Verify MFA code/credential during authentication
   *
   * Validates the MFA code or credential for an existing device.
   *
   * @param user - User being authenticated
   * @param code - MFA code or credential (provider-specific)
   * @param deviceId - Optional device ID to verify against (if not provided, finds active device)
   * @returns True if verification succeeds
   * @throws {NAuthException} If device not found or verification fails
   *
   * @example
   * ```typescript
   * // TOTP: code = '123456'
   * const isValid = await totpProvider.verify(user, '123456');
   *
   * // SMS: code = '123456'
   * const isValid = await smsProvider.verify(user, '123456');
   *
   * // Passkey: code = { credential: {...}, challenge: '...' }
   * const isValid = await passkeyProvider.verify(user, { credential: {...}, challenge: '...' });
   * ```
   */
  verify(user: IUser, code: unknown, deviceId?: number): Promise<boolean>;

  /**
   * Send verification code/challenge for authentication
   *
   * Used during login to send SMS code or generate passkey challenge.
   * Not applicable for TOTP (user generates code locally).
   *
   * @param user - User requesting verification
   * @returns Provider-specific challenge data (e.g., masked phone for SMS, WebAuthn options for Passkey)
   * @throws {NAuthException} If no device registered or send fails
   *
   * @example
   * ```typescript
   * // SMS: returns masked phone number
   * const maskedPhone = await smsProvider.sendChallenge(user); // '***-***-1234'
   *
   * // Passkey: returns WebAuthn authentication options
   * const options = await passkeyProvider.sendChallenge(user); // { challenge: '...', ... }
   * ```
   */
  sendChallenge?(user: IUser): Promise<unknown>; // Optional - only providers like SMS need it

  /**
   * Generate backup codes for user
   *
   * Creates single-use recovery codes that can be used when MFA devices are unavailable.
   * Provided by BaseMFAProviderService for all providers.
   *
   * @param user - User to generate codes for
   * @returns Generated backup codes (plain text - shown only once)
   *
   * @example
   * ```typescript
   * const codes = await provider.generateBackupCodes?.(user);
   * // Returns: ['ABC12345', 'DEF67890', ...]
   * ```
   */
  generateBackupCodes?(user: IUser): Promise<string[]>; // Optional - provided by BaseMFAProviderService
}

// Helper type to check if a provider implements sendChallenge
export type MFAProviderWithChallenge = IMFAProviderService & Required<Pick<IMFAProviderService, 'sendChallenge'>>;
