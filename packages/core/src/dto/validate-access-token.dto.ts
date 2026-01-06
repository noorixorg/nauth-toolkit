import { IsString, MinLength, MaxLength } from 'class-validator';

/**
 * Validate Access Token DTO
 *
 * Used for validating JWT access tokens and decoding their payload.
 *
 * Security:
 * - Token length validated (prevents DoS)
 * - JWT tokens can be long, but we validate input length
 * - Token is validated in service layer for format, signature, and expiration
 *
 * @example
 * ```typescript
 * const result = await authService.validateAccessToken({
 *   accessToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 * });
 * ```
 */
export class ValidateAccessTokenDTO {
  /**
   * JWT access token to validate
   *
   * Validation:
   * - Must be a string
   * - Min 10 characters (minimum valid JWT length)
   * - Max 2048 characters (prevents DoS, typical JWT is 200-500 chars)
   *
   * Note: Token format, signature, and expiration validated in service layer
   *
   * @example "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U"
   */
  @IsString({ message: 'Access token must be a string' })
  @MinLength(10, { message: 'Access token is required' })
  @MaxLength(2048, { message: 'Access token must not exceed 2048 characters' })
  accessToken!: string;
}


