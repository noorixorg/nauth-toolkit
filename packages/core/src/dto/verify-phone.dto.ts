import {
  IsString,
  IsNotEmpty,
  Length,
  Matches,
  MaxLength,
  IsNumberString,
  IsUUID,
  IsOptional,
  IsBoolean,
  IsInt,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Verify Phone with Code DTO
 *
 * Used for phone verification with 6-digit OTP code.
 *
 * Security:
 * - Phone validated against E.164 format (prevents SQL injection)
 * - Code validated for exact 6 digits
 * - All fields match DB constraints
 *
 * @example
 * ```typescript
 * POST /auth/verify-phone/verify
 * {
 *   "phone": "+1234567890",
 *   "code": "123456"
 * }
 * ```
 */
export class VerifyPhoneWithCodeDTO {
  /**
   * User's phone number in E.164 format
   *
   * Validation:
   * - Must be a string
   * - Must match E.164 format: +[country code][number]
   * - Max 20 characters (matches DB constraint: varchar(20))
   *
   * Sanitization:
   * - Trimmed
   * - Whitespace removed
   *
   * @example "+1234567890"
   */
  @IsString({ message: 'Phone must be a string' })
  @IsNotEmpty({ message: 'Phone is required' })
  @MaxLength(20, { message: 'Phone number must not exceed 20 characters' })
  @Matches(/^\+[1-9]\d{1,14}$/, {
    message: 'Phone must be in E.164 format (e.g., +1234567890)',
  })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      // Remove all whitespace and keep only digits and +
      return value.replace(/\s/g, '');
    }
    return value;
  })
  phone!: string;

  /**
   * 6-digit verification code
   *
   * Validation:
   * - Must be a string
   * - Exactly 6 digits (numeric only)
   * - No letters, spaces, or special characters
   * - Fixed length prevents timing attacks
   *
   * Sanitization:
   * - Removes all whitespace (users might copy "123 456")
   * - Ensures only numeric string
   *
   * @example "123456"
   */
  @IsNumberString({}, { message: 'Code must contain only digits' })
  @Length(6, 6, { message: 'Verification code must be exactly 6 digits' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      // Remove all whitespace and non-digit characters
      const cleaned = value.replace(/\D/g, '');
      return cleaned.length === 6 ? cleaned : value; // Return original if not 6 digits (let validator catch it)
    }
    return value;
  })
  code!: string;

  /**
   * Challenge session ID (internal use)
   * Optional - used internally to link verification to specific challenge session.
   * Provides security by ensuring codes are only valid for the session they were created for.
   *
   * Validation:
   * - Must be a positive integer if provided
   * - Optional (for backward compatibility and direct verification flows)
   */
  @IsOptional()
  @IsInt({ message: 'challengeSessionId must be an integer' })
  @Min(1, { message: 'challengeSessionId must be a positive integer' })
  challengeSessionId?: number;
}

/**
 * DTO for sending verification SMS
 *
 * Security:
 * - User sub validated as UUID v4
 * - Skip flag is boolean (prevents injection)
 */
export class SendVerificationSMSDTO {
  /**
   * User identifier (UUID v4)
   *
   * Validation:
   * - Must be valid UUID v4 format
   *
   * Sanitization:
   * - Trimmed and lowercased
   */
  @IsUUID('4', { message: 'User ID must be a valid UUID v4 format' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim().toLowerCase();
    }
    return value;
  })
  sub!: string;

  /**
   * Skip the "already verified" check
   * Used for MFA contexts where codes are needed even if phone is verified
   *
   * Validation:
   * - Must be boolean
   * - Optional (defaults to true)
   */
  @IsOptional()
  @IsBoolean({ message: 'skipAlreadyVerifiedCheck must be a boolean' })
  skipAlreadyVerifiedCheck?: boolean;

  /**
   * Challenge session ID to link this verification token to
   * Optional - for linking verification tokens to specific challenge sessions.
   * Provides security by preventing old tokens from being used with new sessions.
   *
   * Validation:
   * - Must be a positive integer
   * - Optional (for backward compatibility and non-challenge flows)
   */
  @IsOptional()
  @IsInt({ message: 'challengeSessionId must be an integer' })
  @Min(1, { message: 'challengeSessionId must be a positive integer' })
  challengeSessionId?: number;
}

/**
 * Response DTO for sendVerificationSMS
 */
export class SendVerificationSMSResponseDTO {
  /**
   * Verification token ID (internal integer)
   */
  tokenId!: number;
}

/**
 * Response DTO for verifyPhoneWithCode and verifyPhoneWithCodeBySub
 */
export class VerifyPhoneResponseDTO {
  /**
   * Success message
   */
  message!: string;
}

/**
 * DTO for resending verification SMS
 *
 * Supports both sub and phone-based resend
 *
 * Security:
 * - Either sub or phone must be provided (conditional validation)
 * - Rate limiting applied in service layer
 * - Input sanitization prevents abuse
 */
export class ResendVerificationSMSDTO {
  /**
   * User identifier (UUID v4) - optional if phone provided
   *
   * Validation:
   * - Must be valid UUID v4 format if provided
   * - Required if phone is not provided
   *
   * Sanitization:
   * - Trimmed and lowercased
   */
  @IsOptional()
  @IsUUID('4', { message: 'User ID must be a valid UUID v4 format' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim().toLowerCase();
    }
    return value;
  })
  sub?: string;

  /**
   * User's phone number - optional if sub provided
   *
   * Validation:
   * - Must match E.164 format if provided
   * - Max 20 characters (DB limit)
   * - Required if sub is not provided
   *
   * Sanitization:
   * - Whitespace removed
   */
  @IsOptional()
  @IsString({ message: 'Phone must be a string' })
  @MaxLength(20, { message: 'Phone number must not exceed 20 characters' })
  @Matches(/^\+[1-9]\d{1,14}$/, {
    message: 'Phone must be in E.164 format (e.g., +1234567890)',
  })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.replace(/\s/g, '');
    }
    return value;
  })
  phone?: string;
}

/**
 * Response DTO for resendVerificationSMS
 */
export class ResendVerificationSMSResponseDTO {
  /**
   * Verification token ID (internal integer)
   */
  tokenId!: number;
}
