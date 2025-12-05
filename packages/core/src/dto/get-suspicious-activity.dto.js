"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetSuspiciousActivityResponseDTO = exports.GetSuspiciousActivityDTO = void 0;
/**
 * Request DTO for getting suspicious activity
 *
 * @example
 * ```typescript
 * // Get all suspicious activity
 * const result = await auditService.getSuspiciousActivity({});
 *
 * // Get suspicious activity for specific user
 * const result = await auditService.getSuspiciousActivity({
 *   userSub: 'user-uuid',
 *   limit: 50,
 * });
 * ```
 */
var GetSuspiciousActivityDTO = /** @class */ (function () {
    function GetSuspiciousActivityDTO() {
    }
    return GetSuspiciousActivityDTO;
}());
exports.GetSuspiciousActivityDTO = GetSuspiciousActivityDTO;
/**
 * Response DTO for suspicious activity
 */
var GetSuspiciousActivityResponseDTO = /** @class */ (function () {
    function GetSuspiciousActivityResponseDTO() {
    }
    return GetSuspiciousActivityResponseDTO;
}());
exports.GetSuspiciousActivityResponseDTO = GetSuspiciousActivityResponseDTO;
