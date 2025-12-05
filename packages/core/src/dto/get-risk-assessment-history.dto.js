"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetRiskAssessmentHistoryResponseDTO = exports.GetRiskAssessmentHistoryDTO = void 0;
/**
 * Request DTO for getting risk assessment history
 *
 * Returns events where risk assessment was performed (ADAPTIVE_MFA_RISK_ASSESSED,
 * ADAPTIVE_MFA_TRIGGERED, ADAPTIVE_MFA_BYPASSED).
 *
 * @example
 * ```typescript
 * const result = await auditService.getRiskAssessmentHistory({
 *   userSub: 'user-uuid',
 *   limit: 50,
 * });
 * ```
 */
var GetRiskAssessmentHistoryDTO = /** @class */ (function () {
    function GetRiskAssessmentHistoryDTO() {
    }
    return GetRiskAssessmentHistoryDTO;
}());
exports.GetRiskAssessmentHistoryDTO = GetRiskAssessmentHistoryDTO;
/**
 * Response DTO for risk assessment history
 */
var GetRiskAssessmentHistoryResponseDTO = /** @class */ (function () {
    function GetRiskAssessmentHistoryResponseDTO() {
    }
    return GetRiskAssessmentHistoryResponseDTO;
}());
exports.GetRiskAssessmentHistoryResponseDTO = GetRiskAssessmentHistoryResponseDTO;
