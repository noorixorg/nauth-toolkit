/**
 * Set Must Change Password DTO
 *
 * Request DTO for requiring a user to change their password on next login.
 *
 * Security:
 * - User ID validated (UUID)
 * - Prevents unauthorized password change requirements
 *
 * @example
 * ```typescript
 * await authService.setMustChangePassword({
 *   userId: 'user-uuid'
 * });
 * ```
 */

import { IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Request DTO for setting must change password flag
 */
export class SetMustChangePasswordDTO {
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
  @IsUUID('4', { message: 'User ID must be a valid UUID v4 format' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim().toLowerCase();
    }
    return value;
  })
  userId!: string;
}
