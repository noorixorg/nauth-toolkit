"use strict";
/**
 * Response DTO for getting user agent
 *
 * Used to return just the user agent string from the current request context.
 *
 * @example
 * ```typescript
 * const result = await clientInfoService.getUserAgent();
 * // Returns: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)...' }
 * ```
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetUserAgentResponseDTO = void 0;
/**
 * Response DTO for user agent
 */
var GetUserAgentResponseDTO = /** @class */ (function () {
    function GetUserAgentResponseDTO() {
    }
    return GetUserAgentResponseDTO;
}());
exports.GetUserAgentResponseDTO = GetUserAgentResponseDTO;
