/**
 * Update Verified Status Request DTO
 *
 * Request DTO for updating email and/or phone verification status.
 * Intended for admin use cases such as migration or offline validation.
 *
 * Security:
 * - User sub validated (UUID)
 * - Cannot set verified=true if email/phone doesn't exist
 * - Can set verified=false even if email/phone doesn't exist (default state)
 * - Only updates provided fields (partial update)
 *
 * @example
 * ```typescript
 * // Update email verification only
 * await authService.updateVerifiedStatus({
 *   sub: 'user-uuid',
 *   isEmailVerified: true
 * });
 *
 * // Update both email and phone verification
 * await authService.updateVerifiedStatus({
 *   sub: 'user-uuid',
 *   isEmailVerified: true,
 *   isPhoneVerified: false
 * });
 * ```
 */

import { IsUUID, IsBoolean, IsOptional, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Request DTO for updating verification status
 */
export class UpdateVerifiedStatusRequestDTO {
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
   * Email verification status
   *
   * Validation:
   * - If set to true, user must have an email address
   * - If set to false, can be set even if email doesn't exist (default state)
   * - Optional - only updates if provided
   *
   * @example true
   */
  @IsOptional()
  @IsBoolean({ message: 'isEmailVerified must be a boolean' })
  @ValidateIf((o) => o.isEmailVerified !== undefined)
  isEmailVerified?: boolean;

  /**
   * Phone verification status
   *
   * Validation:
   * - If set to true, user must have a phone number
   * - If set to false, can be set even if phone doesn't exist (default state)
   * - Optional - only updates if provided
   *
   * @example true
   */
  @IsOptional()
  @IsBoolean({ message: 'isPhoneVerified must be a boolean' })
  @ValidateIf((o) => o.isPhoneVerified !== undefined)
  isPhoneVerified?: boolean;
}
