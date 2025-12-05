import { IsString, MinLength, MaxLength, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Reset Password Request DTO
 *
 * Used to request a password reset token via email or phone.
 *
 * Security:
 * - Identifier validated (email or phone)
 * - Input sanitization applied
 *
 * @example
 * ```typescript
 * POST /auth/reset-password/request
 * {
 *   "identifier": "user@example.com"
 * }
 * ```
 */
export class ResetPasswordRequestDTO {
  /**
   * User identifier (email or phone)
   *
   * Validation:
   * - Must be a string
   * - Min 1 character
   * - Max 255 characters (matches DB constraint for email)
   *
   * Sanitization:
   * - Trimmed
   * - Lowercased if email format detected
   */
  @IsString({ message: 'Identifier must be a string' })
  @IsNotEmpty({ message: 'Identifier is required' })
  @MinLength(1, { message: 'Identifier is required' })
  @MaxLength(255, { message: 'Identifier must not exceed 255 characters' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      // If it contains @, treat as email and lowercase
      if (trimmed.includes('@')) {
        return trimmed.toLowerCase();
      }
      return trimmed;
    }
    return value;
  })
  identifier!: string; // email or phone
}

/**
 * Reset Password DTO
 *
 * Used to reset password with a valid reset token.
 *
 * Security:
 * - Token length validated (matches DB constraint: varchar(255))
 * - Password strength enforced (8-128 chars)
 * - Token format validated in service layer
 *
 * @example
 * ```typescript
 * POST /auth/reset-password
 * {
 *   "token": "reset-token-from-email",
 *   "newPassword": "NewSecurePassword123!"
 * }
 * ```
 */
export class ResetPasswordDTO {
  /**
   * Password reset token from email
   *
   * Validation:
   * - Must be a string
   * - Min 1 character (prevents empty strings)
   * - Max 255 characters (matches DB constraint: varchar(255))
   *
   * Sanitization:
   * - Trimmed
   *
   * Note: Token format and validity validated in service layer
   */
  @IsString({ message: 'Token must be a string' })
  @IsNotEmpty({ message: 'Token is required' })
  @MinLength(1, { message: 'Token is required' })
  @MaxLength(255, { message: 'Token must not exceed 255 characters' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim();
    }
    return value;
  })
  token!: string;

  /**
   * New password
   *
   * Validation:
   * - Must be a string
   * - Min 8 characters (security requirement)
   * - Max 128 characters (prevents DoS via bcrypt)
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
}
