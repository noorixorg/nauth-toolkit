"use strict";
/**
 * Response DTO for getting device token
 *
 * Used to return just the device token from the current request context.
 * Device token is used for trusted device feature.
 *
 * @example
 * ```typescript
 * const result = await clientInfoService.getDeviceToken();
 * // Returns: { deviceToken: 'device-token-123' } or { deviceToken: undefined }
 * ```
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetDeviceTokenResponseDTO = void 0;
/**
 * Response DTO for device token
 */
var GetDeviceTokenResponseDTO = /** @class */ (function () {
    function GetDeviceTokenResponseDTO() {
    }
    return GetDeviceTokenResponseDTO;
}());
exports.GetDeviceTokenResponseDTO = GetDeviceTokenResponseDTO;
