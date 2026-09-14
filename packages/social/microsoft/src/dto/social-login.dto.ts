import { IsString, IsOptional, IsNotEmpty, IsEnum, MaxLength } from 'class-validator';

/**
 * Social provider enum
 */
export enum SocialProvider {
  GOOGLE = 'google',
  APPLE = 'apple',
  FACEBOOK = 'facebook',
  MICROSOFT = 'microsoft',
}

/**
 * DTO for initiating Microsoft social login
 * Used to generate the OAuth URL for the Microsoft identity platform
 *
 * @example
 * ```typescript
 * const dto = new MicrosoftSocialLoginDTO();
 * dto.provider = SocialProvider.MICROSOFT;
 * dto.state = 'random-state-string';
 * ```
 */
export class MicrosoftSocialLoginDTO {
  /**
   * Social provider name
   *
   * Validation:
   * - Must be a valid SocialProvider enum value
   */
  @IsEnum(SocialProvider, { message: 'Provider must be one of: google, apple, facebook, microsoft' })
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
 * DTO for handling the Microsoft OAuth callback
 * Used to process the authorization code returned by Entra ID
 *
 * @example
 * ```typescript
 * const dto = new MicrosoftSocialCallbackDTO();
 * dto.code = 'authorization-code-from-microsoft';
 * dto.state = 'state-from-initial-request';
 * ```
 */
export class MicrosoftSocialCallbackDTO {
  /**
   * Authorization code from the OAuth provider
   * This code is exchanged for tokens
   *
   * Validation:
   * - Must be a string
   * - Max 4000 characters (Entra authorization codes are longer than most providers')
   */
  @IsString({ message: 'Authorization code must be a string' })
  @IsNotEmpty({ message: 'Authorization code is required' })
  @MaxLength(4000, { message: 'Authorization code must not exceed 4000 characters' })
  code!: string;

  /**
   * State parameter from the OAuth flow
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
   * Optional error parameter from the OAuth provider
   * Used when the user denies consent or an error occurs
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
   * Optional error description from the OAuth provider
   * Provides more detail about the error
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
 * DTO for verifying a Microsoft ID token issued to a native mobile client
 *
 * @example
 * ```typescript
 * const dto = new MicrosoftVerifyTokenDTO();
 * dto.idToken = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...';
 * ```
 */
export class MicrosoftVerifyTokenDTO {
  /**
   * ID token issued by the Microsoft identity platform to a native client (MSAL)
   *
   * Validation:
   * - Must be a string
   * - Max 8192 characters (Entra ID tokens carrying group or role claims are large)
   */
  @IsString({ message: 'ID token must be a string' })
  @IsNotEmpty({ message: 'ID token is required' })
  @MaxLength(8192, { message: 'ID token must not exceed 8192 characters' })
  idToken!: string;
}
