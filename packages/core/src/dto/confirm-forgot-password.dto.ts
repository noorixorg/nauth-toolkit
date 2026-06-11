import { IsNotEmpty, IsNumberString, IsString, Length, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Confirm Forgot Password DTO
 *
 * Confirms a password reset request by validating the verification code and
 * setting a new password.
 *
 * Security:
 * - Code format validated (numeric string + fixed length).
 * - Password policy is enforced in the service layer.
 *
 * @example
 * ```typescript
 * await authService.confirmForgotPassword({
 *   identifier: 'user@example.com',
 *   code: '123456',
 *   newPassword: 'NewSecurePassword123!'
 * });
 * ```
 */
export class ConfirmForgotPasswordDTO {
  /**
   * User identifier used to locate the account.
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

  /**
   * Verification code delivered via email/SMS.
   *
   * Validation:
   * - Numeric string
   * - Exact length 6 (default). If a deployment changes length, the service layer
   *   can also validate against config for backward compatibility.
   */
  @IsString({ message: 'Code must be a string' })
  @IsNotEmpty({ message: 'Code is required' })
  @IsNumberString({}, { message: 'Code must contain only digits' })
  @Length(6, 6, { message: 'Code must be exactly 6 digits' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  code!: string;

  /**
   * New password to set on the account.
   *
   * Validation:
   * - 8-128 characters (baseline)
   * - NOT trimmed (passwords may intentionally contain leading/trailing spaces)
   */
  @IsString({ message: 'New password must be a string' })
  @IsNotEmpty({ message: 'New password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(128, { message: 'Password must not exceed 128 characters' })
  newPassword!: string;
}

/**
 * Confirm Forgot Password Response DTO
 *
 * Response for a confirmed password reset.
 *
 * @example
 * ```typescript
 * { success: true, mustChangePassword: false }
 * ```
 */
export class ConfirmForgotPasswordResponseDTO {
  /**
   * True when reset was confirmed and password updated.
   */
  success!: boolean;

  /**
   * Whether user must change password on next sign-in.
   *
   * For forgot-password flows this should typically be false (password is just set).
   */
  mustChangePassword!: boolean;
}
