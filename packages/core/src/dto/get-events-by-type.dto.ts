import { AuthAuditEventType } from '../enums/auth-audit-event-type.enum';
import { IAuthAudit } from '../interfaces/entities.interface';

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
export class GetEventsByTypeDTO {
  /**
   * Event type to filter by
   */
  eventType!: AuthAuditEventType;

  /**
   * Page number (1-indexed)
   *
   * @default 1
   */
  page?: number;

  /**
   * Number of records per page
   *
   * @default 50
   */
  limit?: number;

  /**
   * Filter events from this date onwards
   */
  startDate?: Date;

  /**
   * Filter events up to this date
   */
  endDate?: Date;
}

/**
 * Response DTO for paginated events by type
 */
export class GetEventsByTypeResponseDTO {
  /**
   * Array of audit records
   */
  data!: IAuthAudit[];

  /**
   * Total number of records matching the query
   */
  total!: number;

  /**
   * Current page number
   */
  page!: number;

  /**
   * Number of records per page
   */
  limit!: number;

  /**
   * Total number of pages
   */
  totalPages!: number;
}
