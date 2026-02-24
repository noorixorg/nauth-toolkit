import { IsOptional, IsNumber, Min, Max, IsString, IsBoolean, IsEnum, ValidateNested, IsDate } from 'class-validator';
import { Type } from 'class-transformer';
import { UserResponseDTO } from './user-response.dto';

/**
 * Date filter with operator support
 *
 * Supports gt (greater than), gte (greater than or equal), lt (less than),
 * lte (less than or equal), eq (equal) operators for date comparisons.
 *
 * @example
 * ```typescript
 * {
 *   operator: 'gte',
 *   value: new Date('2024-01-01')
 * }
 * ```
 */
export class DateFilterDTO {
  /**
   * Comparison operator
   *
   * - gt: greater than
   * - gte: greater than or equal
   * - lt: less than
   * - lte: less than or equal
   * - eq: equal
   */
  @IsEnum(['gt', 'gte', 'lt', 'lte', 'eq'])
  operator!: 'gt' | 'gte' | 'lt' | 'lte' | 'eq';

  /**
   * Date value to compare against
   */
  @IsDate()
  @Type(() => Date)
  value!: Date;
}

/**
 * DTO for paginated user listing with advanced filtering
 *
 * Supports pagination, boolean filters, exact match filters,
 * date filters with operators, and flexible sorting.
 *
 * @example
 * ```typescript
 * const result = await authService.getUsers({
 *   page: 1,
 *   limit: 20,
 *   isEmailVerified: true,
 *   hasSocialAuth: true,
 *   createdAt: { operator: 'gte', value: new Date('2024-01-01') },
 *   sortBy: 'email',
 *   sortOrder: 'ASC'
 * });
 * ```
 */
export class GetUsersDTO {
  /**
   * Page number (1-indexed)
   *
   * Default: 1
   */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  /**
   * Number of records per page
   *
   * Default: 10, Max: 100
   */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  /**
   * Filter by email address (partial match)
   *
   * Supports partial matching using LIKE query.
   * Example: "john" will match "john@example.com", "johnny@test.com", etc.
   */
  @IsOptional()
  @IsString()
  email?: string;

  /**
   * Filter by phone number (partial match)
   *
   * Supports partial matching using LIKE query.
   * Example: "+1" will match "+14155552671", "+12025551234", etc.
   */
  @IsOptional()
  @IsString()
  phone?: string;

  /**
   * Filter by email verification status
   */
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isEmailVerified?: boolean;

  /**
   * Filter by phone verification status
   */
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isPhoneVerified?: boolean;

  /**
   * Filter by social auth presence
   */
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  hasSocialAuth?: boolean;

  /**
   * Filter by account lock status
   */
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isLocked?: boolean;

  /**
   * Filter by MFA enabled status
   */
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  mfaEnabled?: boolean;

  /**
   * Filter by account creation date
   *
   * Supports operators: gt, gte, lt, lte, eq
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => DateFilterDTO)
  createdAt?: DateFilterDTO;

  /**
   * Filter by last update date
   *
   * Supports operators: gt, gte, lt, lte, eq
   */
  @IsOptional()
  @ValidateNested()
  @Type(() => DateFilterDTO)
  updatedAt?: DateFilterDTO;

  /**
   * Field to sort by
   *
   * Default: createdAt
   */
  @IsOptional()
  @IsEnum(['email', 'createdAt', 'updatedAt', 'username', 'phone'])
  sortBy?: 'email' | 'createdAt' | 'updatedAt' | 'username' | 'phone';

  /**
   * Sort order
   *
   * Default: DESC
   */
  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC';
}

/**
 * Response DTO for paginated user listing
 *
 * @example
 * ```typescript
 * {
 *   users: [{ sub: '...', email: '...', ... }],
 *   pagination: {
 *     page: 1,
 *     limit: 20,
 *     total: 150,
 *     totalPages: 8
 *   }
 * }
 * ```
 */
export class GetUsersResponseDTO {
  /**
   * Array of sanitized user objects
   */
  users!: UserResponseDTO[];

  /**
   * Pagination metadata
   */
  pagination!: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
