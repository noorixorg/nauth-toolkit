/**
 * Admin Set Password Request DTO
 *
 * Request DTO for admin-initiated password reset.
 * Allows resetting a user's password by sub (UUID).
 *
 * Security:
 * - Admin-only operation (should be protected by admin guard)
 * - User sub validated
 * - Password policy enforced
 * - Session revocation configurable
 *
 * @example
 * ```typescript
 * await authService.adminSetPassword({
 *   sub: 'a21b654c-2746-4168-acee-c175083a65cd',
 *   newPassword: 'NewSecurePassword123!',
 *   mustChangePassword: true,
 *   revokeSessions: true
 * });
 * ```
 */

import { IsString, IsOptional, IsBoolean, MinLength, MaxLength, IsNotEmpty, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Request DTO for admin password reset
 */
export class AdminSetPasswordDTO {
  /**
   * User sub (UUID)
   *
   * Validation:
   * - Must be a valid UUID v4
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
   * New password
   *
   * Validation:
   * - Must be a string
   * - Min 8 characters (security requirement)
   * - Max 128 characters (prevents DoS)
   *
   * Note: NOT trimmed (passwords can have leading/trailing spaces)
   * Additional checks in service layer:
   * - Password strength (if configured)
   * - Password history (prevent reuse)
   */
  @IsString({ message: 'New password must be a string' })
  @IsNotEmpty({ message: 'New password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(128, { message: 'Password must not exceed 128 characters' })
  newPassword!: string;

  /**
   * Require user to change password on next login
   *
   * Default: true (security best practice)
   *
   * @example true
   */
  @IsOptional()
  @IsBoolean({ message: 'mustChangePassword must be a boolean' })
  mustChangePassword?: boolean;

  /**
   * Revoke all active sessions after password reset
   *
   * Default: true (security best practice)
   *
   * @example true
   */
  @IsOptional()
  @IsBoolean({ message: 'revokeSessions must be a boolean' })
  revokeSessions?: boolean;
}

/**
 * Admin Set Password Response DTO
 *
 * Response DTO for admin password reset operation.
 *
 * @example
 * ```typescript
 * {
 *   success: true,
 *   mustChangePassword: true,
 *   sessionsRevoked: 3
 * }
 * ```
 */
export class AdminSetPasswordResponseDTO {
  /**
   * Success indicator
   * Always true on successful password reset
   */
  success!: boolean;

  /**
   * Whether user must change password on next login
   */
  mustChangePassword!: boolean;

  /**
   * Number of sessions revoked
   */
  sessionsRevoked!: number;
}
