"use strict";
/**
 * Response DTO for getting IP address
 *
 * Used to return just the IP address from the current request context.
 *
 * @example
 * ```typescript
 * const result = await clientInfoService.getIpAddress();
 * // Returns: { ipAddress: '192.168.1.100' }
 * ```
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetIpAddressResponseDTO = void 0;
/**
 * Response DTO for IP address
 */
var GetIpAddressResponseDTO = /** @class */ (function () {
    function GetIpAddressResponseDTO() {
    }
    return GetIpAddressResponseDTO;
}());
exports.GetIpAddressResponseDTO = GetIpAddressResponseDTO;
