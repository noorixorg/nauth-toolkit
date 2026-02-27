import { AuthAuditEventType } from '../enums/auth-audit-event-type.enum';
import { IAuthAudit } from '../interfaces/entities.interface';
import { IsDate, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

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
  @IsEnum(AuthAuditEventType, { message: 'eventType must be a valid AuthAuditEventType' })
  eventType!: AuthAuditEventType;

  /**
   * Page number (1-indexed)
   *
   * @default 1
   */
  @IsOptional()
  @IsInt({ message: 'page must be an integer' })
  @Min(1, { message: 'page must be at least 1' })
  @Transform(({ value }) => {
    if (typeof value === 'string' && value.trim() !== '') {
      const parsed = Number.parseInt(value, 10);
      return Number.isNaN(parsed) ? value : parsed;
    }
    return value;
  })
  page?: number;

  /**
   * Number of records per page
   *
   * @default 50
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

  /**
   * Filter events from this date onwards
   */
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'startDate must be a valid Date' })
  startDate?: Date;

  /**
   * Filter events up to this date
   */
  @IsOptional()
  @Type(() => Date)
  @IsDate({ message: 'endDate must be a valid Date' })
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
