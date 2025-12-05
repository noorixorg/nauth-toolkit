import { IAuthAudit } from '../interfaces/entities.interface';

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
export class GetRiskAssessmentHistoryDTO {
  /**
   * User identifier
   */
  userSub!: string;

  /**
   * Maximum number of records to return
   *
   * @default 100
   */
  limit?: number;
}

/**
 * Response DTO for risk assessment history
 */
export class GetRiskAssessmentHistoryResponseDTO {
  /**
   * Array of risk assessment audit events
   */
  data!: IAuthAudit[];
}
