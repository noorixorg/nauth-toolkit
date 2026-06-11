/**
 * Admin Logout All DTO
 *
 * Request DTO for logging out a target user from all sessions (admin-initiated).
 *
 * Security:
 * - Requires target user sub (UUID)
 * - Prevents unauthorized logout attempts
 *
 * @example
 * ```typescript
 * const result = await adminAuthService.logoutAll({
 *   sub: 'user-uuid',
 *   forgetDevices: true,
 * });
 * ```
 */

import { IsUUID, IsOptional, IsBoolean } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Request DTO for admin logout all sessions
 */
export class AdminLogoutAllDTO {
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
