import { IsUUID, IsNumberString, Length } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Verify Phone with Code by User Sub DTO
 *
 * Used for phone verification with 6-digit OTP code when allowing duplicate phones.
 * Requires user sub to identify which user's phone to verify.
 *
 * Security:
 * - UUID format validated (prevents injection)
 * - Code format validated (6 digits)
 *
 * @example
 * ```typescript
 * POST /auth/verify-phone/verify-by-sub
 * {
 *   "sub": "a21b654c-2746-4168-acee-c175083a65cd",
 *   "code": "123456"
 * }
 * ```
 */
export class VerifyPhoneWithCodeBySubDTO {
  /**
   * User's external identifier (sub/UUID v4)
   *
   * Validation:
   * - Must be a valid UUID v4 format
   * - Matches DB constraint: char(36) or uuid
   *
   * Sanitization:
   * - Trimmed and lowercased for consistency
   *
   * @example "a21b654c-2746-4168-acee-c175083a65cd"
   */
  @IsUUID('4', { message: 'Sub must be a valid UUID v4 format' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim().toLowerCase();
    }
    return value;
  })
  sub!: string;

  /**
   * 6-digit verification code
   *
   * Validation:
   * - Must be a numeric string
   * - Exactly 6 digits
   *
   * @example "123456"
   */
  @IsNumberString({}, { message: 'Code must contain only digits' })
  @Length(6, 6, { message: 'Code must be exactly 6 digits' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      const cleaned = value.replace(/\D/g, '');
      return cleaned.length === 6 ? cleaned : value;
    }
    return value;
  })
  code!: string;
}
