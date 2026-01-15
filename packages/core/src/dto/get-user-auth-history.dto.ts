import { AuthAuditEventType } from '../enums/auth-audit-event-type.enum';
import { AuthAuditEventStatus } from '../entities/auth-audit.entity';
import { IAuthAudit } from '../interfaces/entities.interface';
import { IsArray, IsDate, IsEnum, IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

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
   *
   * Note: This is optional in the DTO because controllers set it from the authenticated user.
   * It will be validated when set by the controller.
   */
  @IsOptional()
  @IsUUID('4', { message: 'userSub must be a valid UUID v4 format' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim().toLowerCase();
    }
    return value;
  })
  userSub?: string;

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

  /**
   * Filter by specific event types
   *
   * If provided, only events matching these types will be returned.
   */
  @IsOptional()
  @IsArray({ message: 'eventTypes must be an array' })
  @IsEnum(AuthAuditEventType, { each: true, message: 'eventTypes must contain only AuthAuditEventType values' })
  eventTypes?: AuthAuditEventType[];

  /**
   * Filter by event status
   *
   * If provided, only events matching these statuses will be returned.
   */
  @IsOptional()
  @IsArray({ message: 'eventStatus must be an array' })
  @IsIn(['SUCCESS', 'FAILURE', 'INFO', 'SUSPICIOUS'], {
    each: true,
    message: 'eventStatus must contain only: SUCCESS, FAILURE, INFO, SUSPICIOUS',
  })
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
