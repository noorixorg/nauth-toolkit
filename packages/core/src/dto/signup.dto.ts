import { IsEmail, IsString, MinLength, MaxLength, IsOptional, Matches } from 'class-validator';
import { Transform } from 'class-transformer';
import { IsIanaTimezone, IsBcp47Locale } from '../validators/locale-timezone.validator';

/**
 * DTO for user signup with comprehensive validation
 *
 * Security:
 * - All fields validated against DB constraints
 * - Input sanitization applied automatically
 * - Password strength enforced (8-128 chars)
 * - Email/username uniqueness checked in service layer
 */
export class SignupDTO {
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
   * Validation:
   * - Min 8 characters
   * - Max 128 characters (prevents DoS via Argon2 hashing)
   * - Additional policy checks in service layer
   *
   * Note: NOT trimmed (passwords can have leading/trailing spaces)
   */
  @IsString({ message: 'Password must be a string' })
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(128, { message: 'Password must not exceed 128 characters' })
  password!: string;

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
   *
   * Note: Using regex for E.164 format as IsPhoneNumber requires specific country codes
   * and doesn't support international E.164 format validation directly
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
   * Optional IANA timezone (e.g. 'Europe/Dublin')
   *
   * Normally captured from the browser by the frontend SDK, and changeable later by the
   * user or an admin. Used to render dates in notification emails in the user's own time.
   * Falls back to the server default when absent.
   *
   * Validation:
   * - Must be an IANA timezone name this runtime recognises
   * - Max 64 characters (DB limit)
   *
   * Sanitization:
   * - Trimmed
   */
  @IsOptional()
  @IsString({ message: 'Timezone must be a string' })
  @MaxLength(64, { message: 'Timezone must not exceed 64 characters' })
  @IsIanaTimezone({ message: 'Timezone must be a valid IANA name (e.g. Europe/Dublin)' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  timezone?: string;

  /**
   * Optional BCP 47 locale (e.g. 'en-GB')
   *
   * Normally captured from the browser by the frontend SDK, and changeable later by the
   * user or an admin. Controls date *formatting* in notification emails — it does not
   * translate message text. Falls back to the server default when absent.
   *
   * Validation:
   * - Must be a structurally valid BCP 47 language tag
   * - Max 35 characters (RFC 5646 limit)
   *
   * Sanitization:
   * - Trimmed
   */
  @IsOptional()
  @IsString({ message: 'Locale must be a string' })
  @MaxLength(35, { message: 'Locale must not exceed 35 characters' })
  @IsBcp47Locale({ message: 'Locale must be a valid BCP 47 tag (e.g. en-GB)' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  locale?: string;

  /**
   * Optional reCAPTCHA token
   *
   * Required when server has reCAPTCHA enabled and enforces validation
   * for the current token delivery mode (typically 'cookies' for web).
   *
   * Validation:
   * - Must be a string
   * - Token is single-use and expires after 2 minutes
   * - Token must be generated for correct action (e.g., 'signup')
   *
   * Security:
   * - Token validation happens server-side only
   * - Invalid/expired tokens result in RECAPTCHA_VALIDATION_FAILED error
   * - Low scores (v3) result in RECAPTCHA_SCORE_TOO_LOW error
   *
   * @example Web app (v3 automatic)
   * ```typescript
   * // Angular: Token auto-generated by AuthService
   * await this.authService.signup({ email, password });
   *
   * // Vanilla JS: Generate token manually
   * const token = await grecaptcha.execute(siteKey, { action: 'signup' });
   * await client.signup({ email, password, recaptchaToken: token });
   * ```
   *
   * @example Web app (v2 checkbox)
   * ```typescript
   * const token = grecaptcha.getResponse(widgetId);
   * await client.signup({ email, password, recaptchaToken: token });
   * ```
   */
  @IsOptional()
  @IsString({ message: 'ReCAPTCHA token must be a string' })
  recaptchaToken?: string;
}
