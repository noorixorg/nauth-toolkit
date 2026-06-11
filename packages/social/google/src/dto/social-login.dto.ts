import { IsString, IsOptional, IsNotEmpty, IsEnum, MaxLength, IsNumber } from 'class-validator';

/**
 * Social provider enum
 */
export enum SocialProvider {
  GOOGLE = 'google',
  APPLE = 'apple',
  FACEBOOK = 'facebook',
}

/**
 * DTO for initiating social login
 * Used to generate OAuth URLs for social providers
 *
 * @example
 * ```typescript
 * // Generate Google OAuth URL
 * const dto = new SocialLoginDTO();
 * dto.provider = 'google';
 * dto.state = 'random-state-string';
 * ```
 */
export class SocialLoginDTO {
  /**
   * Social provider name
   * Must be one of the configured providers
   *
   * Validation:
   * - Must be a valid SocialProvider enum value
   */
  @IsEnum(SocialProvider, { message: 'Provider must be one of: google, apple, facebook' })
  provider!: SocialProvider;

  /**
   * Optional state parameter for OAuth flow
   * Used to prevent CSRF attacks and maintain state
   * If not provided, a random state will be generated
   *
   * Validation:
   * - Must be a string if present
   * - Max 500 characters (typical OAuth state length)
   */
  @IsOptional()
  @IsString({ message: 'State must be a string' })
  @MaxLength(500, { message: 'State must not exceed 500 characters' })
  state?: string;
}

/**
 * DTO for handling OAuth callback
 * Used to process the authorization code from OAuth providers
 *
 * @example
 * ```typescript
 * // Handle Google OAuth callback
 * const dto = new SocialCallbackDTO();
 * dto.provider = 'google';
 * dto.code = 'authorization-code-from-google';
 * dto.state = 'state-from-initial-request';
 * ```
 */
export class SocialCallbackDTO {
  /**
   * Social provider name
   * Must match the provider used in the initial request
   *
   * Validation:
   * - Must be a valid SocialProvider enum value
   */
  @IsEnum(SocialProvider, { message: 'Provider must be one of: google, apple, facebook' })
  provider!: SocialProvider;

  /**
   * Authorization code from OAuth provider
   * This code is exchanged for access token and user info
   *
   * Validation:
   * - Must be a string
   * - Max 1000 characters (typical OAuth code length)
   */
  @IsString({ message: 'Authorization code must be a string' })
  @IsNotEmpty({ message: 'Authorization code is required' })
  @MaxLength(1000, { message: 'Authorization code must not exceed 1000 characters' })
  code!: string;

  /**
   * State parameter from OAuth flow
   * Must match the state sent in the initial request
   *
   * Validation:
   * - Must be a string
   * - Max 500 characters (typical OAuth state length)
   */
  @IsString({ message: 'State must be a string' })
  @IsNotEmpty({ message: 'State is required' })
  @MaxLength(500, { message: 'State must not exceed 500 characters' })
  state!: string;

  /**
   * Optional error parameter from OAuth provider
   * Used when user denies permission or other errors occur
   *
   * Validation:
   * - Must be a string if present
   * - Max 100 characters
   */
  @IsOptional()
  @IsString({ message: 'Error must be a string' })
  @MaxLength(100, { message: 'Error must not exceed 100 characters' })
  error?: string;

  /**
   * Optional error description from OAuth provider
   * Provides more details about the error
   *
   * Validation:
   * - Must be a string if present
   * - Max 500 characters
   */
  @IsOptional()
  @IsString({ message: 'Error description must be a string' })
  @MaxLength(500, { message: 'Error description must not exceed 500 characters' })
  error_description?: string;
}

/**
 * DTO for linking social account to existing user
 * Used when an authenticated user wants to link a social provider
 *
 * @example
 * ```typescript
 * // Link Google account to current user
 * const dto = new LinkSocialAccountDTO();
 * dto.provider = 'google';
 * dto.code = 'authorization-code-from-google';
 * dto.state = 'state-from-initial-request';
 * ```
 */
export class LinkSocialAccountDTO {
  /**
   * Social provider name
   * Must be one of the configured providers
   *
   * Validation:
   * - Must be a valid SocialProvider enum value
   */
  @IsEnum(SocialProvider, { message: 'Provider must be one of: google, apple, facebook' })
  provider!: SocialProvider;

