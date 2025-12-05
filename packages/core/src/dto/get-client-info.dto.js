"use strict";
/**
 * Response DTO for getting client information
 *
 * Used to return client information extracted from the current request context.
 * Includes IP address, user agent, device info, and optional geolocation data.
 *
 * @example
 * ```typescript
 * const result = await clientInfoService.get();
 * // Returns: { ipAddress: '192.168.1.100', userAgent: 'Mozilla/5.0...', ... }
 * ```
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetClientInfoResponseDTO = void 0;
/**
 * Response DTO for client information
 */
var GetClientInfoResponseDTO = /** @class */ (function () {
    function GetClientInfoResponseDTO() {
    }
    return GetClientInfoResponseDTO;
}());
exports.GetClientInfoResponseDTO = GetClientInfoResponseDTO;
