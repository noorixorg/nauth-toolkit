import { IAuthAudit } from '../interfaces/entities.interface';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Request DTO for getting risk assessment history
 *
 * Returns events where risk assessment was performed (ADAPTIVE_MFA_RISK_ASSESSED,
 * ADAPTIVE_MFA_TRIGGERED, ADAPTIVE_MFA_BYPASSED).
 *
 * @example
 * ```typescript
 * const result = await auditService.getRiskAssessmentHistory({
 *   sub: 'user-uuid',
 *   limit: 50,
 * });
 * ```
 */
export class GetRiskAssessmentHistoryDTO {
  /**
   * User's unique identifier (UUID v4)
   */
  @IsUUID('4', { message: 'sub must be a valid UUID v4 format' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim().toLowerCase();
    }
    return value;
  })
  sub!: string;

  /**
   * Maximum number of records to return
   *
   * @default 100
   */
  @IsOptional()
  @IsInt({ message: 'limit must be an integer' })
  @Min(1, { message: 'limit must be at least 1' })
  @Max(500, { message: 'limit must not exceed 500' })
  @Transform(({ value }) => {
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number.parseInt(value, 10);
      return Number.isNaN(parsed) ? value : parsed;
    }
    return value;
  })
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
