/**
 * Admin Reset Password Request DTO
 *
 * Request DTO for admin-initiated password reset workflow.
 * Allows resetting a user's password by identifier (email, username, phone, or sub).
 *
 * Security:
 * - Admin-only operation (should be protected by admin guard)
 * - User identifier validated
 * - Code + optional link delivery (like email verification)
 * - Configurable expiry (default: 1 hour)
 * - Optional immediate session revocation
 * - No rate limiting (admin bypass)
 *
 * @example
 * ```typescript
 * // With link for consumer app custom UI
 * await authService.adminResetPassword({
 *   identifier: 'user@example.com',
 *   baseUrl: 'https://myapp.com/reset-password',
 *   deliveryMethod: 'email',
 *   revokeSessions: true
 * });
 *
 * // Code only (no link)
 * await authService.adminResetPassword({
 *   identifier: 'user@example.com',
 *   deliveryMethod: 'email'
 * });
 * ```
 */

import {
  IsString,
  IsOptional,
  IsBoolean,
  IsIn,
  IsNumber,
  IsUrl,
  IsNotEmpty,
  MinLength,
  MaxLength,
  Min,
  Max,
  Length,
} from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Request DTO for admin password reset
 */
export class AdminResetPasswordDTO {
  /**
   * User identifier (email, username, phone, or sub/UUID)
   *
   * Validation:
   * - Must be a string
   * - Min 1 character
   * - Max 255 characters
   *
   * Sanitization:
   * - Trimmed
   * - Lowercased if email format detected
   *
   * @example "user@example.com" | "johndoe" | "+1234567890" | "uuid"
   */
  @IsString({ message: 'Identifier must be a string' })
  @IsNotEmpty({ message: 'Identifier is required' })
  @MinLength(1, { message: 'Identifier is required' })
  @MaxLength(255, { message: 'Identifier must not exceed 255 characters' })
  @Transform(({ value }: { value: unknown }) => {
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
  identifier!: string;

  /**
   * Delivery method for reset code
   *
   * Validation:
   * - Must be 'email' or 'sms'
   * - Optional (defaults to 'email')
   *
   * @default 'email'
   * @example 'email' | 'sms'
   */
  @IsOptional()
  @IsIn(['email', 'sms'], { message: 'Delivery method must be email or sms' })
  deliveryMethod?: 'email' | 'sms';

  /**
   * Base URL for building reset link
   *
   * Validation:
   * - Must be valid URL with http:// or https://
   * - Max 2048 characters
   * - Optional
   *
   * Sanitization:
   * - Trimmed
   *
   * WHY: Allows consumer apps to build custom reset UI (e.g., myapp.com/reset-password?token=xxx)
   * Like email verification, supports both code AND link delivery
   *
   * @example "https://myapp.com/reset-password"
   */
  @IsOptional()
  @IsUrl(
    { require_protocol: true, protocols: ['http', 'https'] },
    { message: 'Base URL must be valid URL with http:// or https://' },
  )
  @MaxLength(2048, { message: 'Base URL must not exceed 2048 characters' })
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'string') {
      return value.trim();
    }
    return value;
  })
  baseUrl?: string;

  /**
   * Code expiry in seconds
   *
   * Validation:
   * - Must be number
   * - Min 300 seconds (5 minutes)
   * - Max 86400 seconds (24 hours)
   * - Optional
   *
   * @default 3600 (1 hour - longer than user-initiated 15min)
   * @example 3600
   */
  @IsOptional()
  @IsNumber({}, { message: 'Code expiry must be a number' })
  @Min(300, { message: 'Code expiry must be at least 300 seconds (5 minutes)' })
  @Max(86400, { message: 'Code expiry must not exceed 86400 seconds (24 hours)' })
  codeExpiresIn?: number;

  /**
   * Revoke all active sessions immediately (before sending email)
   *
   * Validation:
   * - Must be boolean
   * - Optional
   *
   * WHY: Admin can lock user out immediately while sending reset email
   * Different from confirmAdminResetPassword which always revokes on completion
   *
   * @default false
   * @example true
   */
  @IsOptional()
  @IsBoolean({ message: 'revokeSessions must be a boolean' })
  revokeSessions?: boolean;

  /**
   * Reason for admin-initiated reset (for audit trail)
   *
   * Validation:
   * - Must be string
   * - Max 500 characters
   * - Optional
   *
   * Sanitization:
   * - Trimmed
   *
   * @example "User reported account compromise"
   */
  @IsOptional()
  @IsString({ message: 'Reason must be a string' })
  @MaxLength(500, { message: 'Reason must not exceed 500 characters' })
  @Transform(({ value }: { value: unknown }) => {
    if (typeof value === 'string') {
      return value.trim();
    }
    return value;
  })
  reason?: string;
}

