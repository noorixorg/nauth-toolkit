/**
 * Logout All DTO
 *
 * Request DTO for logging out a user from all sessions (global logout).
 *
 * Security:
 * - User sub validated (UUID)
 * - Prevents unauthorized logout attempts
 *
 * @example
 * ```typescript
 * const result = await authService.logoutAll({
 *   sub: 'user-uuid'
 * });
 * ```
 */

import { IsUUID, IsOptional, IsBoolean, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Request DTO for logout all sessions
 */
export class LogoutAllDTO {
  /**
   * User's unique identifier (UUID v4)
   *
   * Optional at controller level - filled from authenticated user's JWT.
   * Validated only when provided (service layer will ensure it's set).
   *
   * Validation:
   * - Must be a valid UUID v4 format when provided
   * - Matches DB constraint: char(36) or uuid
   *
   * Sanitization:
   * - Trimmed
   * - Lowercased for consistency
   *
   * @example "a21b654c-2746-4168-acee-c175083a65cd"
   */
  @ValidateIf((o) => o.sub !== undefined && o.sub !== null && o.sub !== '')
  @IsUUID('4', { message: 'User sub must be a valid UUID v4 format' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim().toLowerCase();
    }
    return value;
  })
  @IsOptional()
  sub?: string;

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
