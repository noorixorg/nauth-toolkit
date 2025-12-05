import { AuthAuditEventType } from '../enums/auth-audit-event-type.enum';
import { AuthAuditEventStatus } from '../entities/auth-audit.entity';
import { IAuthAudit } from '../interfaces/entities.interface';

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
export class GetUserAuthHistoryDTO {
  /**
   * External user identifier (UUID)
   *
   * The service will automatically resolve this to the internal userId
   * for efficient database queries.
   */
  userSub!: string;

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

  /**
   * Filter by specific event types
   *
   * If provided, only events matching these types will be returned.
   */
  eventTypes?: AuthAuditEventType[];

  /**
   * Filter by event status
   *
   * If provided, only events matching these statuses will be returned.
   */
  eventStatus?: AuthAuditEventStatus[];
}

/**
 * Response DTO for paginated user authentication history
 */
export class GetUserAuthHistoryResponseDTO {
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
