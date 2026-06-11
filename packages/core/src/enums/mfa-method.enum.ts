/**
 * MFA Method Enum
 *
 * Defines all supported Multi-Factor Authentication methods.
 * Used throughout the codebase to ensure type safety and consistency.
 *
 * **Device Methods** (require device setup):
 * - TOTP: Time-based One-Time Password (authenticator apps)
 * - SMS: SMS verification codes
 * - EMAIL: Email verification codes
 * - PASSKEY: WebAuthn/FIDO2 passkeys (biometric, security keys)
 *
 * **Verification Methods** (available for verification):
 * - Includes all device methods
 * - BACKUP: Backup recovery codes (single-use codes, not a device)
 *
 * @example
 * ```typescript
 * import { MFAMethod, MFADeviceMethod, MFAVerificationMethod } from '@nauth-toolkit/core';
 *
 * // Device methods only
 * const deviceMethod: MFADeviceMethod = MFAMethod.TOTP;
 *
 * // Verification methods (includes backup)
 * const verificationMethod: MFAVerificationMethod = MFAMethod.BACKUP;
 *
 * // Check if method is a device method
 * if (method !== MFAMethod.BACKUP) {
 *   // This is a device method
 * }
 * ```
 */

/**
 * All supported MFA methods
 *
 * Use this enum instead of string literals throughout the codebase.
 */
export enum MFAMethod {
  /**
   * Time-based One-Time Password
   * Authenticator apps (Google Authenticator, Authy, Microsoft Authenticator, etc.)
   */
  TOTP = 'totp',

  /**
   * SMS verification codes
   * Sends one-time codes via text message
   */
  SMS = 'sms',

  /**
   * Email verification codes
   * Sends one-time codes via email
   */
  EMAIL = 'email',

  /**
   * WebAuthn/FIDO2 passkeys
   * Biometric authentication (Face ID, Touch ID, Windows Hello)
   * Hardware security keys (YubiKey, etc.)
   */
  PASSKEY = 'passkey',

  /**
   * Backup recovery codes
   * Single-use recovery codes when MFA devices are unavailable
   * Not a device method - only available for verification
   */
  BACKUP = 'backup',
}

/**
 * Device MFA methods (methods that require device setup)
 *
 * Excludes BACKUP as it's not a device method.
 */
export type MFADeviceMethod = MFAMethod.TOTP | MFAMethod.SMS | MFAMethod.EMAIL | MFAMethod.PASSKEY;

/**
 * Verification MFA methods (all methods available for verification)
 *
 * Includes all device methods plus BACKUP codes.
 */
export type MFAVerificationMethod = MFADeviceMethod | MFAMethod.BACKUP;

/**
 * Array of all device methods
 *
 * Useful for defaults and iteration.
 */
export const MFADeviceMethods: readonly MFADeviceMethod[] = [
  MFAMethod.TOTP,
  MFAMethod.SMS,
  MFAMethod.EMAIL,
  MFAMethod.PASSKEY,
] as const;
