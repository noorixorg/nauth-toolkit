"use strict";
/**
 * Response DTO for getting session ID
 *
 * Used to return just the session ID from the current request context.
 * Session ID is extracted from JWT token payload after authentication.
 *
 * @example
 * ```typescript
 * const result = await clientInfoService.getSessionId();
 * // Returns: { sessionId: 123 } or { sessionId: undefined }
 * ```
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetSessionIdResponseDTO = void 0;
/**
 * Response DTO for session ID
 */
var GetSessionIdResponseDTO = /** @class */ (function () {
    function GetSessionIdResponseDTO() {
    }
    return GetSessionIdResponseDTO;
}());
exports.GetSessionIdResponseDTO = GetSessionIdResponseDTO;