/**
 * Admin Reset Password Response DTO
 *
 * Response DTO for admin-initiated password reset request.
 *
 * @example
 * ```typescript
 * {
 *   success: true,
 *   destination: 'u***r@example.com',
 *   deliveryMedium: 'email',
 *   expiresIn: 3600,
 *   sessionsRevoked: 3
 * }
 * ```
 */
export class AdminResetPasswordResponseDTO {
  /**
   * Success indicator
   * Always true on successful request
   */
  success!: boolean;

  /**
   * Masked destination where code was sent
   * @example "u***r@example.com" | "***-***-5678"
   */
  destination?: string;

  /**
   * Delivery medium used
   * @example "email" | "sms"
   */
  deliveryMedium?: 'email' | 'sms';

  /**
   * Code expiry in seconds
   * @example 3600
   */
  expiresIn?: number;

  /**
   * Number of sessions revoked (if revokeSessions was true)
   * @example 3
   */
  sessionsRevoked?: number;
}

/**
 * Confirm Admin Reset Password DTO
 *
 * User completes admin-initiated password reset with code OR token.
 * Accepts either short code from email/SMS OR long token from link.
 *
 * Security:
 * - One of code or token is required
 * - Token-based: No attempt tracking (single use, long random)
 * - Code-based: Attempt tracking (max 3 attempts)
 * - Always revokes all sessions on completion
 * - Always sets mustChangePassword flag
 *
 * @example
 * ```typescript
 * // With code (from email/SMS)
 * await authService.confirmAdminResetPassword({
 *   identifier: 'user@example.com',
 *   code: '123456',
 *   newPassword: 'NewSecurePass123!'
 * });
 *
 * // With token (from link)
 * await authService.confirmAdminResetPassword({
 *   identifier: 'user@example.com',
 *   token: '64-char-hex-token-from-link',
 *   newPassword: 'NewSecurePass123!'
 * });
 * ```
 */
export class ConfirmAdminResetPasswordDTO {
  /**
   * User identifier (email, username, phone, or sub/UUID)
   *
   * Validation:
   * - Must be a string
   * - Min 1 character
   * - Max 255 characters
   *
   * Sanitization:
   * - Trimmed
   * - Lowercased if email format detected
   *
   * @example "user@example.com"
   */
  @IsString({ message: 'Identifier must be a string' })
  @IsNotEmpty({ message: 'Identifier is required' })
  @MinLength(1, { message: 'Identifier is required' })
  @MaxLength(255, { message: 'Identifier must not exceed 255 characters' })
  @Transform(({ value }: { value: unknown }) => {
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
  identifier!: string;

  /**
   * Verification code from email/SMS (6-10 digits)
   *
   * Validation:
   * - Must be string
   * - Length 6-10 characters
   * - Optional (token OR code required)
   *
   * Sanitization:
   * - Trimmed
   *
   * WHY: Short code for manual entry, subject to attempt tracking
   *
   * @example "123456"
   */
  @IsOptional()
  @IsString({ message: 'Code must be a string' })
  @Length(6, 10, { message: 'Code must be between 6 and 10 characters' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim();
    }
    return value;
  })
  code?: string;

  /**
   * Verification token from link (64-char hex)
   *
   * Validation:
   * - Must be string
   * - Optional (token OR code required)
   *
   * Sanitization:
   * - Trimmed
   *
   * WHY: Long token from link, single-use, no attempt tracking needed
   *
   * @example "a1b2c3d4..."
   */
  @IsOptional()
  @IsString({ message: 'Token must be a string' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim();
    }
    return value;
  })
  token?: string;

  /**
   * New password
   *
   * Validation:
   * - Must be string
   * - Min 8 characters (security requirement)
   * - Max 128 characters (prevents DoS)
   *
   * Note: NOT trimmed (passwords can have leading/trailing spaces)
   * Additional checks in service layer:
   * - Password strength (if configured)
   * - Password history (prevent reuse)
   *
   * @example "NewSecurePassword123!"
   */
  @IsString({ message: 'New password must be a string' })
  @IsNotEmpty({ message: 'New password is required' })
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(128, { message: 'Password must not exceed 128 characters' })
  newPassword!: string;
}

/**
 * Confirm Admin Reset Password Response DTO
 *
 * Response DTO for successful admin password reset completion.
 *
 * @example
 * ```typescript
 * {
 *   success: true
 * }
 * ```
 */
export class ConfirmAdminResetPasswordResponseDTO {
  /**
   * Success indicator
   * Always true on successful reset
   */
  success!: boolean;
}
