"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetUserAuthHistoryResponseDTO = exports.GetUserAuthHistoryDTO = void 0;
/**
 * Request DTO for getting user authentication history
 *
 * @example
 * ```typescript
 * const result = await auditService.getUserAuthHistory({
 *   userSub: 'user-uuid',
 *   page: 1,
 *   limit: 50,
 *   eventTypes: [AuthAuditEventType.LOGIN_SUCCESS],
 *   startDate: new Date('2025-01-01'),
 * });
 * ```
 */
var GetUserAuthHistoryDTO = /** @class */ (function () {
    function GetUserAuthHistoryDTO() {
    }
    return GetUserAuthHistoryDTO;
}());
exports.GetUserAuthHistoryDTO = GetUserAuthHistoryDTO;
/**
 * Response DTO for paginated user authentication history
 */
var GetUserAuthHistoryResponseDTO = /** @class */ (function () {
    function GetUserAuthHistoryResponseDTO() {
    }
    return GetUserAuthHistoryResponseDTO;
}());
exports.GetUserAuthHistoryResponseDTO = GetUserAuthHistoryResponseDTO;
