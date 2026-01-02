import { IsEmail, IsString, MinLength, MaxLength, IsOptional, Matches, IsBoolean, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { MFADeviceMethod, MFAMethod } from '../enums/mfa-method.enum';

/**
 * DTO for updating user attributes
 *
 * Security:
 * - All fields validated against DB constraints
 * - Input sanitization applied automatically
 * - Email uniqueness checked in service layer
 * - Phone uniqueness checked in service layer
 * - Username uniqueness checked in service layer
 *
 * @example
 * ```typescript
 * const updateData: UserUpdateDTO = {
 *   firstName: 'John',
 *   lastName: 'Doe',
 *   email: 'john.doe@example.com',
 *   phone: '+61444567890'
 * };
 * ```
 */
export class UserUpdateDTO {
  /**
   * Optional username update
   *
   * Validation:
   * - 3-50 characters
   * - Alphanumeric, underscores, and hyphens only
   * - Max 255 characters (DB limit)
   * - Uniqueness checked in service layer
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
      return value.trim();
    }
    return value;
  })
  username?: string;

  /**
   * Optional first name update
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
   * Optional last name update
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
   * Optional email address update
   *
   * Validation:
   * - Valid email format (RFC 5322)
   * - Max 255 characters (matches DB limit)
   * - Uniqueness checked in service layer
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
   * Optional phone number update
   *
   * Validation:
   * - E.164 format (international standard)
   * - MUST start with + (required for security)
   * - Max 20 characters (DB limit)
   * - Uniqueness checked in service layer
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
   * Optional metadata update (custom fields)
   *
   * Behavior:
   * - Existing metadata is merged with new values
   * - To delete a metadata key, set it to null
   * - To update a value, provide the new value
   * - To add a new key, include it in the object
   *
   * Security:
   * - Validated in service layer if used
   * - Max depth/size limits should be enforced
   *
   * @example
   * ```typescript
   * // Add or update keys
   * await authService.updateUserAttributes({
   *   sub: 'user-123',
   *   metadata: { newKey: 'value', existingKey: 'updated' }
   * });
   *
   * // Delete a key by setting it to null
   * await authService.updateUserAttributes({
   *   sub: 'user-123',
   *   metadata: { keyToDelete: null }
   * });
   * ```
   */
  @IsOptional()
  metadata?: Record<string, unknown>;

  /**
   * Optional preferred MFA method
   *
   * Sets the user's preferred MFA method for authentication.
   * Must be one of the MFA device methods the user has configured.
   *
   * Validation:
   * - Must be one of: totp, sms, email, passkey
   * - Max 50 characters (matches typical method name length)
   *
   * @example
   * ```typescript
   * await authService.updateUserAttributes(userId, {
   *   preferredMfaMethod: 'totp'
   * });
   * ```
   */
  @IsOptional()
  @IsEnum([MFAMethod.TOTP, MFAMethod.SMS, MFAMethod.EMAIL, MFAMethod.PASSKEY], {
    message: 'Preferred MFA method must be one of: totp, sms, email, passkey',
  })
  @MaxLength(50, { message: 'Preferred MFA method must not exceed 50 characters' })
  preferredMfaMethod?: MFADeviceMethod;

  /**
   * Optional flag to retain verification status when updating email/phone
   *
   * When true:
   * - Email verification status is preserved when email is updated
   * - Phone verification status is preserved when phone is updated
   * - Useful when verification was done externally or outside nauth-toolkit
   *
   * When false or undefined (default):
   * - Email verification is reset to false when email is updated
   * - Phone verification is reset to false when phone is updated
   * - User must re-verify the new email/phone
   *
   * @example
   * ```typescript
   * // Update email but keep verification status (external verification)
   * await authService.updateUserAttributes(userId, {
   *   email: 'new@example.com',
   *   retainVerification: true
   * });
   * ```
   */
  @IsOptional()
  @IsBoolean({ message: 'retainVerification must be a boolean' })
  retainVerification?: boolean;
}
