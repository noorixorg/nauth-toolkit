import { IsEmail, IsString, MinLength, MaxLength, IsOptional, Matches, IsBoolean, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { UserResponseDto } from './user-response.dto';

/**
 * DTO for administrative social user import with override capabilities
 *
 * Allows administrators to import existing social users from external platforms
 * (e.g., Cognito, Auth0) into nauth with:
 * - Bypass email/phone verification requirements
 * - Optional password for hybrid social+password accounts
 * - Social account linkage (provider + providerId)
 * - Automatic user flag updates (hasSocialAuth)
 *
 * Use case: Migrating users from external authentication platforms while
 * preserving their social login connections for transparent future logins.
 *
 * Security:
 * - All fields validated against DB constraints
 * - Input sanitization applied automatically
 * - Email/username uniqueness checked in service layer
 * - Provider+providerId uniqueness enforced (one social account per provider per user)
 * - Audit trail records admin-imported social accounts
 *
 * Warning: This endpoint should be protected by admin authentication.
 * The service does not enforce authorization - it is the responsibility
 * of the framework adapter (NestJS/Express/Fastify) to protect the endpoint.
 *
 * @example
 * ```typescript
 * // Import social-only user from Cognito
 * const dto: AdminSignupSocialDTO = {
 *   email: 'user@example.com',
 *   provider: 'google',
 *   providerId: 'google_12345',
 *   providerEmail: 'user@gmail.com',
 *   socialMetadata: { sub: 'google_12345', given_name: 'John' },
 *   isEmailVerified: true,
 * };
 *
 * // Import hybrid user with password + social
 * const dto: AdminSignupSocialDTO = {
 *   email: 'user@example.com',
 *   password: 'SecurePass123!',
 *   provider: 'apple',
 *   providerId: 'apple_67890',
 *   isEmailVerified: true,
 * };
 * ```
 */
export class AdminSignupSocialDTO {
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
   * Optional first name
   *
   * Validation:
   * - 1-100 characters
   * - Letters, spaces, hyphens, and apostrophes only
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
  @Matches(/^[a-zA-Z\s\-']+$/, {
    message: 'First name can only contain letters, spaces, hyphens, and apostrophes',
  })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim();
    }
    return value;
  })
  firstName?: string;

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
   * Optional last name
   *
   * Validation:
   * - 1-100 characters
   * - Letters, spaces, hyphens, and apostrophes only
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
  @Matches(/^[a-zA-Z\s\-']+$/, {
    message: 'Last name can only contain letters, spaces, hyphens, and apostrophes',
  })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim();
    }
    return value;
  })
  lastName?: string;

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
   * Force password change on first login
   *
   * If true, user will be required to change password on next login.
   * Only relevant if password is provided (hybrid social+password account).
   *
   * Default: false
   */
  @IsOptional()
  @IsBoolean({ message: 'mustChangePassword must be a boolean' })
  mustChangePassword?: boolean;

  /**
   * Optional password for hybrid social+password accounts
   *
   * Validation:
   * - Min 8 characters
   * - Max 128 characters (prevents DoS via bcrypt)
   * - Additional policy checks in service layer
   *
   * Note: NOT trimmed (passwords can have leading/trailing spaces)
   *
   * Security: If not provided, user will be social-only (no password login).
   * Password can be set later via setPasswordForSocialUser().
   */
  @IsOptional()
  @IsString({ message: 'Password must be a string' })
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(128, { message: 'Password must not exceed 128 characters' })
  password?: string;

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
   * Social provider name
   *
   * The OAuth provider that the user authenticated with.
   * Must match one of the supported providers.
   *
   * Validation:
   * - Must be 'google', 'apple', or 'facebook'
   * - Required field
   */
  @IsEnum(['google', 'apple', 'facebook'], {
    message: 'Provider must be one of: google, apple, facebook',
  })
  provider!: 'google' | 'apple' | 'facebook';

  /**
   * Provider's email address
   *
   * The email address associated with the user's social account.
   * May differ from primary email if user has multiple email addresses.
   * Used for audit trails and account linking verification.
   *
   * Validation:
   * - Valid email format
   * - Max 255 characters
   *
   * Optional: Some providers (like Apple with private relay) may not expose email.
   */
  @IsOptional()
  @IsString({ message: 'Provider email must be a string' })
  @IsEmail({}, { message: 'Provider email must be valid email format' })
  @MaxLength(255, { message: 'Provider email must not exceed 255 characters' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim().toLowerCase();
    }
    return value;
  })
  providerEmail?: string;

  /**
   * Provider's unique user identifier
   *
   * The unique ID assigned by the OAuth provider (e.g., Google sub, Apple user ID).
   * Used to link the social account to the user record.
   *
   * Validation:
   * - Required field
   * - Max 255 characters (DB limit)
   * - Unique per provider (enforced at DB level)
   *
   * Security: provider+providerId combination must be unique across all users.
   */
  @IsString({ message: 'Provider ID must be a string' })
  @MaxLength(255, { message: 'Provider ID must not exceed 255 characters' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim();
    }
    return value;
  })
  providerId!: string;

  /**
   * Raw OAuth profile data from provider
   *
   * Stores the complete OAuth profile response from the provider.
   * Useful for debugging, audit trails, and extracting additional user attributes.
   *
   * Security:
   * - Stored as JSON in database
   * - Not exposed in public APIs
   * - Used internally for troubleshooting
   *
   * @example
   * ```json
   * {
   *   "sub": "google_12345",
   *   "email": "user@gmail.com",
   *   "given_name": "John",
   *   "family_name": "Doe",
   *   "picture": "https://...",
   *   "locale": "en"
   * }
   * ```
   */
  @IsOptional()
  socialMetadata?: Record<string, unknown>;

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
   * - Lowercased
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
}

/**
 * Response DTO for admin social signup
 *
 * Returns the created user object (sanitized, excludes sensitive fields like passwordHash)
 * and social account information for confirmation.
 */
export class AdminSignupSocialResponseDTO {
  /**
   * Social account information
   *
   * Confirms the social account linkage for the imported user.
   */
  socialAccount!: {
    /**
     * Social provider name
     */
    provider: string;
    /**
     * Provider's unique user identifier
     */
    providerId: string;
    /**
     * Provider's email address (if available)
     */
    providerEmail: string | null;
  };

  /**
   * Created user object (sanitized)
   *
   * Uses UserResponseDto which excludes sensitive fields:
   * - No passwordHash
   * - No internal database ID (uses 'sub' UUID instead)
   * - No MFA secrets
   * - No internal tracking fields
   */
  user!: UserResponseDto;
}
