"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MFADeviceMethods = exports.MFAMethod = void 0;
/**
 * All supported MFA methods
 *
 * Use this enum instead of string literals throughout the codebase.
 */
var MFAMethod;
(function (MFAMethod) {
    /**
     * Time-based One-Time Password
     * Authenticator apps (Google Authenticator, Authy, Microsoft Authenticator, etc.)
     */
    MFAMethod["TOTP"] = "totp";
    /**
     * SMS verification codes
     * Sends one-time codes via text message
     */
    MFAMethod["SMS"] = "sms";
    /**
     * Email verification codes
     * Sends one-time codes via email
     */
    MFAMethod["EMAIL"] = "email";
    /**
     * WebAuthn/FIDO2 passkeys
     * Biometric authentication (Face ID, Touch ID, Windows Hello)
     * Hardware security keys (YubiKey, etc.)
     */
    MFAMethod["PASSKEY"] = "passkey";
    /**
     * Backup recovery codes
     * Single-use recovery codes when MFA devices are unavailable
     * Not a device method - only available for verification
     */
    MFAMethod["BACKUP"] = "backup";
})(MFAMethod || (exports.MFAMethod = MFAMethod = {}));
/**
 * Array of all device methods
 *
 * Useful for defaults and iteration.
 */
exports.MFADeviceMethods = [
    MFAMethod.TOTP,
    MFAMethod.SMS,
    MFAMethod.EMAIL,
    MFAMethod.PASSKEY,
];
