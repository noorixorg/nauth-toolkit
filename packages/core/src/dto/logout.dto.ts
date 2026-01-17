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
   *
   * @example false
   */
  @IsOptional()
  @IsBoolean({ message: 'forgetMe must be a boolean' })
  forgetMe?: boolean;
}
