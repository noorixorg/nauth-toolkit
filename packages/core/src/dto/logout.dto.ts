/**
 * Logout DTO
 *
 * Request DTO for logging out a user from the current authenticated session.
 *
 * Security:
 * - Session ID is automatically extracted from JWT token context (via ClientInfoService)
 * - User sub validated (UUID) - optional, for additional verification
 * - Prevents unauthorized logout attempts
 *
 * @example
 * ```typescript
 * await authService.logout({
 *   forgetMe: false
 * });
 * ```
 */

import { IsOptional, IsBoolean, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Request DTO for logout
 */
export class LogoutDTO {
  /**
   * User's unique identifier (UUID v4) - Optional
   *
   * If provided, validates that the authenticated user matches this sub.
   * Session ID is automatically extracted from JWT token context.
   *
   * Validation:
   * - Must be a valid UUID v4 format if provided
   * - Matches DB constraint: char(36) or uuid
   *
   * Sanitization:
   * - Trimmed
   * - Lowercased for consistency
   *
   * @example "a21b654c-2746-4168-acee-c175083a65cd"
   */
  @IsOptional()
  @IsUUID('4', { message: 'User sub must be a valid UUID v4 format' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim().toLowerCase();
    }
    return value;
  })
  sub?: string;

  /**
   * If true, also removes trusted device
   *
   * Validation:
   * - Must be a boolean if present
   * - Default: false
   *
   * @example false
   */
  @IsOptional()
  @IsBoolean({ message: 'forgetMe must be a boolean' })
  forgetMe?: boolean;
}
