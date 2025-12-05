"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetEventsByTypeResponseDTO = exports.GetEventsByTypeDTO = void 0;
/**
 * Request DTO for getting events by type
 *
 * @example
 * ```typescript
 * const result = await auditService.getEventsByType({
 *   eventType: AuthAuditEventType.SUSPICIOUS_ACTIVITY,
 *   page: 1,
 *   limit: 100,
 *   startDate: new Date('2025-01-01'),
 * });
 * ```
 */
var GetEventsByTypeDTO = /** @class */ (function () {
    function GetEventsByTypeDTO() {
    }
    return GetEventsByTypeDTO;
}());
exports.GetEventsByTypeDTO = GetEventsByTypeDTO;
/**
 * Response DTO for paginated events by type
 */
var GetEventsByTypeResponseDTO = /** @class */ (function () {
    function GetEventsByTypeResponseDTO() {
    }
    return GetEventsByTypeResponseDTO;
}());
exports.GetEventsByTypeResponseDTO = GetEventsByTypeResponseDTO;
