/**
 * Get User By Email DTO
 *
 * Request DTO for retrieving a user by email address.
 *
 * Security:
 * - Email format validated
 * - Max length enforced
 *
 * @example
 * ```typescript
 * const user = await authService.getUserByEmail({
 *   email: 'user@example.com',
 *   requireEmailVerified: true
 * });
 * ```
 */

import { IsEmail, IsOptional, IsBoolean, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Request DTO for getting user by email
 */
export class GetUserByEmailDTO {
  /**
   * Email address to search for
   *
   * Validation:
   * - Must be a valid email format
   * - Max 255 characters (matches DB constraint)
   *
   * Sanitization:
   * - Trimmed
   * - Lowercased for consistency
   *
   * @example "user@example.com"
   */
  @IsEmail({}, { message: 'Email must be a valid email format' })
  @MaxLength(255, { message: 'Email must not exceed 255 characters' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim().toLowerCase();
    }
    return value;
  })
  email!: string;

  /**
   * Only return user if email is verified
   *
   * Validation:
   * - Must be a boolean if present
   * - Default: false
   *
   * @example true
   */
  @IsOptional()
  @IsBoolean({ message: 'requireEmailVerified must be a boolean' })
  requireEmailVerified?: boolean;
}
