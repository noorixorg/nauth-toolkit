/**
 * Logout DTO
 *
 * Request DTO for logging out a user from the current authenticated session.
 *
 * Security:
 * - Session ID is automatically extracted from JWT token context (via ClientInfoService)
 * - Uses authenticated user context for sub
 * - Prevents unauthorized logout attempts
 *
 * @example
 * ```typescript
 * await authService.logout({
 *   forgetMe: false
 * });
 * ```
 */

import { IsOptional, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Request DTO for logout
 */
export class LogoutDTO {
  /**
   * If true, also removes trusted device
   *
   * Validation:
   * - Must be a boolean if present
   * - Default: false
   * - Automatically converts string query parameters ('true'/'false', '1'/'0') to boolean
   *
   * @example false
   */
  @IsOptional()
  @IsBoolean({ message: 'forgetMe must be a boolean' })
  @Transform(({ value }) => {
    if (value === 'true' || value === '1') return true;
    if (value === 'false' || value === '0') return false;
    return value;
  })
  forgetMe?: boolean;
}
