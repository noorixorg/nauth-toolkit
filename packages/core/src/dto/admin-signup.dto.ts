import { IsEmail, IsString, MinLength, MaxLength, IsOptional, Matches, IsBoolean, ValidateIf } from 'class-validator';
import { Transform } from 'class-transformer';
import { UserResponseDTO } from './user-response.dto';

/**
 * DTO for administrative user creation with override capabilities
 *
 * Allows administrators to create user accounts with:
 * - Bypass email/phone verification requirements
 * - Force password change on first login
 * - Auto-generate secure passwords
 *
 * Security:
 * - All fields validated against DB constraints
 * - Input sanitization applied automatically
 * - Password strength enforced (8-128 chars) unless auto-generated
 * - Email/username uniqueness checked in service layer
 * - Audit trail records admin-created accounts
 *
 * Warning: This endpoint should be protected by admin authentication.
 * The service does not enforce authorization - it is the responsibility
 * of the framework adapter (NestJS/Express/Fastify) to protect the endpoint.
 *
 * @example
 * ```typescript
 * // Create user with pre-verified email
 * const dto: AdminSignupDTO = {
 *   email: 'user@example.com',
 *   password: 'SecurePass123!',
 *   isEmailVerified: true,
 *   mustChangePassword: false,
 * };
 *
 * // Create user with auto-generated password
 * const dto: AdminSignupDTO = {
 *   email: 'user@example.com',
 *   generatePassword: true,
 *   isEmailVerified: true,
 *   mustChangePassword: true, // User must change generated password
 * };
 * ```
 */
export class AdminSignupDTO {
  /**
   * User email address
   *
   * Validation:
   * - Valid email format (RFC 5322)
   * - Max 255 characters (matches DB limit)
   *
   * Sanitization:
   * - Trimmed and lowercased
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
   * User password
   *
   * Required unless `generatePassword` is true.
   *
   * Validation:
   * - Min 8 characters
   * - Max 128 characters (prevents DoS via bcrypt)
   * - Additional policy checks in service layer
   *
   * Note: NOT trimmed (passwords can have leading/trailing spaces)
   */
  @ValidateIf((o) => !o.generatePassword)
  @IsString({ message: 'Password must be a string' })
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(128, { message: 'Password must not exceed 128 characters' })
  password?: string;

  /**
   * Optional username
   *
   * Validation:
   * - 3-50 characters
   * - Alphanumeric, underscores, and hyphens only
   * - Max 255 characters (DB limit)
   *
   * Sanitization:
   * - Trimmed
   * - Case preserved (username can be case-sensitive per config)
   */
  @IsOptional()
  @IsString({ message: 'Username must be a string' })
  @MinLength(3, { message: 'Username must be at least 3 characters' })
  @MaxLength(255, { message: 'Username must not exceed 255 characters' })
  @Matches(/^[a-zA-Z0-9_-]+$/, {
    message: 'Username can only contain letters, numbers, underscores, and hyphens',
  })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim().toLowerCase();
    }
    return value;
  })
  username?: string;

  /**
   * Optional first name
   *
   * Validation:
   * - 1-100 characters
   * - Max 100 characters (DB limit)
   *
   * Sanitization:
   * - Trimmed
   * - Title case preserved
   */
  @IsOptional()
  @IsString({ message: 'First name must be a string' })
  @MinLength(1, { message: 'First name must be at least 1 character' })
  @MaxLength(100, { message: 'First name must not exceed 100 characters' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim();
    }
    return value;
  })
  firstName?: string;

  /**
   * Optional last name
   *
   * Validation:
   * - 1-100 characters
   * - Max 100 characters (DB limit)
   *
   * Sanitization:
   * - Trimmed
   * - Title case preserved
   */
  @IsOptional()
  @IsString({ message: 'Last name must be a string' })
  @MinLength(1, { message: 'Last name must be at least 1 character' })
  @MaxLength(100, { message: 'Last name must not exceed 100 characters' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim();
    }
    return value;
  })
  lastName?: string;

  /**
   * Optional phone number
   *
   * Validation:
   * - E.164 format (international standard)
   * - MUST start with + (required for security)
   * - Max 20 characters (DB limit)
   * - Example: +14155552671, +61444567890
   *
   * Sanitization:
   * - Whitespace removed
   * - Only digits and leading + preserved
   *
   * Security:
   * - Strict E.164 validation prevents SQL injection
   * - Max length prevents oversized inputs
   */
  @IsOptional()
  @IsString({ message: 'Phone must be a string' })
  @MaxLength(20, { message: 'Phone must not exceed 20 characters' })
  @Matches(/^\+[1-9]\d{1,14}$/, {
    message: 'Phone must be in E.164 format with + prefix (e.g., +14155552671)',
  })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      // Remove all whitespace and keep only digits and +
      return value.replace(/\s/g, '');
    }
    return value;
  })
  phone?: string;

  /**
   * Optional metadata (custom fields)
   *
   * Security:
   * - Validated in service layer if used
   * - Max depth/size limits should be enforced
   */
  @IsOptional()
  metadata?: Record<string, unknown>;

  /**
   * Bypass email verification requirement
   *
   * If true, user's email is marked as verified without sending verification email.
   * If false (default), user must verify email through normal flow.
   *
   * Default: false
   */
  @IsOptional()
  @IsBoolean({ message: 'isEmailVerified must be a boolean' })
  isEmailVerified?: boolean;

  /**
   * Bypass phone verification requirement
   *
   * If true, user's phone is marked as verified without sending verification SMS.
   * If false (default), user must verify phone through normal flow.
   *
   * Default: false
   */
  @IsOptional()
  @IsBoolean({ message: 'isPhoneVerified must be a boolean' })
  isPhoneVerified?: boolean;

  /**
   * Force password change on first login
   *
   * If true, user will be required to change password on next login.
   * Useful when auto-generating passwords or when admin sets temporary passwords.
   *
   * Default: false
   */
  @IsOptional()
  @IsBoolean({ message: 'mustChangePassword must be a boolean' })
  mustChangePassword?: boolean;

  /**
   * Auto-generate secure password
   *
   * If true, a cryptographically secure random password will be generated.
   * The generated password will be returned in the response (returned once only).
   * Password field is not required when this is true.
   *
   * Default: false
   *
   * Security: Generated passwords are 16 characters, mixed case, numbers, and special characters.
   * They are returned once in the response and never stored in plain text.
   */
  @IsOptional()
  @IsBoolean({ message: 'generatePassword must be a boolean' })
  generatePassword?: boolean;
}

/**
 * Response DTO for admin signup
 *
 * Returns the created user object (sanitized, excludes sensitive fields like passwordHash)
 * and optionally the generated password (only if generatePassword was true in the request).
 */
export class AdminSignupResponseDTO {
  /**
   * Created user object (sanitized)
   *
   * Uses UserResponseDto which excludes sensitive fields:
   * - No passwordHash
   * - No internal database ID (uses 'sub' UUID instead)
   * - No MFA secrets
   * - No internal tracking fields
   */
  user!: UserResponseDTO;

  /**
   * Generated password (only present if generatePassword was true)
   *
   * Security: This is returned once and never stored in plain text.
   * The admin should securely deliver this to the user.
   */
  generatedPassword?: string;
}
