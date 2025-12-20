import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Forgot Password DTO
 *
 * Request a password reset code for a user account.
 *
 * Security:
 * - This endpoint should not reveal whether an account exists.
 * - Identifier is sanitized (trimmed, email lowercased when detected).
 *
 * @example
 * ```typescript
 * await authService.forgotPassword({ identifier: 'user@example.com' });
 * ```
 */
export class ForgotPasswordDTO {
  /**
   * User identifier used to locate the account.
   *
   * Accepts email, username, or phone depending on application login policy.
   *
   * Sanitization:
   * - Trimmed
   * - Lowercased when email format detected (contains '@')
   */
  @IsString({ message: 'Identifier must be a string' })
  @IsNotEmpty({ message: 'Identifier is required' })
  @MinLength(1, { message: 'Identifier is required' })
  @MaxLength(255, { message: 'Identifier must not exceed 255 characters' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.includes('@')) {
        return trimmed.toLowerCase();
      }
      return trimmed;
    }
    return value;
  })
  identifier!: string;
}

/**
 * Forgot Password Response DTO
 *
 * Response for a password reset request.
 *
 * Security:
 * - `success` should be true even when the identifier does not map to any user,
 *   to prevent account enumeration.
 *
 * @example
 * ```typescript
 * {
 *   success: true,
 *   destination: "j***@example.com",
 *   deliveryMedium: "email",
 *   expiresIn: 900
 * }
 * ```
 */
export class ForgotPasswordResponseDTO {
  /**
   * Always true when request accepted (regardless of account existence).
   */
  success!: boolean;

  /**
   * Masked delivery destination (email or phone) when available.
   *
   * Examples:
   * - `j***@example.com`
   * - `+1***1234`
   */
  destination?: string;

  /**
   * Delivery channel used.
   */
  deliveryMedium?: 'email' | 'sms';

  /**
   * Code expiry in seconds.
   */
  expiresIn?: number;
}
