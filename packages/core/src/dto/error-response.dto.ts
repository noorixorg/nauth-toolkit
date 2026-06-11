import { IsNumber, IsString, IsOptional, IsObject, MaxLength, Matches } from 'class-validator';

/**
 * Standard error response format for all nauth-toolkit errors
 *
 * Provides structured error responses with error codes, metadata,
 * and consistent formatting across all authentication operations.
 *
 * @example
 * ```typescript
 * // Rate limit error response
 * {
 *   statusCode: 429,
 *   code: 'RATE_LIMIT_SMS',
 *   message: 'Too many verification SMS sent. Please try again later.',
 *   details: {
 *     retryAfter: 3600,
 *     currentCount: 4,
 *     maxAttempts: 3,
 *     resetAt: '2025-11-01T02:43:03.132Z'
 *   },
 *   timestamp: '2025-10-31T01:43:03.132Z',
 *   path: '/auth/verify-phone/send'
 * }
 * ```
 */
export class ErrorResponseDTO {
  /**
   * HTTP status code
   *
   * Validation:
   * - Must be a number
   * - Valid HTTP status code range (100-599)
   *
   * @example 400
   */
  @IsNumber({}, { message: 'Status code must be a number' })
  statusCode!: number;

  /**
   * Error code for programmatic handling
   *
   * Allows frontend to identify specific errors without parsing messages.
   * Useful for i18n, specific error handling, and analytics.
   *
   * Validation:
   * - Must be a string
   * - Max 100 characters (prevents oversized error codes)
   * - Alphanumeric and underscores only
   *
   * @example "RATE_LIMIT_SMS"
   */
  @IsString({ message: 'Error code must be a string' })
  @MaxLength(100, { message: 'Error code must not exceed 100 characters' })
  @Matches(/^[A-Z0-9_]+$/, {
    message: 'Error code can only contain uppercase letters, numbers, and underscores',
  })
  code!: string;

  /**
   * Human-readable error message
   *
   * Should be clear and actionable. Can be displayed directly to users
   * or used as fallback when error code doesn't have a translation.
   *
   * Validation:
   * - Must be a string
   * - Max 500 characters (prevents oversized messages)
   *
   * @example "Too many verification SMS sent. Please try again later."
   */
  @IsString({ message: 'Error message must be a string' })
  @MaxLength(500, { message: 'Error message must not exceed 500 characters' })
  message!: string;

  /**
   * Additional error details (optional)
   *
   * Provides context-specific metadata that can be used for:
   * - Retry logic (retryAfter, resetAt)
   * - Validation errors (field names, validation rules)
   * - Rate limiting (current count, max attempts)
   * - Debugging (correlation IDs, request IDs)
   *
   * Validation:
   * - Must be an object if present
   *
   * @example
   * ```typescript
   * {
   *   retryAfter: 3600,
   *   currentCount: 4,
   *   maxAttempts: 3,
   *   resetAt: '2025-11-01T02:43:03.132Z'
   * }
   * ```
   */
  @IsOptional()
  @IsObject({ message: 'Error details must be an object' })
  details?: Record<string, unknown>;

  /**
   * Timestamp when error occurred
   *
   * ISO 8601 format for consistent timezone handling.
   *
   * Validation:
   * - Must be a string
   * - Must match ISO 8601 format
   * - Max 30 characters (ISO 8601 timestamp length)
   *
   * @example "2025-10-31T01:43:03.132Z"
   */
  @IsString({ message: 'Timestamp must be a string' })
  @MaxLength(30, { message: 'Timestamp must not exceed 30 characters' })
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/, {
    message: 'Timestamp must be in ISO 8601 format',
  })
  timestamp!: string;

  /**
   * Request path where error occurred
   *
   * Useful for debugging and error tracking.
   *
   * Validation:
   * - Must be a string if present
   * - Max 500 characters (prevents oversized paths)
   *
   * @example "/auth/verify-phone/send"
   */
  @IsOptional()
  @IsString({ message: 'Path must be a string' })
  @MaxLength(500, { message: 'Path must not exceed 500 characters' })
  path?: string;
}
