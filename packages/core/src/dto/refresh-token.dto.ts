import { IsString, MinLength, MaxLength } from 'class-validator';

/**
 * Refresh Token DTO
 *
 * Used for refreshing access tokens with a valid refresh token.
 *
 * Security:
 * - Token length validated (prevents DoS)
 * - JWT tokens can be long, but we validate input length
 * - Token is validated in service layer for format and signature
 *
 * @example
 * ```typescript
 * POST /auth/refresh
 * {
 *   "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 * }
 * ```
 */
export class RefreshTokenDTO {
  /**
   * JWT refresh token
   *
   * Validation:
   * - Must be a string
   * - Min 10 characters (minimum valid JWT length)
   * - Max 2048 characters (prevents DoS, typical JWT is 200-500 chars)
   *
   * Note: Token format and signature validated in service layer
   */
  @IsString({ message: 'Refresh token must be a string' })
  @MinLength(10, { message: 'Refresh token is required' })
  @MaxLength(2048, { message: 'Refresh token must not exceed 2048 characters' })
  refreshToken!: string;
}
