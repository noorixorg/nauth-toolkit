/**
 * Logout All DTO
 *
 * Request DTO for logging out a user from all sessions (global logout).
 *
 * Security:
 * - Uses authenticated user context for sub
 * - Prevents unauthorized logout attempts
 *
 * @example
 * ```typescript
 * const result = await authService.logoutAll({
 *   sub: 'user-uuid'
 * });
 * ```
 */

import { IsOptional, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Request DTO for logout all sessions
 */
export class LogoutAllDTO {
  /**
   * Whether to also forget/revoke all trusted devices
   *
   * If true, all trusted devices for this user will be revoked,
   * requiring MFA on next login from any device.
   *
   * Default: false (devices remain trusted)
   *
   * @example false
   */
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (value === 'true' || value === '1') return true;
    if (value === 'false' || value === '0') return false;
    return value;
  })
  forgetDevices?: boolean;
}