  /**
   * Authorization code from OAuth provider
   * This code is exchanged for access token and user info
   *
   * Validation:
   * - Must be a string
   * - Max 1000 characters (typical OAuth code length)
   */
  @IsString({ message: 'Authorization code must be a string' })
  @IsNotEmpty({ message: 'Authorization code is required' })
  @MaxLength(1000, { message: 'Authorization code must not exceed 1000 characters' })
  code!: string;

  /**
   * State parameter from OAuth flow
   * Must match the state sent in the initial request
   *
   * Validation:
   * - Must be a string
   * - Max 500 characters (typical OAuth state length)
   */
  @IsString({ message: 'State must be a string' })
  @IsNotEmpty({ message: 'State is required' })
  @MaxLength(500, { message: 'State must not exceed 500 characters' })
  state!: string;
}

/**
 * DTO for unlinking social account
 * Used when an authenticated user wants to remove a social provider
 *
 * @example
 * ```typescript
 * // Unlink Google account from current user
 * const dto = new UnlinkSocialAccountDTO();
 * dto.provider = 'google';
 * ```
 */
export class UnlinkSocialAccountDTO {
  /**
   * Social provider name to unlink
   * Must be one of the currently linked providers
   *
   * Validation:
   * - Must be a valid SocialProvider enum value
   */
  @IsEnum(SocialProvider, { message: 'Provider must be one of: google, apple, facebook' })
  provider!: SocialProvider;
}

/**
 * Response DTO for social login
 * Contains authentication tokens and user information
 *
 * @example
 * ```typescript
 * // Response after successful social login
 * {
 *   "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
 *   "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
 *   "expiresIn": 900,
 *   "user": {
 *     "sub": "user-uuid",
 *     "email": "user@example.com",
 *     "firstName": "John",
 *     "lastName": "Doe",
 *     "isEmailVerified": true,
 *     "socialProviders": ["google"]
 *   }
 * }
 * ```
 */
export class SocialLoginResponseDTO {
  /**
   * JWT access token for API authentication
   *
   * Validation:
   * - Must be a string
   * - Max 2048 characters (typical JWT length)
   */
  @IsString({ message: 'Access token must be a string' })
  @MaxLength(2048, { message: 'Access token must not exceed 2048 characters' })
  accessToken!: string;

  /**
   * JWT refresh token for token renewal
   *
   * Validation:
   * - Must be a string
   * - Max 2048 characters (typical JWT length)
   */
  @IsString({ message: 'Refresh token must be a string' })
  @MaxLength(2048, { message: 'Refresh token must not exceed 2048 characters' })
  refreshToken!: string;

  /**
   * Access token expiration timestamp (Unix timestamp in seconds)
   *
   * Validation:
   * - Must be a number
   */
  @IsNumber({}, { message: 'Access token expiration must be a number' })
  accessTokenExpiresAt!: number;

  /**
   * Refresh token expiration timestamp (Unix timestamp in seconds)
   *
   * Validation:
   * - Must be a number
   */
  @IsNumber({}, { message: 'Refresh token expiration must be a number' })
  refreshTokenExpiresAt!: number;

  /**
   * User information
   *
   * Validation:
   * - Nested fields validated in service layer:
   *   - sub: UUID v4 format, max 36 chars
   *   - email: Valid email format, max 255 chars
   *   - firstName: String, max 100 chars
   *   - lastName: String, max 100 chars
   *   - isEmailVerified: Boolean
   *   - socialProviders: Array of strings, each max 50 chars
   */
  user!: {
    sub: string;
    email: string;
    firstName?: string;
    lastName?: string;
    isEmailVerified: boolean;
    socialProviders?: string[];
  };
}

/**
 * Response DTO for social account information
 * Contains details about linked social accounts
 *
 * @example
 * ```typescript
 * // Response for user's linked social accounts
 * {
 *   "accounts": [
 *     {
 *       "provider": "google",
 *       "providerEmail": "user@gmail.com",
 *       "linkedAt": "2023-01-01T00:00:00Z",
 *       "lastUsedAt": "2023-01-15T12:00:00Z"
 *     }
 *   ]
 * }
 * ```
 */
export class SocialAccountsResponseDTO {
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
