import { IAuthAudit } from '../interfaces/entities.interface';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';

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
 *   sub: 'user-uuid',
 *   limit: 50,
 * });
 * ```
 */
export class GetSuspiciousActivityDTO {
  /**
   * Optional user's unique identifier (UUID v4) to filter by specific user
   *
   * If not provided, returns suspicious activity for all users.
   */
  @IsOptional()
  @IsUUID('4', { message: 'sub must be a valid UUID v4 format' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim().toLowerCase();
    }
    return value;
  })
  sub?: string;

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
 * Response DTO for suspicious activity
 */
export class GetSuspiciousActivityResponseDTO {
  /**
   * Array of suspicious audit events
   */
  data!: IAuthAudit[];
}
