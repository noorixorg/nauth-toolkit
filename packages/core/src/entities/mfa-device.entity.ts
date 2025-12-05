import { MFADeviceMethod } from '../enums/mfa-method.enum';

/**
 * Base MFA Device Entity
 *
 * Stores multi-factor authentication device registrations.
 * Supports multiple MFA methods: TOTP (authenticator apps), SMS, Email, and Passkeys (WebAuthn).
 * Database adapters extend this class and add ORM-specific decorators.
 *
 * @remarks
 * Each user can register multiple MFA devices of different types for redundancy.
 * Devices can be enabled/disabled without deletion for security audit purposes.
 * This class is database-agnostic. TypeORM, Prisma, or other ORMs
 * extend this class in their respective packages.
 *
 * @example
 * ```typescript
 * // Create TOTP device
 * const totpDevice = new MFADevice();
 * totpDevice.userId = user.id;
 * totpDevice.type = 'totp';
 * totpDevice.name = 'Google Authenticator';
 * totpDevice.secret = encryptedSecret;
 * totpDevice.isActive = true;
 *
 * // Create Passkey device
 * const passkeyDevice = new MFADevice();
 * passkeyDevice.userId = user.id;
 * passkeyDevice.type = 'passkey';
 * passkeyDevice.name = 'iPhone 15 Pro';
 * passkeyDevice.credentialId = 'credential-id-here';
 * passkeyDevice.publicKey = 'public-key-here';
 * passkeyDevice.counter = 0;
 * passkeyDevice.isActive = true;
 * ```
 */
export class BaseMFADevice {
  /**
   * Internal device ID (auto-increment integer)
   */
  id!: number;

  /**
   * Internal user ID (foreign key to users table)
   * References the user who owns this MFA device
   */
  userId!: number;

  /**
   * MFA method type
   *
   * - 'totp': Time-based One-Time Password (Google Authenticator, Authy, etc.)
   * - 'sms': SMS-based verification codes
   * - 'email': Email-based verification codes
   * - 'passkey': WebAuthn/FIDO2 passkeys (biometric, security keys)
   */
  type!: MFADeviceMethod;

  /**
   * User-friendly device name
   * Helps users identify their devices (e.g., "iPhone 15 Pro", "Google Authenticator")
   */
  name!: string;

  /**
   * TOTP secret (encrypted)
   * Used only for TOTP devices
   * ⚠️ SECURITY: Must be encrypted at rest
   */
  secret?: string | null;

  /**
   * Phone number for SMS MFA
   * Used only for SMS devices
   * Must be in E.164 format (e.g., +1234567890)
   */
  phoneNumber?: string | null;

  /**
   * Email address for Email MFA
   * Used only for Email devices
   * Must be a valid email address format
   */
  email?: string | null;

  /**
   * WebAuthn credential ID (base64url encoded)
   * Unique identifier for this passkey
   * Used only for passkey devices
   */
  credentialId?: string | null;

  /**
   * WebAuthn public key (base64url encoded)
   * Used to verify passkey signatures
   * Used only for passkey devices
   */
  publicKey?: string | null;

  /**
   * WebAuthn signature counter
   * Incremented with each authentication to prevent replay attacks
   * Used only for passkey devices
   */
  counter?: number | null;

  /**
   * WebAuthn transports (USB, NFC, BLE, internal)
   * Helps browser suggest the right authentication method
   * Used only for passkey devices
   */
  transports?: string[] | null;

  /**
   * Whether this device is currently active
   * Inactive devices cannot be used for authentication but remain in database for audit
   */
  isActive!: boolean;

  /**
   * Whether this is the user's preferred/primary MFA method
   * Used to pre-select MFA method during authentication
   */
  isPrimary!: boolean;

  /**
   * Last time this device was used for authentication
   */
  lastUsedAt?: Date | null;

  /**
   * Number of times this device has been used
   * Useful for analytics and detecting suspicious patterns
   */
  usageCount!: number;

  /**
   * Additional device metadata (browser, OS, IP on registration, etc.)
   */
  metadata?: Record<string, unknown> | null;

  /**
   * Device registration timestamp
   */
  createdAt!: Date;

  /**
   * Last update timestamp
   */
  updatedAt!: Date;
}
