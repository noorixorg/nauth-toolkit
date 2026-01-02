import { IsString, IsUUID, MaxLength, MinLength, IsOptional, IsObject } from 'class-validator';
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
 * DTO for handling OAuth callback
 *
 * Used when processing OAuth callback from social providers after user authorization.
 *
 * Security:
 * - Code validated for length
 * - State validated for CSRF protection
 *
 * @example
 * ```typescript
 * const dto: HandleCallbackDTO = {
 *   code: 'authorization_code_from_provider',
 *   state: 'csrf_state_token'
 * };
 * ```
 */
export class HandleCallbackDTO {
  /**
   * Authorization code from OAuth callback
   *
   * Validation:
   * - Must be non-empty string
   * - Max 2000 characters
   *
   * Sanitization:
   * - Trimmed
   */
  @IsString({ message: 'Code must be a string' })
  @MaxLength(2000, { message: 'Authorization code must not exceed 2000 characters' })
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
 * DTO for verifying social authentication token from native mobile apps
 *
 * Used when mobile apps (iOS, Android) use native SDKs (e.g., Google Sign-In SDK,
 * Sign in with Apple) and need to verify the ID token on the backend.
 *
 * Security:
 * - ID token validated by provider-specific verification
 * - Token must be fresh (not expired)
 * - Signature verification performed
 *
 * @example
 * ```typescript
 * // Google Sign-In from iOS/Android
 * const dto: VerifyTokenDTO = {
 *   idToken: 'eyJhbGciOiJSUzI1NiIs...',
 *   accessToken: 'ya29.a0AfH6SM...'
 * };
 *
 * // Sign in with Apple from iOS
 * const dto: VerifyTokenDTO = {
 *   idToken: 'eyJraWQiOiJlWGF1bm...',
 *   profileData: {
 *     name: { firstName: 'John', lastName: 'Doe' },
 *     email: 'user@privaterelay.appleid.com'
 *   }
 * };
 * ```
 */
export class VerifyTokenDTO {
  /**
   * ID token from native SDK
   *
   * JWT token issued by the social provider's native SDK.
   * Must be verified against provider's public keys.
   *
   * Validation:
   * - Must be non-empty string
   * - Max 10000 characters (JWT tokens can be large)
   *
   * Sanitization:
   * - Trimmed
   */
  @IsString({ message: 'idToken must be a string' })
  @MaxLength(10000, { message: 'idToken must not exceed 10000 characters' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim();
    }
    return value;
  })
  idToken!: string;

  /**
   * Optional access token from native SDK
   *
   * Some providers (e.g., Google) provide an access token alongside the ID token.
   * This can be used for additional API calls or verification.
   *
   * Validation:
   * - Optional
   * - Max 2000 characters
   *
   * Sanitization:
   * - Trimmed
   */
  @IsOptional()
  @IsString({ message: 'accessToken must be a string' })
  @MaxLength(2000, { message: 'accessToken must not exceed 2000 characters' })
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.trim();
    }
    return value;
  })
  accessToken?: string;

  /**
   * Optional profile data from native SDK
   *
   * Some providers (e.g., Apple) only provide user profile data on first sign-in.
   * Clients should capture and send this data for proper user creation.
   *
   * Validation:
   * - Optional
   * - Must be a valid object if provided
   *
   * @example
   * ```typescript
   * {
   *   name: { firstName: 'John', lastName: 'Doe' },
   *   email: 'user@privaterelay.appleid.com'
   * }
   * ```
   */
  @IsOptional()
  @IsObject({ message: 'profileData must be an object' })
  profileData?: Record<string, unknown>;
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
