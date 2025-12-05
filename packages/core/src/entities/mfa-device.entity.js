"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseMFADevice = void 0;
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
var BaseMFADevice = /** @class */ (function () {
    function BaseMFADevice() {
    }
    return BaseMFADevice;
}());
exports.BaseMFADevice = BaseMFADevice;
