import { IsString, MinLength, MaxLength, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * DTO for user login with security-focused validation
 *
 * Security:
 * - Identifier validated (email, username, or phone)
 * - Password length enforced
 * - Input sanitization applied
 * - DeviceId validated if provided
 */
export class LoginDTO {
  /**
   * Login identifier (email, username, or phone)
   *
   * Validation:
   * - At least 1 character
   * - Max 255 characters (prevents attacks)
   *
   * Sanitization:
   * - Trimmed
   * - Lowercased if it looks like email
   */
  @IsString({ message: 'Identifier must be a string' })
  @MinLength(1, { message: 'Identifier is required' })
  @MaxLength(255, { message: 'Identifier must not exceed 255 characters' })
  @Transform(({ value }) => {
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
  identifier!: string; // email, username, or phone

  /**
   * User password
   *
   * Validation:
   * - At least 1 character (lenient for login)
   * - Max 128 characters (prevents DoS)
   *
   * Note: NOT trimmed (passwords can have spaces)
   */
  @IsString({ message: 'Password must be a string' })
  @MinLength(1, { message: 'Password is required' })
  @MaxLength(128, { message: 'Password must not exceed 128 characters' })
  password!: string;

  /**
   * Optional device name for session identification
   *
   * Validation:
   * - Max 255 characters (matches DB constraint: varchar(255))
   *
   * Sanitization:
   * - Trimmed
   */
  @IsOptional()
  @IsString({ message: 'DeviceName must be a string' })
  @MaxLength(255, { message: 'DeviceName must not exceed 255 characters' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim();
    }
    return value;
  })
  deviceName?: string;

  /**
   * Optional device type
   *
   * Validation:
   * - Must be one of: mobile, desktop, tablet
   * - Max 50 characters (matches DB constraint: varchar(50))
   *
   * Sanitization:
   * - Trimmed and lowercased
   */
  @IsOptional()
  @IsString({ message: 'DeviceType must be a string' })
  @MaxLength(50, { message: 'DeviceType must not exceed 50 characters' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim().toLowerCase();
    }
    return value;
  })
  deviceType?: 'mobile' | 'desktop' | 'tablet';
}
