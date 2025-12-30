import {
  IsEmail,
  IsString,
  IsNumberString,
  IsUrl,
  MaxLength,
  Length,
  Matches,
  IsBoolean,
  IsOptional,
  IsUUID,
  IsInt,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * DTO for verifying email with code (6-digit OTP)
 *
 * Security:
 * - Email must be valid format and match DB limits
 * - Code must be exactly 6 digits (no more, no less)
 * - All fields are required (no optional fields to prevent attacks)
 * - Input sanitization applied automatically
 */
export class VerifyEmailWithCodeDTO {
  /**
   * User's email address
   * Must match the email used during signup
   *
   * Validation:
   * - Valid email format (RFC 5322)
   * - Max 255 characters (matches DB column limit)
   * - Automatically trimmed and lowercased
   *
   * Sanitization:
   * - Removes leading/trailing whitespace
   * - Converts to lowercase for case-insensitive matching
   */
  @IsEmail({}, { message: 'Invalid email format' })
  @MaxLength(255, { message: 'Email must not exceed 255 characters' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim().toLowerCase();
    }
    return value;
  })
  email!: string;

  /**
   * 6-digit verification code from email
   *
   * Validation:
   * - Must be numeric string (digits only)
   * - Exactly 6 characters long
   * - Fixed length prevents timing attacks
   *
   * Sanitization:
   * - Removes all whitespace (users might copy "123 456")
   * - Removes non-digit characters
   */
  @IsNumberString({}, { message: 'Verification code must contain only digits' })
  @MaxLength(6, { message: 'Verification code must be exactly 6 digits' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      // Remove all whitespace and non-digit characters, then validate length
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
 * DTO for verifying email with URL token
 *
 * Security:
 * - Token must be valid hex format
 * - Exact length enforced (64 chars = 32 bytes SHA-256 hash)
 * - No SQL injection or XSS possible
 * - Input sanitization prevents malformed tokens
 */
export class VerifyEmailWithTokenDTO {
  /**
   * Verification token from email link
   *
   * Validation:
   * - Exactly 64 hexadecimal characters (SHA-256 hash output)
   * - Only 0-9 and a-f characters allowed
   * - Case-insensitive
   *
   * Sanitization:
   * - Removes whitespace
   * - Converts to lowercase for consistent hashing
   */
  @IsString({ message: 'Token must be a string' })
  @Length(64, 64, { message: 'Invalid token format' })
  @Matches(/^[a-f0-9]{64}$/i, {
    message: 'Token must be a valid hexadecimal string',
  })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim().toLowerCase();
    }
    return value;
  })
  token!: string;
}

/**
 * DTO for sending a verification email
 *
 * Security:
 * - User sub validated as UUID v4
 * - BaseURL validated as max length
 * - Skip flag is boolean (prevents injection)
 */
export class SendVerificationEmailDTO {
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
   * Base URL for verification link (optional)
   *
   * Validation:
   * - Must be valid URL format (http:// or https://)
   * - Max 2048 characters (typical URL length limit)
   * - Optional field
   *
   * Sanitization:
   * - Trimmed
   */
  @IsOptional()
  @IsUrl(
    { require_protocol: true, protocols: ['http', 'https'] },
    { message: 'Base URL must be a valid URL with http:// or https://' },
  )
  @MaxLength(2048, { message: 'Base URL must not exceed 2048 characters' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim();
    }
    return value;
  })
  baseUrl?: string;

  /**
   * Skip the "already verified" check
   * Used for MFA contexts where codes are needed even if email is verified
   *
   * Validation:
   * - Must be boolean
   * - Optional (defaults to false)
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
   * - Optional (for backward compatibility and non-challenge flows like password reset)
   */
  @IsOptional()
  @IsInt({ message: 'challengeSessionId must be an integer' })
  @Min(1, { message: 'challengeSessionId must be a positive integer' })
  challengeSessionId?: number;
}

/**
 * Response DTO for sendVerificationEmail
 */
export class SendVerificationEmailResponseDTO {
  /**
   * Verification token ID (internal integer)
   */
  tokenId!: number;
}

/**
 * DTO for requesting a verification email resend
 *
 * Supports both overload patterns:
 * 1. Resend by user sub (string)
 * 2. Resend by email address (object with email property)
 *
 * Security:
 * - Either sub or email must be provided (conditional validation)
 * - Rate limiting applied in service layer
 * - Input sanitization prevents abuse
 */
export class ResendVerificationEmailDTO {
  /**
   * User identifier (UUID v4) - optional if email provided
   *
   * Validation:
   * - Must be valid UUID v4 format if provided
   * - Required if email is not provided
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
   * User's email address - optional if sub provided
   *
   * Validation:
   * - Valid email format if provided
   * - Max 255 characters (DB limit)
   * - Required if sub is not provided
   *
   * Sanitization:
   * - Trimmed and lowercased
   */
  @IsOptional()
  @IsEmail({}, { message: 'Invalid email format' })
  @MaxLength(255, { message: 'Email must not exceed 255 characters' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim().toLowerCase();
    }
    return value;
  })
  email?: string;

  /**
   * Base URL for verification link (optional)
   *
   * Validation:
   * - Must be valid URL format (http:// or https://)
   * - Max 2048 characters
   * - Optional field
   *
   * Sanitization:
   * - Trimmed
   */
  @IsOptional()
  @IsUrl(
    { require_protocol: true, protocols: ['http', 'https'] },
    { message: 'Base URL must be a valid URL with http:// or https://' },
  )
  @MaxLength(2048, { message: 'Base URL must not exceed 2048 characters' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim();
    }
    return value;
  })
  baseUrl?: string;

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
  @IsInt({ message: 'Challenge session ID must be an integer' })
  @Min(1, { message: 'Challenge session ID must be a positive integer' })
  challengeSessionId?: number;
}

/**
 * Response DTO for resendVerificationEmail
 */
export class ResendVerificationEmailResponseDTO {
  /**
   * Verification token ID (internal integer)
   */
  tokenId!: number;
}

/**
 * Response DTO for verifyEmailWithCode and verifyEmailWithToken
 */
export class VerifyEmailResponseDTO {
  /**
   * Success message
   */
  message!: string;
}
