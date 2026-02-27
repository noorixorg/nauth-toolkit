import { AuthAuditEventType } from '../enums/auth-audit-event-type.enum';
import { AuthAuditEventStatus } from '../entities/auth-audit.entity';
import { IsArray, IsDate, IsEnum, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';

/**
 * Request DTO for getting user authentication history (user self-service)
 *
 * User self-service DTO - no userSub field. Service gets user from authenticated context.
 *
 * @example
 * ```typescript
 * const result = await authService.getUserAuthHistory({
 *   page: 1,
 *   limit: 50,
 *   eventTypes: [AuthAuditEventType.LOGIN_SUCCESS],
 *   startDate: new Date('2025-01-01'),
 * });
 * ```
 */
export class GetUserAuthHistoryDTO {
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
  @Transform(({ value }: { value: unknown }) => {
    // Support query params like:
    // - ?eventTypes=LOGIN_SUCCESS
    // - ?eventTypes=LOGIN_SUCCESS&eventTypes=LOGIN_FAILED
    // - ?eventTypes=LOGIN_SUCCESS,LOGIN_FAILED
    if (value === undefined || value === null) {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((v) => (typeof v === 'string' ? v.trim() : v)).filter((v) => v !== '');
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed === '') {
        return value;
      }

      const parts = trimmed
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);

      return parts.length > 0 ? parts : value;
    }

    return value;
  })
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
  @Transform(({ value }: { value: unknown }) => {
    // Support query params like:
    // - ?eventStatus=FAILURE
    // - ?eventStatus=SUCCESS&eventStatus=FAILURE
    // - ?eventStatus=SUCCESS,FAILURE
    if (value === undefined || value === null) {
      return value;
    }

    if (Array.isArray(value)) {
      return value.map((v) => (typeof v === 'string' ? v.trim() : v)).filter((v) => v !== '');
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed === '') {
        return value;
      }

      const parts = trimmed
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);

      return parts.length > 0 ? parts : value;
    }

    return value;
  })
  eventStatus?: AuthAuditEventStatus[];
}
