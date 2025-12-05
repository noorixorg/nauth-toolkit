"use strict";
/**
 * Trust Device Response DTO
 *
 * Response DTO for trusting a device.
 * No validators needed - this is generated internally by the library.
 *
 * Security:
 * - Device token should be stored securely on client
 * - Used for MFA bypass on trusted devices
 *
 * @example
 * ```typescript
 * const result = await authService.trustDevice();
 * // Returns: { deviceToken: 'device-token-string' }
 * ```
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrustDeviceResponseDTO = void 0;
/**
 * Response DTO for trust device
 */
var TrustDeviceResponseDTO = /** @class */ (function () {
    function TrustDeviceResponseDTO() {
    }
    return TrustDeviceResponseDTO;
}());
exports.TrustDeviceResponseDTO = TrustDeviceResponseDTO;
