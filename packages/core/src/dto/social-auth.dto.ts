import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * DTO for linking social account
 *
 * Security:
 * - User ID validated as UUID v4
 * - Provider name validated
 * - Code and state validated for length
 */
export class LinkSocialAccountDTO {
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
  userId!: string;

  /**
   * Social provider name (e.g., 'google', 'apple', 'facebook')
   *
   * Validation:
   * - Must be non-empty string
   * - Max 50 characters
   *
   * Sanitization:
   * - Trimmed and lowercased
   */
  @IsString({ message: 'Provider must be a string' })
  @MaxLength(50, { message: 'Provider name must not exceed 50 characters' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim().toLowerCase();
    }
    return value;
  })
  provider!: string;

  /**
   * Authorization code from OAuth callback
   *
   * Validation:
   * - Must be non-empty string
   * - Max 1000 characters
   *
   * Sanitization:
   * - Trimmed
   */
  @IsString({ message: 'Code must be a string' })
  @MaxLength(1000, { message: 'Authorization code must not exceed 1000 characters' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim();
    }
    return value;
  })
  code!: string;

  /**
   * State parameter from OAuth callback (for CSRF validation)
   *
   * Validation:
   * - Must be non-empty string
   * - Max 500 characters
   *
   * Sanitization:
   * - Trimmed
   */
  @IsString({ message: 'State must be a string' })
  @MaxLength(500, { message: 'State must not exceed 500 characters' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim();
    }
    return value;
  })
  state!: string;
}

/**
 * Response DTO for linkSocialAccount
 */
export class LinkSocialAccountResponseDTO {
  /**
   * Success message
   */
  message!: string;

  /**
   * Provider name
   */
  provider!: string;
}

/**
 * DTO for getting linked social accounts
 *
 * Security:
 * - User ID validated as UUID v4
 */
export class GetLinkedAccountsDTO {
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
  userId!: string;
}

/**
 * Response DTO for getLinkedAccounts
 */
export class GetLinkedAccountsResponseDTO {
  /**
   * Array of linked social accounts
   */
  accounts!: Array<{
    provider: string;
    providerEmail?: string;
    linkedAt: Date;
    lastUsedAt?: Date;
  }>;
}

/**
 * DTO for unlinking social account
 *
 * Security:
 * - User ID validated as UUID v4
 * - Provider name validated
 */
export class UnlinkSocialAccountDTO {
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
  userId!: string;

  /**
   * Social provider name (e.g., 'google', 'apple', 'facebook')
   *
   * Validation:
   * - Must be non-empty string
   * - Max 50 characters
   *
   * Sanitization:
   * - Trimmed and lowercased
   */
  @IsString({ message: 'Provider must be a string' })
  @MaxLength(50, { message: 'Provider name must not exceed 50 characters' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim().toLowerCase();
    }
    return value;
  })
  provider!: string;
}

/**
 * Response DTO for unlinkSocialAccount
 */
export class UnlinkSocialAccountResponseDTO {
  /**
   * Success message
   */
  message!: string;
}

/**
 * DTO for checking if user can set password
 *
 * Security:
 * - User ID validated as UUID v4
 */
export class CanSetPasswordDTO {
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
  userId!: string;
}

/**
 * Response DTO for canSetPassword
 */
export class CanSetPasswordResponseDTO {
  /**
   * Whether user can set password
   */
  canSetPassword!: boolean;
}

/**
 * DTO for setting password for social-only user
 *
 * Security:
 * - User ID validated as UUID v4
 * - Password validated for strength (delegated to AuthService)
 */
export class SetPasswordForSocialUserDTO {
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
  userId!: string;

  /**
   * New password
   *
   * Validation:
   * - Must be non-empty string
   * - Min 1 character (actual validation in AuthService)
   * - Max 128 characters (matches DB constraint)
   *
   * Sanitization:
   * - Not trimmed (passwords may have leading/trailing spaces intentionally)
   */
  @IsString({ message: 'Password must be a string' })
  @MinLength(1, { message: 'Password is required' })
  @MaxLength(128, { message: 'Password must not exceed 128 characters' })
  password!: string;
}

/**
 * Response DTO for setPasswordForSocialUser
 */
export class SetPasswordForSocialUserResponseDTO {
  /**
   * Success message
   */
  message!: string;
}

/**
 * DTO for exchanging a social redirect exchange token
 *
 * Used in redirect-first social login flow. The backend redirects back to the frontend
 * with an `exchangeToken` in the URL, and the frontend exchanges it for an AuthResponse.
 *
 * Security:
 * - Exchange token validated for length
 * - One-time use (consumed immediately)
 * - Short TTL (default: 60 seconds)
 */
export class SocialExchangeDTO {
  /**
   * One-time exchange token from callback redirect URL
   *
   * Validation:
   * - Must be non-empty string
   * - Max 500 characters
   *
   * Sanitization:
   * - Trimmed
   */
  @IsString({ message: 'exchangeToken must be a string' })
  @MaxLength(500, { message: 'exchangeToken must not exceed 500 characters' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim();
    }
    return value;
  })
  exchangeToken!: string;
}
