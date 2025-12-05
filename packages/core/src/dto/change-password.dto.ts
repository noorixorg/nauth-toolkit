/**
 * Change Password DTO
 *
 * Used for authenticated password changes.
 * User must provide their current password for security verification.
 *
 * Security:
 * - Old password verified before allowing change
 * - New password validated for minimum strength
 * - Password history checked (configurable)
 * - Max length prevents DoS via bcrypt
 *
 * @example
 * ```typescript
 * POST /auth/change-password
 * Authorization: Bearer <access-token>
 * {
 *   "oldPassword": "currentPassword123",
 *   "newPassword": "newSecurePassword456"
 * }
 * ```
 */

import { IsString, MinLength, MaxLength } from 'class-validator';

export class ChangePasswordDTO {
  /**
   * Current password
   *
   * Validation:
   * - Must be a string
   *
   * Note: NOT trimmed (passwords can have leading/trailing spaces)
   */
  @IsString({ message: 'Old password must be a string' })
  oldPassword!: string;

  /**
   * New password
   *
   * Validation:
   * - Must be a string
   * - Min 8 characters (security requirement)
   * - Max 128 characters (prevents DoS via bcrypt)
   *
   * Note: NOT trimmed (passwords can have leading/trailing spaces)
   *
   * Additional checks in service layer:
   * - Password history (prevent reuse of recent passwords)
   * - Password strength (if configured)
   * - Not same as old password
   */
  @IsString({ message: 'New password must be a string' })
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(128, { message: 'Password must not exceed 128 characters' })
  newPassword!: string;
}
