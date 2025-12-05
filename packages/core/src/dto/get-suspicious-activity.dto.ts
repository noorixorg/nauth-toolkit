import { IAuthAudit } from '../interfaces/entities.interface';

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
export class GetSuspiciousActivityDTO {
  /**
   * Optional user identifier to filter by specific user
   *
   * If not provided, returns suspicious activity for all users.
   */
  userSub?: string;

  /**
   * Maximum number of records to return
   *
   * @default 100
   */
  limit?: number;
}

/**
 * Response DTO for suspicious activity
 */
export class GetSuspiciousActivityResponseDTO {
  /**
   * Array of suspicious audit events
   */
  data!: IAuthAudit[];
}
