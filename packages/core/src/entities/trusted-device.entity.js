"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseTrustedDevice = void 0;
/**
 * Base Trusted Device Entity
 *
 * Stores trusted device information for MFA "remember device" feature.
 * Devices marked as trusted can skip MFA verification for a configured period.
 * Uses HttpOnly cookies for secure device token storage.
 *
 * @remarks
 * Each user can have multiple trusted devices. Each record represents one device
 * that has been marked as trusted after successful MFA verification.
 * Trust persists across logouts and session expiration.
 *
 * Database adapters extend this class and add ORM-specific decorators.
 *
 * @example
 * ```typescript
 * // Trust a device after MFA verification
 * const trustedDevice = new TrustedDevice();
 * trustedDevice.userId = user.id;
 * trustedDevice.deviceTokenHash = hashToken(deviceToken);
 * trustedDevice.trustedUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
 * trustedDevice.deviceName = 'iPhone 15 Pro';
 * trustedDevice.deviceType = 'mobile';
 * ```
 */
var BaseTrustedDevice = /** @class */ (function () {
    function BaseTrustedDevice() {
    }
    return BaseTrustedDevice;
}());
exports.BaseTrustedDevice = BaseTrustedDevice;
