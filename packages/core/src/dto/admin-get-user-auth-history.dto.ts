import { IAuthAudit } from '../interfaces/entities.interface';
import { IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { GetUserAuthHistoryDTO } from './get-user-auth-history.dto';

/**
 * Request DTO for getting user authentication history (admin-only)
 *
 * Admin DTO - requires sub field. Used by AdminAuthService.
 *
 * @example
 * ```typescript
 * const result = await auditService.getUserAuthHistory({
 *   sub: 'user-uuid',
 *   page: 1,
 *   limit: 50,
 *   eventTypes: [AuthAuditEventType.LOGIN_SUCCESS],
 *   startDate: new Date('2025-01-01'),
 * });
 * ```
 */
export class AdminGetUserAuthHistoryDTO extends GetUserAuthHistoryDTO {
  /**
   * User's unique identifier (UUID v4)
   *
   * Validation:
   * - Must be a valid UUID v4 format
   * - Matches DB constraint: char(36) or uuid
   *
   * Sanitization:
   * - Trimmed
   * - Lowercased for consistency
   *
   * Required for admin operations.
   *
   * @example "a21b654c-2746-4168-acee-c175083a65cd"
   */
  @IsUUID('4', { message: 'User sub must be a valid UUID v4 format' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim().toLowerCase();
    }
    return value;
  })
  sub!: string;
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
